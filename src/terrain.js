import * as THREE from 'three';
import { bendMaterial } from './bend.js';

// Snowfield beyond the cliffs: rolling faceted hills with pine stands and boulders, built as
// conveyor chunks whose heights come from one world-anchored noise field (seamless on recycle).
const L = 24;           // chunk length (m)
const PER_SIDE = 9;
const X_IN = 11.2;      // inner edge distance from river center
const XS = [0, 1.4, 2.8, 4.6, 6.8, 9.4, 12.5, 16.2, 20.5, 25.5, 31.5, 38.5, 46.5, 56, 67];
const ZN = 9;           // z samples per chunk (8 cells of 3 m)
const TREES = 34, ROCKS = 7;

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x, y) { return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 1, y * 4.3 + 9) * 0.15; }
export function snowHeight(x, zAbs, side) {
  const s = side * 13.7;
  const shelf = 0.35 + 0.5 * fbm(x * 0.2 + s, zAbs * 0.08);
  const hills = (fbm(x * 0.045 + s, zAbs * 0.035) - 0.3) * 9 * smoothstep(2, 18, x);
  const ridge = Math.pow(Math.max(0, fbm(x * 0.03 + 40 + s, zAbs * 0.022) - 0.35), 1.4) * 34 * smoothstep(22, 60, x);
  return shelf + Math.max(0, hills) + ridge;
}
function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// flatten a template root into (position, normal, color) arrays in root space, colors baked
export function bakeTemplate(root) {
  const pos = [], nor = [], col = [];
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3(), m = new THREE.Matrix4(), c = new THREE.Color();
  root.traverse((o) => {
    if (!o.isMesh) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    nm.getNormalMatrix(m);
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const P = g.attributes.position, N = g.attributes.normal, VC = g.attributes.color;
    const base = (Array.isArray(o.material) ? o.material[0] : o.material).color;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(n.x, n.y, n.z);
      c.copy(base);
      if (VC) { c.r *= VC.getX(i); c.g *= VC.getY(i); c.b *= VC.getZ(i); }
      col.push(c.r, c.g, c.b);
    }
  });
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), col: new Float32Array(col), count: pos.length / 3 };
}
function rockTemplate() {
  const g = new THREE.IcosahedronGeometry(1, 0);
  g.scale(1, 0.62, 0.9);
  g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal;
  const col = new Float32Array(P.count * 3);
  const c = new THREE.Color(0x8fa3b4);
  for (let i = 0; i < P.count; i++) { const k = 0.8 + 0.2 * (P.getY(i) + 0.62) / 1.24; col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
  return { pos: P.array.slice(), nor: N.array.slice(), col, count: P.count };
}

export function createTerrain(templates, scene, layerFn) {
  const species = [bakeTemplate(templates.Tree), bakeTemplate(templates.TreeB)];
  const rock = rockTemplate();
  const perTree = Math.max(...species.map((s) => s.count));
  const propVerts = TREES * perTree + ROCKS * rock.count;

  const snowMat = bendMaterial(new THREE.MeshToonMaterial({ color: 0xf6f9fb }));
  const propMat = bendMaterial(new THREE.MeshToonMaterial({ vertexColors: true }));
  const chunks = [];
  let scroll = 0;   // accumulated world travel, anchors the noise field

  // the grid is drawn as a plain triangle list with per-face normals (faceted snow)
  const tri = [];
  for (let i = 0; i < XS.length - 1; i++) {
    for (let j = 0; j < ZN - 1; j++) {
      const a = i * ZN + j, b = (i + 1) * ZN + j, c = i * ZN + j + 1, d = (i + 1) * ZN + j + 1;
      // alternate the diagonal so the facets don't all lean one way
      if ((i + j) & 1) tri.push(a, c, b, b, c, d);
      else tri.push(a, c, d, a, d, b);
    }
  }
  const grid = new Float32Array(XS.length * ZN * 3);

  for (const side of [-1, 1]) {
    for (let k = 0; k < PER_SIDE; k++) {
      const g = new THREE.Group();
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri.length * 3), 3));
      tg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(tri.length * 3), 3));
      const terrain = new THREE.Mesh(tg, snowMat);
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(propVerts * 3), 3));
      pg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(propVerts * 3), 3));
      pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(propVerts * 3), 3));
      const props = new THREE.Mesh(pg, propMat);
      terrain.frustumCulled = props.frustumCulled = false;
      g.add(terrain, props);
      g.scale.x = side;              // local +x points away from the river on both sides
      g.position.set(side * X_IN, 0, 30 - k * L);
      scene.add(g);
      if (layerFn) layerFn(terrain);
      const ch = { g, side, terrain, props };
      build(ch);
      chunks.push(ch);
    }
  }

  function build(ch) {
    const zc = ch.g.position.z;
    const P = grid;
    for (let i = 0; i < XS.length; i++) {
      for (let j = 0; j < ZN; j++) {
        const lz = -L / 2 + (j / (ZN - 1)) * L;
        const o = (i * ZN + j) * 3;
        // jitter interior vertices so facets read as hand-cut, keep chunk seams exact
        const zAbs = zc + lz - scroll;
        const jx = i > 0 && i < XS.length - 1 ? (hash(i * 3.1, Math.round(zAbs)) - 0.5) * (XS[i + 1] - XS[i - 1]) * 0.18 : 0;
        const x = XS[i] + jx;
        P[o] = x; P[o + 1] = snowHeight(x, zAbs, ch.side); P[o + 2] = lz;
      }
    }
    const TP = ch.terrain.geometry.attributes.position.array;
    const TN = ch.terrain.geometry.attributes.normal.array;
    for (let t = 0; t < tri.length; t += 3) {
      const a = tri[t] * 3, b = tri[t + 1] * 3, c = tri[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      nx /= l; ny /= l; nz /= l;
      for (let k = 0; k < 3; k++) {
        const src = tri[t + k] * 3, dst = (t + k) * 3;
        TP[dst] = P[src]; TP[dst + 1] = P[src + 1]; TP[dst + 2] = P[src + 2];
        TN[dst] = nx; TN[dst + 1] = ny; TN[dst + 2] = nz;
      }
    }
    ch.terrain.geometry.attributes.position.needsUpdate = true;
    ch.terrain.geometry.attributes.normal.needsUpdate = true;

    const pp = ch.props.geometry.attributes.position.array;
    const pn = ch.props.geometry.attributes.normal.array;
    const pc = ch.props.geometry.attributes.color.array;
    pp.fill(0); pn.fill(0); pc.fill(0);
    let w = 0;
    const seed = Math.round(zc - scroll) * 0.137 + ch.side * 5.1;
    const put = (tpl, tx, ty, tz, s, rot, tint) => {
      const cs = Math.cos(rot), sn = Math.sin(rot);
      for (let i = 0; i < tpl.count; i++) {
        const x = tpl.pos[i * 3] * s, y = tpl.pos[i * 3 + 1] * s, z = tpl.pos[i * 3 + 2] * s;
        pp[w * 3] = tx + x * cs + z * sn; pp[w * 3 + 1] = ty + y; pp[w * 3 + 2] = tz - x * sn + z * cs;
        const nx = tpl.nor[i * 3], ny = tpl.nor[i * 3 + 1], nz = tpl.nor[i * 3 + 2];
        pn[w * 3] = nx * cs + nz * sn; pn[w * 3 + 1] = ny; pn[w * 3 + 2] = -nx * sn + nz * cs;
        pc[w * 3] = tpl.col[i * 3] * tint; pc[w * 3 + 1] = tpl.col[i * 3 + 1] * tint; pc[w * 3 + 2] = tpl.col[i * 3 + 2] * tint;
        w++;
      }
    };
    let placed = 0;
    for (let tries = 0; tries < TREES * 4 && placed < TREES; tries++) {
      const r1 = hash(seed + tries * 1.7, 3.3), r2 = hash(seed + tries * 2.3, 8.1), r3 = hash(seed + tries * 0.9, 1.9);
      const x = 1.6 + Math.pow(r1, 1.35) * 44;
      const lz = (r2 - 0.5) * L;
      const zAbs = zc + lz - scroll;
      // stands of pines: keep trees where the forest noise is high
      if (fbm(x * 0.09 + ch.side * 3, zAbs * 0.07) < 0.47 && x > 5) continue;
      const y = snowHeight(x, zAbs, ch.side) - 0.05;
      const sp = species[r3 < 0.55 ? 0 : 1];
      put(sp, x, y, lz, (0.85 + r3 * 0.6) * (1 + x * 0.018), r1 * 6.28, 0.92 + r2 * 0.12);
      placed++;
    }
    w = TREES * perTree;
    for (let r = 0; r < ROCKS; r++) {
      const r1 = hash(seed + r * 5.3, 4.4), r2 = hash(seed + r * 3.9, 6.6);
      const x = 0.6 + r1 * 30, lz = (r2 - 0.5) * L;
      const y = snowHeight(x, zc + lz - scroll, ch.side);
      put(rock, x, y - 0.15, lz, 0.35 + r2 * 0.9 + (x > 12 ? 0.8 : 0), r1 * 6.28, 1);
    }
    ch.props.geometry.attributes.position.needsUpdate = true;
    ch.props.geometry.attributes.normal.needsUpdate = true;
    ch.props.geometry.attributes.color.needsUpdate = true;
  }

  // a recycled chunk lands far out in the haze, so its rebuild can wait a frame or two: at most one
  // per frame, instead of both sides of the river in the same frame (a visible hitch)
  const pending = [];
  return {
    chunks,
    update(dz, narN) {
      scroll += dz;
      for (const ch of chunks) {
        ch.g.position.z += dz;
        ch.g.position.x = ch.side * (X_IN - narN * 0.9);
        if (ch.g.position.z > 30 + L / 2) {
          ch.g.position.z -= PER_SIDE * L;
          if (!pending.includes(ch)) pending.push(ch);
        }
      }
      if (pending.length) build(pending.shift());
    },
  };
}
