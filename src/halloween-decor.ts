/**
 * Halloween pumpkins drawn for our own offer banners: original vector art,
 * no emoji, no third-party assets. Plain SVG strings, so any product can use
 * them: React (see components/halloween-offer.tsx), plain DOM
 * (`element.innerHTML = HALLOWEEN_DECOR_LEFT`) or a static page (paste it).
 *
 * Each string is self-contained: gradients carry their own id prefix and the
 * flicker animation is in an embedded <style> that switches itself off under
 * prefers-reduced-motion. Needs `style-src 'unsafe-inline'` (or a nonce) if
 * a page's CSP is stricter than ours. Always decorative: mark the container
 * aria-hidden.
 */

type Face = "grin" | "sly" | "cheeky";

function defs(p: string): string {
  return `<defs>
<radialGradient id="${p}-body" cx="38%" cy="32%" r="78%"><stop offset="0" stop-color="#ffbf73"/><stop offset=".42" stop-color="#f4802a"/><stop offset=".78" stop-color="#c84a12"/><stop offset="1" stop-color="#6e2507"/></radialGradient>
<radialGradient id="${p}-center" cx="45%" cy="30%" r="80%"><stop offset="0" stop-color="#ffcb86"/><stop offset=".45" stop-color="#f88d33"/><stop offset=".82" stop-color="#cf5214"/><stop offset="1" stop-color="#7a2b08"/></radialGradient>
<radialGradient id="${p}-side" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="#ea8a40"/><stop offset=".5" stop-color="#c9551a"/><stop offset=".85" stop-color="#8c330c"/><stop offset="1" stop-color="#4f1a05"/></radialGradient>
<linearGradient id="${p}-stem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9c8a44"/><stop offset="1" stop-color="#4a3c19"/></linearGradient>
<linearGradient id="${p}-leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9dbb57"/><stop offset="1" stop-color="#4b6422"/></linearGradient>
<radialGradient id="${p}-light" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#fffbe2"/><stop offset=".32" stop-color="#ffe27a"/><stop offset=".7" stop-color="#ffaa36"/><stop offset="1" stop-color="#ff7417"/></radialGradient>
<radialGradient id="${p}-shadow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}-aura" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff6a3d" stop-opacity=".55"/><stop offset="1" stop-color="#ff6a3d" stop-opacity="0"/></radialGradient>
<filter id="${p}-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>
<filter id="${p}-bloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
</defs>`;
}

const STYLE = `<style>
.hw-flicker{animation:hw-flicker 3.8s ease-in-out infinite}
.hw-aura{animation:hw-breathe 5.5s ease-in-out infinite}
@keyframes hw-flicker{0%,100%{opacity:.82}38%{opacity:1}52%{opacity:.68}68%{opacity:.94}}
@keyframes hw-breathe{0%,100%{opacity:.35}50%{opacity:.62}}
@media (prefers-reduced-motion:reduce){.hw-flicker,.hw-aura{animation:none}}
</style>`;

// Carved faces, all with slanted almond eyes under angled brows and a wide
// crescent grin whose corners climb towards the eyes; sharp, uneven teeth.
// Mischievous rather than gory.
const FACES: Record<Face, string> = {
  grin: `<path d="M30 42.6Q37.8 36.4 46.6 47.6Q36.8 50.4 30 42.6Z"/><path d="M70 42.6Q62.2 36.4 53.4 47.6Q63.2 50.4 70 42.6Z"/><path d="M30.4 32.2 44.8 37.6 43.6 40.2 29.8 35Z"/><path d="M69.6 32.2 55.2 37.6 56.4 40.2 70.2 35Z"/><path d="M47.6 52.4 52.4 52.4 50 56.2Z"/><path d="M25.5 52.5 30.6 58.4 33.4 57.6 35.6 62.6 38.6 60.2 41.4 65.2 44.6 61.8 47.6 66.4 50.6 62.4 53.6 66.6 56.6 61.8 59.6 65 62.4 60 65.4 62.4 67.4 57.4 70 58.2 74.5 52.5 72.2 62.6 68.2 68.6 65.4 64.8 62.6 71 59.4 67.2 55.6 73.4 52.4 69.2 48.4 74.2 45.2 69.4 41.6 72.6 38.8 67.4 35.4 69.8 33.6 64.4 30.4 64.6Z"/>`,
  sly: `<path d="M30.6 43.4Q38 37.2 46.4 47.2Q37 50.2 30.6 43.4Z"/><path d="M69.4 45Q61.4 40.8 53.6 46.8Q62.2 48.6 69.4 45Z"/><path d="M29.8 34.4 45.4 38.8 44.4 41.4 29.2 37.2Z"/><path d="M70.8 36.4 54.8 40.8 55.8 43.2 71.4 39.2Z"/><path d="M48 52.6 52 52.6 50 55.8Z"/><path d="M27 55.6 32.4 60.4 35.4 58.6 38.2 63.6 42 60.4 45.6 65 49.6 61.2 53.4 65.4 57.4 60.8 61 63.8 64.2 58.4 67.6 59.4 72.6 50.6 70.4 61.4 66.6 67.2 63.6 63.6 60.8 70.2 57.6 66.8 53.6 73 50.4 69.4 46.6 73.6 43.2 69 39.8 71.4 37.2 66.6 33.6 67.8 31.8 63Z"/>`,
  cheeky: `<path d="M32 43Q39.4 37 46.4 47Q38 49.6 32 43Z"/><path d="M68 43Q60.6 37 53.6 47Q62 49.6 68 43Z"/><path d="M31.6 34 45 38.8 43.9 41.2 31 36.6Z"/><path d="M68.4 34 55 38.8 56.1 41.2 69 36.6Z"/><path d="M28.5 54.5 34.6 60.6 39 59 42.4 64.4 46.4 60.8 50 65.4 53.6 60.8 57.6 64.4 61 59 65.4 60.6 71.5 54.5 68.6 64.4 62.8 70.6 58.4 67 54.6 72.2 50 68.6 45.4 72.2 41.6 67 37.2 70.6 31.4 64.4Z"/>`,
};

