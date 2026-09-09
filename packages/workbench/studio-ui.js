/** Small DOM primitives shared by the Studio tool windows. Icons are local SVG paths. */
const paths = {
  play: 'm5 3 9 5-9 5Z', stop: 'M4 4h8v8H4Z', pause: 'M5 3v10M11 3v10',
  restart: 'M3 7a5 5 0 1 1 1 5M3 3v4h4', over: 'M3 8a5 5 0 0 1 10 0M10 5l3 3 2-3M8 11v3',
  into: 'M8 2v9m-4-4 4 4 4-4M4 14h8', out: 'M8 12V2M4 6l4-4 4 4M4 14h8',
  code: 'm5 4-4 4 4 4m6-8 4 4-4 4M9 2 7 14', design: 'M2 2h12v12H2ZM2 6h12M6 6v8',
  split: 'M2 2h12v12H2ZM8 2v12', bug: 'M5 5h6v5a3 3 0 0 1-6 0ZM6 5V3h4v2M2 6h3m6 0h3M2 10h3m6 0h3M3 14l3-2m4 0 3 2',
  flame: 'M9 1c1 5-3 4-3 7-1-1-2-2-2-2-3 6 1 9 4 9s7-4 3-8c0 3-2 2-2-1Z',
  box: 'm8 1 6 3v8l-6 3-6-3V4Zm-6 3 6 3 6-3M8 7v8', files: 'M5 1h7l3 3v9H5ZM1 4v11h10M11 1v4h4',
  folder: 'M1 4V2h5l2 2h7v10H1Z', save: 'M2 1h10l2 2v12H2ZM5 1v5h6V1M5 10h6v5',
  close: 'm4 4 8 8M12 4l-8 8', check: 'm3 8 3 3 7-7', search: 'M10 10l4 4M11 6a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  chevron: 'm6 3 5 5-5 5', settings: 'M6 2h4l1 3 3 1v4l-3 1-1 3H6l-1-3-3-1V6l3-1ZM6 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  tree: 'M3 1v10h4M3 5h4M7 3h7v4H7ZM7 9h7v4H7Z', break: 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Z',
};
export function icon(doc, name) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({viewBox: '0 0 16 16', width: '16', height: '16', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.35', 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'aria-hidden': 'true'})) svg.setAttribute(key, value);
  const path = doc.createElementNS(svg.namespaceURI, 'path');path.setAttribute('d', paths[name] ?? paths.box);svg.append(path);return svg;
}
export function element(doc, tag, text, attrs = {}) {
  const node = doc.createElement(tag);if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));return node;
}
export function action(doc, id, label, glyph, callback, shortcut = '') {
  const b = element(doc, 'button', undefined, {id, type: 'button', title: label + (shortcut ? ' · ' + shortcut : ''), 'aria-label': label});
  if (glyph) b.append(icon(doc, glyph));b.append(element(doc, 'span', label));b.addEventListener('click', callback);return b;
}
/** Manual activation keeps keyboard navigation separate from expensive tool activation. */
export function tabKeys(tablist, activate) {
  const handler = e => {
    if (e.target.getAttribute('role') !== 'tab') return;
    const tabs = [...tablist.querySelectorAll('[role=tab]')], at = tabs.indexOf(e.target);
    const next = e.key === 'ArrowRight' ? (at + 1) % tabs.length : e.key === 'ArrowLeft' ? (at + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (next !== null) {e.preventDefault();tabs[next]?.focus();}
    else if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();activate(e.target);}
  };
  tablist.addEventListener('keydown', handler);return () => tablist.removeEventListener('keydown', handler);
}
