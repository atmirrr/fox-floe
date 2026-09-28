// The game's typeface: a monoline, condensed, DIN-built face drawn as SVG strokes, so every
// word looks the same on every device and ships with no font file. Glyphs size in em, so CSS
// font-size (clamp() included) sets their size; the stroke weight comes from --pw, in units.
// Em box is 14 units: cap height 1..11, x-height 3.6..11, ascender 0.6, descender to 14.
const NS = 'http://www.w3.org/2000/svg';
const G = {
  // capitals
  A: [6.8, 'M0.8 11L3.4 1L6 11M1.7 7.6H5.1'],
  B: [7.3, 'M1 11V1H3.6A2.4 2.4 0 0 1 3.6 5.8H1M3.6 5.8H3.9A2.6 2.6 0 0 1 3.9 11H1'],
  C: [6.8, 'M5.9 3.5A2.5 2.5 0 0 0 0.9 3.5V8.5A2.5 2.5 0 0 0 5.9 8.5'],
  D: [7, 'M1 1H3.2A2.8 2.8 0 0 1 6 3.8V8.2A2.8 2.8 0 0 1 3.2 11H1Z'],
  E: [6.4, 'M5.6 1H1V11H5.6M1 5.9H4.8'],
  F: [6.2, 'M5.6 1H1V11M1 5.9H4.8'],
  G: [6.9, 'M5.9 3.5A2.5 2.5 0 0 0 0.9 3.5V8.5A2.5 2.5 0 0 0 5.9 8.5V6.2H3.6'],
  H: [6.8, 'M1 1V11M5.8 1V11M1 5.9H5.8'],
  I: [2.4, 'M1.2 1V11'],
  J: [5.6, 'M4.6 1V8.6A2.2 2.2 0 0 1 0.2 8.6'],
  K: [6.6, 'M1 1V11M5.8 1L1 7M2.6 5.2L5.9 11'],
  L: [6, 'M1 1V11H5.4'],
  M: [8.2, 'M1 11V1L4.1 8L7.2 1V11'],
  N: [6.8, 'M1 11V1L5.8 11V1'],
  O: [6.8, 'M0.9 3.5A2.5 2.5 0 0 1 5.9 3.5V8.5A2.5 2.5 0 0 1 0.9 8.5Z'],
  P: [6.6, 'M1 11V1H3.6A2.45 2.45 0 0 1 3.6 5.9H1'],
  Q: [6.9, 'M0.9 3.5A2.5 2.5 0 0 1 5.9 3.5V8.5A2.5 2.5 0 0 1 0.9 8.5ZM3.9 8.2L6.2 11.5'],
  R: [6.8, 'M1 11V1H3.6A2.45 2.45 0 0 1 3.6 5.9H1M3.4 5.9L6 11'],
  S: [6.8, 'M5.58 2.49A2.4 2.4 0 1 0 3.4 5.9A2.55 2.55 0 1 1 1.09 9.53'],
  T: [6.8, 'M0.6 1H6.2M3.4 1V11'],
  U: [6.9, 'M1 1V8.5A2.45 2.45 0 0 0 5.9 8.5V1'],
  V: [6.8, 'M0.7 1L3.4 11L6.1 1'],
  W: [8.6, 'M0.6 1L2.4 11L4.3 3.6L6.2 11L8 1'],
  X: [6.8, 'M0.9 1L5.9 11M5.9 1L0.9 11'],
  Y: [6.8, 'M0.7 1L3.4 6.2L6.1 1M3.4 6.2V11'],
  Z: [6.8, 'M1 1H5.8L1 11H5.8'],
  // lowercase
  a: [6, 'M5 5.65A2.025 2.025 0 0 0 0.95 5.65V8.95A2.025 2.025 0 0 0 5 8.95M5 3.6V11'],
  b: [6.1, 'M1 0.6V11M1 5.65A2.025 2.025 0 0 1 5.05 5.65V8.95A2.025 2.025 0 0 1 1 8.95'],
  c: [5.7, 'M4.95 5.65A2.025 2.025 0 0 0 0.9 5.65V8.95A2.025 2.025 0 0 0 4.95 8.95'],
  d: [6, 'M5 0.6V11M5 5.65A2.025 2.025 0 0 0 0.95 5.65V8.95A2.025 2.025 0 0 0 5 8.95'],
  e: [6, 'M0.95 7.3H5V5.65A2.025 2.025 0 0 0 0.95 5.65V8.95A2.025 2.025 0 0 0 4.95 9.2'],
  f: [4.6, 'M2.2 11V2.6A1.9 1.9 0 0 1 4.1 0.7H4.5M0.6 3.8H4.2'],
  g: [6, 'M5 5.65A2.025 2.025 0 0 0 0.95 5.65V8.95A2.025 2.025 0 0 0 5 8.95M5 3.6V11.9A2.025 2.025 0 0 1 0.95 11.9'],
  h: [6.1, 'M1 0.6V11M1 5.65A2.025 2.025 0 0 1 5.05 5.65V11'],
  i: [2.4, 'M1.2 3.6V11M1.2 0.9V1.9'],
  j: [3, 'M1.8 3.6V12.2A1.4 1.4 0 0 1 0.4 13.6M1.8 0.9V1.9'],
  k: [5.8, 'M1 0.6V11M5 3.6L1 8.2M2.5 6.6L5.2 11'],
  l: [2.4, 'M1.2 0.6V11'],
  m: [9.2, 'M1 3.6V11M1 5.4A1.8 1.8 0 0 1 4.6 5.4V11M4.6 5.4A1.8 1.8 0 0 1 8.2 5.4V11'],
  n: [6.1, 'M1 3.6V11M1 5.65A2.025 2.025 0 0 1 5.05 5.65V11'],
  o: [6, 'M0.95 5.65A2.025 2.025 0 0 1 5 5.65V8.95A2.025 2.025 0 0 1 0.95 8.95Z'],
  p: [6.1, 'M1 3.6V14M1 5.65A2.025 2.025 0 0 1 5.05 5.65V8.95A2.025 2.025 0 0 1 1 8.95'],
  q: [6, 'M5 3.6V14M5 5.65A2.025 2.025 0 0 0 0.95 5.65V8.95A2.025 2.025 0 0 0 5 8.95'],
  r: [4.8, 'M1 3.6V11M1 5.9A2.2 2.2 0 0 1 3.2 3.7H4.2'],
  s: [5.9, 'M4.63 4.67A1.85 1.85 0 1 0 2.95 7.3A1.85 1.85 0 1 1 1.27 9.93'],
  t: [5, 'M2.2 0.9V8.9A2.1 2.1 0 0 0 4.3 11H4.8M0.6 3.8H4.4'],
  u: [6.1, 'M1 3.6V8.95A2.025 2.025 0 0 0 5.05 8.95M5.05 3.6V11'],
  v: [5.8, 'M0.6 3.6L2.9 11L5.2 3.6'],
  w: [7.4, 'M0.5 3.6L2 11L3.7 5.4L5.4 11L6.9 3.6'],
  x: [5.8, 'M0.8 3.6L5 11M5 3.6L0.8 11'],
  y: [5.8, 'M0.6 3.6L3 10.6M5.2 3.6L1.9 14'],
  z: [5.9, 'M0.9 3.6H5L0.9 11H5'],
  // figures (tabular)
  0: [6.6, 'M0.9 3.4A2.4 2.4 0 0 1 5.7 3.4V8.6A2.4 2.4 0 0 1 0.9 8.6Z'],
  1: [6.6, 'M1.8 3.2L3.9 1V11'],
  2: [6.6, 'M0.95 3.5A2.45 2.45 0 0 1 5.85 3.5C5.85 5.6 0.95 8.2 0.95 11H5.9'],
  3: [6.6, 'M1 1H5.6L3.2 4.9A3.05 3.05 0 1 1 0.86 9.91'],
  4: [6.6, 'M4.6 11V1L0.8 8.2H6.1'],
  5: [6.6, 'M5.6 1H1.3V5H3.1A3 3 0 0 1 3.1 11H0.9'],
  6: [6.6, 'M4.7 1L0.95 7.1M0.7 8.4A2.6 2.6 0 1 0 5.9 8.4A2.6 2.6 0 1 0 0.7 8.4'],
  7: [6.6, 'M0.9 1H5.8L2.4 11'],
  8: [6.6, 'M0.9 3.5A2.4 2.4 0 1 0 5.7 3.5A2.4 2.4 0 1 0 0.9 3.5M0.75 8.45A2.55 2.55 0 1 0 5.85 8.45A2.55 2.55 0 1 0 0.75 8.45'],
  9: [6.6, 'M0.7 3.6A2.6 2.6 0 1 0 5.9 3.6A2.6 2.6 0 1 0 0.7 3.6M5.65 4.9L1.9 11'],
  // marks
  ' ': [3, ''],
  '\u00a0': [3, ''],
  '.': [2.4, 'M1.2 10.2V11'],
  ',': [2.4, 'M1.4 10.2V11L0.8 12.6'],
  ':': [2.4, 'M1.2 4.5V5.3M1.2 10.2V11'],
  '-': [4.8, 'M0.8 7.2H4'],
  '·': [3.4, 'M1.7 6.4V7.2'],
  '×': [6, 'M0.9 4.4L5.1 10.4M5.1 4.4L0.9 10.4'],
  '+': [5.6, 'M2.8 4.4V9.6M0.8 7H4.8'],
  '!': [2.4, 'M1.2 1V7.8M1.2 10.2V11'],
  '?': [6.6, 'M0.9 3.4A2.4 2.4 0 0 1 5.7 3.4C5.7 5.4 3.3 5.6 3.3 7.8M3.3 10.2V11'],
  "'": [2.4, 'M1.2 1V3.6'],
  '’': [2.4, 'M1.4 1V2.6L0.9 3.8'],
  '(': [3.8, 'M3 0.8Q0.6 6.8 3 12.8'],
  ')': [3.8, 'M0.8 0.8Q3.2 6.8 0.8 12.8'],
  '/': [5.4, 'M4.6 0.8L0.8 12'],
  '&': [7.4, 'M6.4 11L1.8 4.8A2.05 2.05 0 1 1 4.7 4.8L1.48 8.22A2.1 2.1 0 0 0 5.47 9.52L6.8 6.9'],
  '…': [6.4, 'M1.1 10.2V11M3.2 10.2V11M5.3 10.2V11'],
  '↑': [5.6, 'M2.8 11V2M0.6 4.6L2.8 1.8L5 4.6'],
  '↓': [5.6, 'M2.8 1V10M0.6 7.4L2.8 10.2L5 7.4'],
  '←': [7.4, 'M7 6H1.2M3.8 3.4L1 6L3.8 8.6'],
  '→': [7.4, 'M0.4 6H6.2M3.6 3.4L6.4 6L3.6 8.6'],
};

