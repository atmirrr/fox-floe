// Recorded CC0 sounds (OpenGameArt, see sfx/CREDITS.md), shaped and layered with Web Audio:
// the boost and the sustained pull are built from the river recording, a low synthesized
// body and brown noise. Synth-only versions stand in if a file fails; soft sine chimes mark
// interface moments.
let ac = null, master = null, noiseBuf = null, brownBuf = null, waterGain = null, waterSrc = null, waterLoopOn = false;
let hullSrc = null, hullGain = null, hullFilter = null, swellGain = null, washGain = null, washFilter = null;
let rapidsLv = 0, driveLv = 0, meterNode = null;
let muted = false;
const SFX_FILES = {
  row1: 'sfx/row1.wav', row2: 'sfx/row2.wav', row3: 'sfx/row3.wav',
  whoosh1: 'sfx/whoosh1.wav', whoosh2: 'sfx/whoosh2.wav',
  splashMid: 'sfx/splash_mid.wav', splashBig: 'sfx/splash_big.wav', splashCrash: 'sfx/splash_crash.wav',
  crunch: 'sfx/crunch.wav', plop: 'sfx/plop.wav', bubble: 'sfx/bubble.wav',
  boing: 'sfx/boing.wav', waterloop: 'sfx/waterloop.wav',
};
const sfxData = {}, sfxBuf = {};
for (const [k, url] of Object.entries(SFX_FILES)) {
  fetch(url).then((r) => r.arrayBuffer()).then((b) => { sfxData[k] = b; if (ac) decodeSfx(k); }).catch(() => {});
}
function decodeSfx(k) {
  if (!ac || sfxBuf[k] || !sfxData[k]) return;
  ac.decodeAudioData(sfxData[k].slice(0), (b) => {
    sfxBuf[k] = b;
    if (k === 'waterloop') startWaterLoop();
  }, () => {});
}
function startWaterLoop() {
  if (waterLoopOn || !ac || !sfxBuf.waterloop) return;
  waterLoopOn = true;
  const s = ac.createBufferSource(); s.buffer = sfxBuf.waterloop; s.loop = true;
  const g = ac.createGain(); g.gain.value = 0.05;
  s.connect(g); g.connect(master); s.start();
  waterGain = g; waterSrc = s;
  // the hull: the same river recording, run faster and narrowed to the hiss of water sliding
  // past the planks. Silent until the fox pulls hard; it swells a little with every stroke
  hullSrc = ac.createBufferSource(); hullSrc.buffer = sfxBuf.waterloop; hullSrc.loop = true; hullSrc.playbackRate.value = 1.25;
  hullFilter = ac.createBiquadFilter(); hullFilter.type = 'bandpass'; hullFilter.frequency.value = 600; hullFilter.Q.value = 0.55;
  swellGain = ac.createGain(); swellGain.gain.value = 1;
  hullGain = ac.createGain(); hullGain.gain.value = 0;
  hullSrc.connect(hullFilter); hullFilter.connect(swellGain); swellGain.connect(hullGain); hullGain.connect(master);
  hullSrc.start(0, 1.3);   // offset from the ambience copy so the two never phase
  applyFlow();
}
// brown noise, looped seamlessly (the tail is crossfaded into the head): a soft, deep bed
function makeBrown(seconds) {
  const L = Math.floor(ac.sampleRate * seconds), F = Math.floor(ac.sampleRate * 0.15);
  const raw = new Float32Array(L + F);
  let last = 0;
  for (let i = 0; i < raw.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; raw[i] = last * 3.5; }
  const buf = ac.createBuffer(1, L, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < L; i++) d[i] = raw[i];
  for (let i = 0; i < F; i++) { const k = i / F; d[i] = raw[i] * k + raw[L + i] * (1 - k); }
  return buf;
}
export function audioInit() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.5;
  // a gentle limiter on the way out, so a boost landing on splashes and chimes never distorts
  const limit = ac.createDynamicsCompressor();
  limit.threshold.value = -10; limit.knee.value = 6; limit.ratio.value = 8; limit.attack.value = 0.003; limit.release.value = 0.15;
  master.connect(limit); limit.connect(ac.destination);
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  const wind = ac.createBufferSource(); wind.buffer = buf; wind.loop = true;
  const lf = ac.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 380;
  const wg = ac.createGain(); wg.gain.value = 0.028;
  wind.connect(lf); lf.connect(wg); wg.connect(master); wind.start();
  // the wash: water shouldered aside by the bow, a deep bed under the hull hiss while pulling
  brownBuf = makeBrown(3);
  const wash = ac.createBufferSource(); wash.buffer = brownBuf; wash.loop = true;
  washFilter = ac.createBiquadFilter(); washFilter.type = 'lowpass'; washFilter.frequency.value = 450;
  washGain = ac.createGain(); washGain.gain.value = 0;
  wash.connect(washFilter); washFilter.connect(washGain); washGain.connect(master); wash.start();
  for (const k of Object.keys(SFX_FILES)) decodeSfx(k);
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }
export function isMuted() { return muted; }
// the river bed sound: louder in rapids; louder, faster and brighter while the fox pulls hard.
// Updates are smoothed ramps, and only sent when a level really moves
function applyFlow() {
  if (!ac) return;
  const t = ac.currentTime;
  const d = driveLv;
  if (waterGain) waterGain.gain.setTargetAtTime(0.05 + rapidsLv * 0.06 + d * 0.04, t, 0.12);
  if (waterSrc) waterSrc.playbackRate.setTargetAtTime(1 + d * 0.08, t, 0.2);
  if (hullGain) {
    hullGain.gain.setTargetAtTime(d * d * 0.9, t, 0.1);           // eases in: a light hold stays light
    hullSrc.playbackRate.setTargetAtTime(1.25 + d * 0.3, t, 0.2);
    hullFilter.frequency.setTargetAtTime(600 + d * 1000, t, 0.15);
  }
  if (washGain) {
    washGain.gain.setTargetAtTime(d * 0.09, t, 0.12);
    washFilter.frequency.setTargetAtTime(450 + d * 450, t, 0.15);
  }
}
export function setRapidsLevel(r) { if (Math.abs(r - rapidsLv) > 0.01) { rapidsLv = r; applyFlow(); } }
export function setDrive(d) { if (Math.abs(d - driveLv) > 0.006 || (d === 0 && driveLv !== 0)) { driveLv = d; applyFlow(); } }
export const sfxCount = () => Object.keys(sfxBuf).length;
export const audioState = () => (ac ? ac.state : 'none');
// test hook: the master bus level right now, in dBFS (rms, peak)
export function meter() {
  if (!ac) return null;
  if (!meterNode) { meterNode = ac.createAnalyser(); meterNode.fftSize = 4096; master.connect(meterNode); }
  const a = new Float32Array(meterNode.fftSize); meterNode.getFloatTimeDomainData(a);
  let s = 0, p = 0; for (const v of a) { s += v * v; p = Math.max(p, Math.abs(v)); }
  return { rms: +(10 * Math.log10(s / a.length + 1e-12)).toFixed(1), peak: +(20 * Math.log10(p + 1e-9)).toFixed(1) };
}

