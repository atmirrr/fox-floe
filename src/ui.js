import { printify, printSVG, printNumber } from './print.js';
import { icon, setIcon } from './icons.js';

// A quiet interface over a full-screen river: thin drawn type, line icons, no containers.
// The ink follows the sky (navy over bright skies, white at dusk and night).
// thousands separators without toLocaleString, which is slow enough to show up in a per-frame HUD
const commas = (v) => String(Math.max(0, Math.floor(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function createUI() {
  const app = document.getElementById('app');
  const $ = (s) => app.querySelector(s);
  const $$ = (s) => [...app.querySelectorAll(s)];
  const screen = $('#screen');

  // ---------------------------------------------------------------- build
  for (const e of $$('[data-ico]')) e.replaceWith(icon(e.dataset.ico, +e.dataset.w || 1.6));
  const nums = {};
  for (const e of $$('[data-num]')) {
    const cs = getComputedStyle(e);
    const size = parseFloat(cs.fontSize) || 12;
    const n = printNumber({
      weight: parseFloat(cs.getPropertyValue('--pw')) || 1.2,
      tracking: cs.letterSpacing === 'normal' ? 0.04 : parseFloat(cs.letterSpacing) / size,
      format: commas,
    });
    e.appendChild(n.svg);
    nums[e.dataset.num] = n;
  }
  for (const e of $$('[data-print]')) printify(e);
  // the title logo writes itself in: every stroke measured as 1, staggered left to right
  $$('#p-title .logo path').forEach((p, i) => { p.setAttribute('pathLength', '1'); p.style.setProperty('--i', i); });
  const setNum = (k, v) => nums[k] && nums[k].set(v);
  const mult = $('.mult'), chain = $('.m-chain'), pShield = $('.p-shield'), pMagnet = $('.p-magnet'), mMagnet = $('.m-magnet');
  const callEl = $('#call'), pops = $('#pops'), coachEl = $('#coach'), sr = $('#sr');

  // ---------------------------------------------------------------- layout + input
  let layoutCbs = [];
  const layout = () => { for (const cb of layoutCbs) cb(); };
  addEventListener('resize', layout);
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  app.dataset.input = fine ? 'mouse' : 'touch';
  addEventListener('pointerdown', (e) => { app.dataset.input = e.pointerType === 'mouse' ? 'mouse' : 'touch'; }, true);

  // ---------------------------------------------------------------- state
  let state = 'loading';
  function setState(s) {
    state = s;
    app.dataset.state = s;
    if (s !== 'play') { callEl.classList.remove('on'); coachEl.classList.remove('on'); }
    if (s === 'paused') announce('paused');
  }
  function announce(t) { sr.textContent = ''; setTimeout(() => { sr.textContent = t; }, 30); }

  // ink: the sky's brightness decides, with hysteresis so dawn and dusk don't flicker
  let tone = 'dark';
  function setTone(lum) {
    const next = tone === 'dark' ? (lum < 0.16 ? 'light' : 'dark') : (lum > 0.22 ? 'dark' : 'light');
    if (next !== tone) { tone = next; app.dataset.tone = next; }
  }

  // ---------------------------------------------------------------- controls
  const handlers = {};
  const act = (name) => { if (handlers[name]) handlers[name](); };
  for (const b of $$('[data-act]')) {
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    b.addEventListener('click', (e) => { e.stopPropagation(); act(b.dataset.act); b.blur(); });
  }

  // ---------------------------------------------------------------- live values
  let lastMult = 0;
  function hud(v) {
    setNum('score', v.score);
    setNum('dist', v.dist);
    setNum('fish', v.fish);
    if (v.mult !== lastMult) {
      lastMult = v.mult;
      mult.classList.toggle('on', v.mult > 1);
      if (v.mult > 1) setNum('mult', '×' + v.mult);
    }
    chain.style.setProperty('--f', v.chain.toFixed(3));
    pShield.classList.toggle('on', !!v.shield);
    pMagnet.classList.toggle('on', v.magnet > 0);
    mMagnet.style.setProperty('--f', Math.max(0, v.magnet).toFixed(3));
  }
  // top line under the distance: sections, milestones, new best
  let callT = null;
  // the stroke comes from the CSS, so the standard-density floor applies here too
  const callWeight = parseFloat(getComputedStyle(callEl).getPropertyValue('--pw')) || 1.4;
  function call(text) {
    callEl.replaceChildren(printSVG(text.toUpperCase(), { tracking: 0.34, weight: callWeight }));
    callEl.classList.add('on');
    clearTimeout(callT);
    callT = setTimeout(() => callEl.classList.remove('on'), 1900);
  }
  // floating words at the boat: fish, close calls, smash, air
  let ax = innerWidth / 2, ay = innerHeight * 0.6;
  // a new word nudges the ones still in the air up a line, so quick chains stay readable
  function pop(text, big = false) {
    if (pops.childElementCount > 4) pops.firstChild.remove();
    for (const o of pops.children) o.style.setProperty('--lift', (+o.style.getPropertyValue('--lift') || 0) + 1);
    const d = document.createElement('div');
    d.className = 'pop' + (big ? ' big' : '');
    d.style.left = ax + 'px';
    d.style.top = ay + 'px';
    d.appendChild(printSVG(text, { tracking: 0.16, weight: big ? 1.4 : 1.5 }));
    pops.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }

  // ---------------------------------------------------------------- menus
  function title({ best, lifeM }) {
    setNum('best', best);
    setNum('lifem', lifeM);
    // nothing to report before the first run
    $('#titleMeta').hidden = !(best > 0 || lifeM > 0);
  }
  function results(r) {
    setNum('rscore', r.score);
    setNum('rdist', r.dist);
    setNum('rfish', r.fish);
    setNum('rnear', r.near);
    setNum('rbest', r.best);
    $('#p-over').classList.toggle('is-best', !!r.isBest);
    announce(`${r.score} points, ${r.dist} meters${r.isBest ? ', a new best' : ''}. Tap to row again.`);
  }
  function coach() {
    coachEl.classList.add('on');
    setTimeout(() => coachEl.classList.remove('on'), 5200);
  }

  const btnSound = $('#btnSound');
  return {
    screen,
    ready(cb) { setTimeout(cb, 250); },
    fail(text) {
      const e = $('#errText');
      e.textContent = text;
      printify(e);
      setState('error');
    },
    setState, title, results, call, pop, hud, coach, announce,
    tone: setTone,
    anchor(x, y) { ax = x; ay = y; },
    fish(pts, m) { pop('+' + pts + (m > 1 ? ' ×' + m : ''), m > 1); },
    bind(h) { Object.assign(handlers, h); },
    setMuted(m) {
      setIcon(btnSound.querySelector('svg'), m ? 'mute' : 'sound');
      btnSound.setAttribute('aria-label', m ? 'Sound on' : 'Sound off');
    },
    onLayout(cb) { layoutCbs.push(cb); },
  };
}
