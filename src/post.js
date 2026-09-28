import * as THREE from 'three';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { ShaderPass } from '../vendor/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';

// Final look: grade, fine print grain, vignette, boost speed lines, crash split.
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, tBloom: { value: null }, uBloom: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uNight: { value: 0 }, uSat: { value: 1.06 }, uVig: { value: 0.3 }, uGrain: { value: 0.02 },
    uSpeed: { value: 0 }, uSplit: { value: 0 }, uSheen: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse, tBloom;
    uniform float uTime, uNight, uSat, uVig, uGrain, uSpeed, uSplit, uSheen, uBloom;
    uniform vec2 uRes;
    uniform vec3 uTint;
    float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      vec3 col;
      if (uSplit > 0.001) {
        vec2 o = c * uSplit * 0.03;
        col = vec3(texture2D(tDiffuse, uv + o).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - o).b);
      } else col = texture2D(tDiffuse, uv).rgb;
      // the glow, added here rather than painted back onto the multisampled scene buffer
      // (the same additive blend the bloom pass used: its color weighted by its own alpha)
      vec4 bl = texture2D(tBloom, uv);
      col += bl.rgb * bl.a * uBloom;
      // grade: gentle saturation, night pushes blue in the shadows
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col *= uTint;
      col = mix(col, col * vec3(0.93, 1.0, 1.1) + vec3(0.0, 0.004, 0.012), uNight * 0.8);
      // speed: thin streaks that flow outward on their own clocks, so a sustained pull reads as
      // one steady stream instead of a strobe
      if (uSpeed > 0.01) {
        float a = atan(c.y, c.x);
        float r = length(c * vec2(uRes.x / uRes.y, 1.0));
        float u = (a / 6.28318 + 0.5) * 84.0;
        float slot = floor(u), fa = fract(u);
        float h1 = hash12(vec2(slot, 3.7)), h2 = hash12(vec2(slot, 9.1)), h3 = hash12(vec2(slot, 5.3));
        float ph = fract(uTime * (0.7 + h2 * 0.7) + h1 * 7.0);
        float head = 0.32 + ph * 0.8, len = 0.14 + h3 * 0.2;
        float seg = smoothstep(head - len, head - len * 0.5, r) * (1.0 - smoothstep(head - 0.015, head, r));
        float w = min(fwidth(u), 0.2);   // (u wraps at the left edge; keep the seam from smearing)
        float thin = 1.0 - smoothstep(0.04, 0.04 + w * 1.5, abs(fa - (0.3 + 0.4 * h3)));
        float streak = step(0.42, h1) * seg * thin * sin(ph * 3.14159);
        col = mix(col, vec3(1.0), streak * smoothstep(0.3, 0.52, r) * uSpeed * 0.6);
      }
      // optional diagonal sheen (off by default), soft vignette, print grain
      float sh = smoothstep(0.0, 0.25, uv.y - uv.x * 0.55 + 0.18) * (1.0 - smoothstep(0.25, 0.5, uv.y - uv.x * 0.55 + 0.18));
      col += sh * uSheen;
      col *= 1.0 - smoothstep(0.42, 0.9, length(c * vec2(0.9, 1.0))) * uVig;
      col += (hash12(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * uGrain;
      // straight to the screen: the output color conversion happens here, not in a separate pass
      gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
    }`,
};

export function createPost(renderer, scene, camera, { samples = 4, bloom = true } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, rt);
  // Only the scene needs multisampling. The composer renders the scene into its readBuffer
  // (renderTarget2) and, since the grade below draws straight to the screen and never swaps, it
  // stays there every frame; the other buffer is never bound, so it carries no samples at all.
  composer.renderTarget2.samples = samples;
  composer.renderTarget1.samples = 0;
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = bloom ? new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.12, 0.5, 0.86) : null;
  if (bloomPass) {
    // the glow is soft by nature: build it from half the resolution, a quarter of the pixels
    const fullSize = bloomPass.setSize.bind(bloomPass);
    bloomPass.setSize = (w, h) => fullSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    // and skip its last step, an additive paint over the scene buffer: the grade adds the glow instead
    const quad = bloomPass.fsQuad, quadRender = quad.render.bind(quad);
    quad.render = (r) => { if (quad.material !== bloomPass.blendMaterial) quadRender(r); };
    composer.addPass(bloomPass);
  }
  const final = new ShaderPass(FinalShader);
  if (bloomPass) final.uniforms.tBloom.value = bloomPass.renderTargetsHorizontal[0].texture;
  // the grade is the last pass and draws to the screen, so it never needs to swap buffers
  final.needsSwap = false;
  composer.addPass(final);
  return {
    composer, final, bloom: bloomPass,
    setSize(w, h) {
      composer.setSize(w, h);
      final.uniforms.uRes.value.set(w, h);
    },
    render() {
      final.uniforms.uBloom.value = bloomPass && bloomPass.enabled ? 1 : 0;
      composer.render();
    },
  };
}
