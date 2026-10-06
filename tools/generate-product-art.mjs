import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('apps/web/public/assets/products');
const palette = [
  ['#1B232C', '#A4AFB7'], ['#C6B8A5', '#6C665E'], ['#7C725D', '#C5A46B'],
  ['#49606B', '#D8E1E1'], ['#647063', '#B7C0A9'],
];
const names = [
  'arc-headphones', 'studio-headphones', 'fold-headphones', 'commute-earbuds', 'reference-earbuds', 'wireless-earbuds',
  'orbit-speaker', 'field-speaker', 'soundbar-mini', 'room-speaker', 'pocket-speaker', 'studio-monitor',
  'frame-camera', 'compact-camera', 'travel-camera', 'instant-camera', 'action-camera', 'film-camera',
  'desk-lamp', 'mechanical-keyboard', 'wireless-mouse', 'display-light', 'monitor-stand', 'desk-hub',
  'power-bank', 'charging-dock', 'travel-adapter', 'cable-kit', 'wireless-charger', 'solar-charger',
];
const shapes = [
  `<path d="M310 380v-82a190 190 0 0 1 380 0v82" fill="none" stroke="url(#metal)" stroke-width="42" stroke-linecap="round"/><rect x="272" y="365" width="100" height="180" rx="48" fill="url(#product)"/><rect x="628" y="365" width="100" height="180" rx="48" fill="url(#product)"/>`,
  `<rect x="285" y="235" width="430" height="360" rx="68" fill="url(#product)"/><circle cx="500" cy="410" r="140" fill="#121920" opacity=".58"/><circle cx="500" cy="410" r="88" fill="none" stroke="url(#metal)" stroke-width="20"/>`,
  `<rect x="265" y="275" width="470" height="325" rx="42" fill="url(#product)"/><circle cx="500" cy="438" r="118" fill="#17212A"/><circle cx="500" cy="438" r="87" fill="url(#metal)"/><circle cx="500" cy="438" r="62" fill="#17212A"/>`,
  `<path d="M280 270h440l65 300H215z" fill="url(#product)"/><rect x="290" y="300" width="420" height="34" rx="12" fill="url(#metal)"/><g fill="#E7E5DD" opacity=".65"><rect x="305" y="365" width="72" height="56" rx="9"/><rect x="390" y="365" width="72" height="56" rx="9"/><rect x="475" y="365" width="72" height="56" rx="9"/><rect x="560" y="365" width="72" height="56" rx="9"/></g>`,
  `<rect x="305" y="240" width="390" height="370" rx="50" fill="url(#product)"/><rect x="345" y="280" width="310" height="278" rx="25" fill="#1A252C" opacity=".55"/><path d="M430 405h140" stroke="url(#metal)" stroke-width="27" stroke-linecap="round"/><circle cx="500" cy="405" r="85" fill="none" stroke="url(#metal)" stroke-width="16"/>`,
];
await mkdir(out, { recursive: true });
for (let index = 0; index < names.length; index += 1) {
  const group = Math.floor(index / 6);
  for (let view = 0; view < 2; view += 1) {
    const [dark, light] = palette[index % palette.length];
    const shape = shapes[group] ?? shapes[0];
    const transform = view === 0 ? '' : 'translate(40 -10) rotate(8 500 415) scale(.95)';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800" role="img" aria-label="${names[index]} product illustration">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#EDEBE6"/><stop offset="1" stop-color="#D7D7D0"/></linearGradient><linearGradient id="product" x2="1" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient><linearGradient id="metal" x2="1" y2="1"><stop stop-color="#ECE7DA"/><stop offset="1" stop-color="#8C8578"/></linearGradient></defs>
<rect width="1000" height="800" fill="url(#bg)"/><circle cx="770" cy="170" r="250" fill="#fff" opacity=".15"/><ellipse cx="500" cy="650" rx="275" ry="45" fill="#333" opacity=".10"/><g transform="${transform}">${shape}</g>
</svg>`;
    await writeFile(resolve(out, `${names[index]}-${view + 1}.svg`), svg);
  }
}