const glyph = (ch) => G[ch] ?? G[ch.toUpperCase()] ?? G['?'];
function sizeTo(svg, w) {
  svg.setAttribute('viewBox', `0 0 ${w.toFixed(2)} 14`);
  svg.style.width = (w / 14).toFixed(3) + 'em';
}

// a run of text as an inline svg, 1em tall; tracking in em, weight is the stroke in units
export function printSVG(text, { tracking = 0.12, weight = 1.35 } = {}) {
  const trk = tracking * 14;
  const svg = document.createElementNS(NS, 'svg');
  let x = 0;
  for (const ch of text) {
    const g = glyph(ch);
    if (g[1]) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', g[1]);
      if (x) p.setAttribute('transform', `translate(${x.toFixed(2)} 0)`);
      svg.appendChild(p);
    }
    x += g[0] + trk;
  }
  sizeTo(svg, Math.max(0.1, x - trk));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'pt');
  svg.style.strokeWidth = weight;
  return svg;
}

// a live number: glyph slots are reused, so a counter that changes every frame makes no garbage
export function printNumber({ tracking = 0.04, weight = 1.2, slots = 9, format = (v) => String(v) } = {}) {
  const trk = tracking * 14;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'pt');
  svg.style.strokeWidth = weight;
  const paths = Array.from({ length: slots }, () => svg.appendChild(document.createElementNS(NS, 'path')));
  let last = null, lastRaw;
  const api = {
    svg,
    set(v) {
      if (v === lastRaw) return;          // most frames the value has not moved: no formatting at all
      lastRaw = v;
      const str = typeof v === 'string' ? v : format(v);
      if (str === last) return;
      last = str;
      let x = 0;
      for (let i = 0; i < slots; i++) {
        const ch = str[i];
        if (ch === undefined) { paths[i].setAttribute('d', ''); continue; }
        const g = glyph(ch);
        paths[i].setAttribute('d', g[1]);
        paths[i].setAttribute('transform', `translate(${x.toFixed(2)} 0)`);
        x += g[0] + trk;
      }
      sizeTo(svg, Math.max(0.1, x - trk));
    },
  };
  api.set('0');
  return api;
}