function face(p: string, kind: Face): string {
  const shapes = FACES[kind];
  // The carving: a dark rim for depth, the candlelit cut, then two blooms of
  // warm light, the inner one flickering.
  return `<g fill="#ff8a1f" opacity=".38" filter="url(#${p}-bloom)">${shapes}</g>
<g fill="#3a1003" stroke="#3a1003" stroke-width="2.4" stroke-linejoin="round">${shapes}</g>
<g fill="url(#${p}-light)">${shapes}</g>
<g class="hw-flicker" fill="#fff0b0" opacity=".85" filter="url(#${p}-blur)">${shapes}</g>`;
}

/** One pumpkin in a 100x95 box. */
function pumpkin(p: string, kind: Face): string {
  return `<ellipse cx="50" cy="89" rx="38" ry="5.5" fill="url(#${p}-shadow)"/>
<ellipse cx="25.5" cy="57" rx="21.5" ry="29" fill="url(#${p}-side)"/>
<ellipse cx="74.5" cy="57" rx="21.5" ry="29" fill="url(#${p}-side)"/>
<ellipse cx="37.5" cy="56" rx="22" ry="32.5" fill="url(#${p}-body)" stroke="#6e2507" stroke-opacity=".35"/>
<ellipse cx="62.5" cy="56" rx="22" ry="32.5" fill="url(#${p}-body)" stroke="#6e2507" stroke-opacity=".35"/>
<ellipse cx="50" cy="55" rx="18.5" ry="33.5" fill="url(#${p}-center)" stroke="#6e2507" stroke-opacity=".3"/>
<ellipse cx="40" cy="38" rx="5" ry="10" fill="#fff" opacity=".16" transform="rotate(-18 40 38)"/>
<ellipse cx="57" cy="34" rx="3" ry="6" fill="#fff" opacity=".12" transform="rotate(12 57 34)"/>
<path d="M47.5 24C46.6 16.5 48.4 10.6 54.3 6.4 56.2 5.2 58.3 7.2 56.6 8.9 53.4 12.1 52.6 16.6 53.4 24Z" fill="url(#${p}-stem)"/>
<path d="M55.5 13.5C62 5.8 72.4 5.4 77.5 9.6 71.4 10.6 64.6 14.6 57.6 17.6Z" fill="url(#${p}-leaf)"/>
<path d="M57.6 17.6C63.5 13.6 69.6 11 75.5 10.2" stroke="#3f561b" stroke-width=".8" fill="none" stroke-linecap="round"/>
<path d="M52.6 20.5C59.6 23.2 64.2 19.2 62.4 15.4 60.8 12.2 56.4 13.4 57.8 16.6" stroke="#6f7d35" stroke-width="1.3" fill="none" stroke-linecap="round"/>
${face(p, kind)}`;
}

function svg(p: string, viewBox: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" focusable="false" aria-hidden="true">${STYLE}${defs(p)}${body}</svg>`;
}

/** A grinning carved pumpkin with a smaller cheeky one behind it, for the left corner. */
export const HALLOWEEN_DECOR_LEFT = svg(
  "hwl",
  "0 0 150 100",
  `<ellipse class="hw-aura" cx="52" cy="60" rx="56" ry="40" fill="url(#hwl-aura)"/>
<g transform="translate(74 34) scale(.6)">${pumpkin("hwl", "cheeky")}</g>
<g transform="translate(2 6) scale(.94)">${pumpkin("hwl", "grin")}</g>`,
);

/** A single carved pumpkin with a sly, lopsided grin, for the right corner. */
export const HALLOWEEN_DECOR_RIGHT = svg(
  "hwr",
  "0 0 104 100",
  `<ellipse class="hw-aura" cx="52" cy="62" rx="50" ry="36" fill="url(#hwr-aura)"/>
<g transform="translate(6 14) scale(.86)">${pumpkin("hwr", "sly")}</g>`,
);
