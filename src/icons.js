// Thin line icons in the same stroke grammar as the type (butt caps, beveled acute joins).
const NS = 'http://www.w3.org/2000/svg';
const I = {
  pause: 'M9 5V19M15 5V19',
  play: 'M8 5L19 12L8 19Z',
  sound: 'M4 9.5H7.5L12 6V18L7.5 14.5H4ZM15.5 9A4 4 0 0 1 15.5 15M18.2 6.4A7.6 7.6 0 0 1 18.2 17.6',
  mute: 'M4 9.5H7.5L12 6V18L7.5 14.5H4ZM15.5 9.5L20.5 14.5M20.5 9.5L15.5 14.5',
  restart: 'M5.6 12A6.4 6.4 0 1 0 7.5 7.4M7.6 3.8V7.6H3.8',
  fish: 'M21 12C18.4 7.6 12 7.2 8.6 10.8L3.5 7.5L4.9 12L3.5 16.5L8.6 13.2C12 16.8 18.4 16.4 21 12ZM16.4 10.6V11.4',
  thermos: 'M9.5 3H14.5V5.5H9.5ZM8.5 6.5H15.5A1 1 0 0 1 16.5 7.5V19A2 2 0 0 1 14.5 21H9.5A2 2 0 0 1 7.5 19V7.5A1 1 0 0 1 8.5 6.5ZM7.5 11H16.5',
  // the golden fish is the magnet pickup: the fish, with three short rays of shine
  goldfish: 'M21 13.5C18.4 9.1 12 8.7 8.6 12.3L3.5 9L4.9 13.5L3.5 18L8.6 14.7C12 18.3 18.4 17.9 21 13.5ZM16.4 12.1V12.9M13 2.8V5.6M8.4 4.4L9.9 6.6M17.6 4.4L16.1 6.6',
};

export function icon(name, weight = 1.6) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ico');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', I[name]);
  svg.appendChild(p);
  svg.style.strokeWidth = weight;
  return svg;
}
export function setIcon(svg, name) { svg.firstChild.setAttribute('d', I[name]); }