export function play(k, vol = 1, rate = 1, delay = 0) {
  if (!ac || muted || !sfxBuf[k]) return false;
  const s = ac.createBufferSource(); s.buffer = sfxBuf[k]; s.playbackRate.value = rate;
  const g = ac.createGain(); g.gain.value = vol;
  s.connect(g); g.connect(master);
  s.start(ac.currentTime + delay);
  return true;
}
export function blip(freq, delay, dur, type, vol) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
// a low body for a stroke: a sine that drops in pitch, like a blade shoving water
function whump(vol, f0 = 150, f1 = 58, dur = 0.2, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
// a surge of water: a slice of the river recording through a filter that sweeps up, so the
// rush comes from real water rather than from noise
function surge(vol, delay = 0) {
  if (!ac || muted || !sfxBuf.waterloop) return false;
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = sfxBuf.waterloop; s.playbackRate.value = 1.45 + Math.random() * 0.15;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
  f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.35);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
  g.gain.setTargetAtTime(0.0001, t + 0.22, 0.2);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random() * 1.8, 1.1);
  return true;
}
function noiseHit(dur, freq, vol, delay = 0) {
  if (!ac || muted || !noiseBuf) return;
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}

// a soft chime: a sine with a faint octave partial, quick attack, gentle tail
export function beep(freq = 1318.5, dur = 0.2, vol = 0.05, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
  const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.01;
  const g = ac.createGain(), g2 = ac.createGain();
  g2.gain.value = 0.16;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
  o.start(t); o2.start(t); o.stop(t + dur + 0.03); o2.stop(t + dur + 0.03);
}