// replace the text of an element (and its descendants) with printed svg, keeping the words
// for assistive tech in a visually hidden twin; sizes, tracking and case come from the CSS
export function printify(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const host = n.parentElement;
    if (host.closest('svg') || host.classList.contains('vh')) continue;
    const cs = getComputedStyle(host);
    const size = parseFloat(cs.fontSize) || 12;
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / size;
    const raw = n.nodeValue.replace(/[ \t\n\r]+/g, ' ');
    const text = cs.textTransform === 'uppercase' ? raw.toUpperCase() : raw;
    const weight = parseFloat(cs.getPropertyValue('--pw')) || 1.35;
    const frag = document.createDocumentFragment();
    const lead = /^\s/.test(raw), trail = /\s$/.test(raw);
    const words = text.trim().split(' ');
    if (lead) frag.appendChild(document.createTextNode(' '));
    // words stay separate svgs so long hints still wrap
    words.forEach((w, i) => {
      frag.appendChild(printSVG(w, { tracking: ls, weight }));
      if (i < words.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    if (trail) frag.appendChild(document.createTextNode(' '));
    const vh = document.createElement('span');
    vh.className = 'vh';
    vh.textContent = raw.trim();
    frag.appendChild(vh);
    n.replaceWith(frag);
  }
}
