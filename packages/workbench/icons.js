/** Original lightweight SVG glyphs. UI assets are local and do not require a font or CDN. */
const paths={
  file:'M5 2h6l4 4v12H5z M11 2v5h4', folder:'M2 5h6l2 2h8v10H2z',
  solution:'M3 3h5v5H3z M12 3h5v5h-5z M3 12h5v5H3z M12 12h5v5h-5z',
  code:'m7 5-5 5 5 5m6-10 5 5-5 5m-2-12-2 14',
  design:'M3 3h14v14H3z M3 8h14 M8 8v9', debug:'M7 6h6v9H7z M8 6V3h4v3 M3 8h4m6 0h4M3 12h4m6 0h4m-9 4-2 2m8-2 2 2',
  play:'m6 3 11 7-11 7z', pause:'M6 4v12M14 4v12', stop:'M5 5h10v10H5z', restart:'M4 7a7 7 0 1 1-1 6M4 2v5h5',
  step:'M3 3h7v9m-4-4 4 4 4-4M3 17h14', into:'M10 2v10m-4-4 4 4 4-4M3 17h14', out:'M10 12V2m-4 4 4-4 4 4M3 17h14',
  save:'M3 3h12l2 2v12H3z M6 3v5h8V3 M6 17v-6h8v6', undo:'M7 4 2 8l5 4M2 8h9a5 5 0 0 1 0 10', redo:'m13 4 5 4-5 4M18 8h-9a5 5 0 0 0 0 10',
  search:'M14 9a5 5 0 1 1-10 0 5 5 0 0 1 10 0zm-1 4 5 5', chevron:'m7 4 6 6-6 6', down:'m4 7 6 6 6-6',
  close:'m5 5 10 10m0-10L5 15', pin:'m7 2 7 2-2 6 3 3-1 1-5-2-3 4-2-1 2-5-1-4z M7 13l-4 5',
  settings:'m8 2 4 0 1 3 3 1 2 3-2 3-1 3-3 3-4-1-3-2-2-3V8l3-2z M13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  error:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0z M7 7l6 6m0-6-6 6',warning:'M10 2 19 18H1z M10 7v5m0 2v1',
  check:'m3 10 4 4 10-9', plus:'M10 3v14M3 10h14', minus:'M3 10h14', refresh:'M4 7a7 7 0 1 1 0 7M4 2v5h5',
  toolbox:'M2 7h16v10H2z M6 7V3h8v4M2 11h16M8 10v3h4v-3', tree:'M10 2v6M4 8h12M4 8v5m12-5v5M2 14h4v4H2z M14 14h4v4h-4z M8 2h4v4H8z',
  target:'M10 1v4m0 10v4M1 10h4m10 0h4 M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0z',
  eye:'M1 10s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z M12 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  terminal:'m3 5 5 5-5 5M10 15h7', package:'m2 6 8-4 8 4v9l-8 4-8-4z M2 6l8 4 8-4m-8 4v9',
  bolt:'M12 1 4 11h6l-2 8 8-11h-6z', sun:'M10 1v2m0 14v2M1 10h2m14 0h2M4 4l1 1m10 10 1 1M16 4l-1 1M5 15l-1 1M14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  grid:'M3 3h14v14H3z M3 8h14M3 12h14M8 3v14M12 3v14', link:'m8 13-1 1a3 3 0 0 1-4-4l3-3a3 3 0 0 1 4 0m2 0 1-1a3 3 0 1 1 4 4l-3 3a3 3 0 0 1-4 0M7 13l6-6',
  more:'M4 10h.1M10 10h.1M16 10h.1', window:'M2 3h16v14H2z M2 7h16', expand:'M2 7V2h5m6 0h5v5M2 13v5h5m6 0h5v-5',
};
export function icon(name,doc=globalThis.document){const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.4');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.classList.add('studio-icon');const p=doc.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]??paths.file);svg.append(p);return svg;}
export function labelIcon(button,name,label,{compact=false,doc=button.ownerDocument}={}){button.replaceChildren(icon(name,doc));const text=doc.createElement('span');text.textContent=label;if(compact)text.className='sr-only';button.append(text);button.setAttribute('aria-label',label);}