export const snd = {
  // a stroke of the oar. While pulling hard it bites deeper: lower, louder, with body, and the
  // hull rush swells with it, so the sustained sound breathes with the rowing
  row(d = 0) {
    play(['row1', 'row2', 'row3'][(Math.random() * 3) | 0], 0.17 + d * 0.13, 0.92 + Math.random() * 0.18 - d * 0.14) || noiseHit(0.13, 900, 0.04 + d * 0.02);
    if (d > 0.15) {
      whump(0.1 * d, 120, 60, 0.14);
      if (swellGain) { const t = ac.currentTime; swellGain.gain.setTargetAtTime(1 + 0.5 * d, t, 0.03); swellGain.gain.setTargetAtTime(1, t + 0.12, 0.2); }
    }
  },
  // the power stroke: the blade bites, water heaves, a low shove, a surge of water rushing up, and
  // under it all a deep swoosh of speed, so a boost is unmistakable over the ordinary rowing
  boost() {
    const r = 0.92 + Math.random() * 0.12;
    const ok = play(['row1', 'row2', 'row3'][(Math.random() * 3) | 0], 0.5, 0.76 * r);
    play('splashBig', 0.42, 0.86 * r, 0.03);
    play(Math.random() < 0.5 ? 'whoosh1' : 'whoosh2', 0.3, 0.55 * r, 0.01);
    whump(0.4, 200, 70, 0.24);
    surge(1.4, 0.02);
    if (!ok) { noiseHit(0.25, 1200, 0.12); }
  },
  // fish chain climbs in pitch with the multiplier
  ding(mult = 1) {
    const r = 1 + (mult - 1) * 0.09 + Math.random() * 0.08;
    if (play('plop', 0.8, r)) play('bubble', 0.45, 1.3 * r, 0.05);
    else { blip(660 * r, 0, 0.1, 'sine', 0.5); blip(990 * r, 0.07, 0.14, 'sine', 0.4); }
  },
  crash() {
    if (play('crunch', 0.95, 0.95)) play('splashCrash', 0.85, 1, 0.03);
    else { noiseHit(0.5, 500, 0.8); blip(90, 0, 0.35, 'sine', 0.6); }
  },
  pengLand() { play('splashBig', 0.55, 0.95 + Math.random() * 0.15) || noiseHit(0.28, 1200, 0.18); },
  boing() { play('boing', 0.22, 1.25); },
  wekWek() {
    if (!ac || muted) return;
    for (let n = 0; n < 2; n++) {
      const t = ac.currentTime + n * 0.12;
      const o = ac.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(1350 - n * 150, t);
      o.frequency.exponentialRampToValueAtTime(820, t + 0.07);
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2.5;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.12);
    }
  },
  powerup() { play('bubble', 0.7, 0.85); blip(880, 0, 0.12, 'sine', 0.25); blip(1320, 0.09, 0.16, 'sine', 0.22); },
  // interface chimes
  call() { beep(1046.5, 0.24, 0.05); beep(1568, 0.34, 0.045, 0.09); },
  milestone() { [1046.5, 1318.5, 1568].forEach((f, i) => beep(f, 0.32, 0.04, i * 0.08)); },
  best() { [1046.5, 1318.5, 1568, 2093].forEach((f, i) => beep(f, 0.42, 0.045, i * 0.09)); },
};
