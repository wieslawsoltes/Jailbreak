/** Serializable IDE state. No application code, browser globals or runtime instances. */
export function studioPreferences(value = {}) {
  const oneOf = (v, choices, fallback) => choices.includes(v) ? v : fallback;
  return {
    perspective: oneOf(value.perspective, ['split', 'source', 'design', 'binary'], 'split'),
    tools: oneOf(value.tools, ['all', 'design', 'debug'], 'all'),
    bottom: oneOf(value.bottom, ['problems', 'output', 'stack', 'locals', 'watch', 'breakpoints'], 'problems'),
    fontSize: Number.isFinite(value.fontSize) ? Math.max(11, Math.min(20, value.fontSize)) : 13,
  };
}

export function visibleLines(count, scrollTop, height, lineHeight, padding = 14) {
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(lineHeight) || lineHeight <= 0) return [];
  const first = Math.max(1, Math.floor((Math.max(0, scrollTop) - padding) / lineHeight) + 1);
  const last = Math.min(count, first + Math.ceil(Math.max(0, height) / lineHeight) + 2);
  return Array.from({length: Math.max(0, last - first + 1)}, (_, i) => ({line: first + i, top: padding + (first + i - 1) * lineHeight - scrollTop}));
}

export function diagnosticMatches(d, {query = '', severity = 'all'} = {}) {
  return (severity === 'all' || (d.severity ?? 'error') === severity) &&
    [d.code, d.file, d.message].join(' ').toLowerCase().includes(query.toLowerCase());
}

export function valueText(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value !== 'object') return String(value);
  return Array.isArray(value) ? `Array (${value.length})` : `{ ${Object.keys(value).slice(0, 5).join(', ')}${Object.keys(value).length > 5 ? ', …' : ''} }`;
}

/** Indent/outdent preserves original newline bytes and returns an exact edit. */
export function indentSource(text, start, end, outdent = false, size = 4) {
  if (typeof text !== 'string' || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > text.length || !Number.isInteger(size) || size < 1 || size > 8) throw new RangeError('Invalid editor selection');
  if (start === end && !outdent) return {text: text.slice(0, start) + ' '.repeat(size) + text.slice(end), start: start + size, end: start + size};
  const first = text.lastIndexOf('\n', start - 1) + 1;
  let last = text.indexOf('\n', Math.max(start, end - 1));
  if (last < 0) last = text.length;
  const lines = text.slice(first, last).split('\n');
  let shift = 0, firstShift = 0;
  const changed = lines.map((line, index) => {
    const count = outdent ? (line.startsWith('\t') ? 1 : Math.min(size, /^ */.exec(line)[0].length)) : 0;
    const delta = outdent ? -count : size;
    if (!index) firstShift = delta;
    shift += delta;
    return outdent ? line.slice(count) : ' '.repeat(size) + line;
  }).join('\n');
  return {text: text.slice(0, first) + changed + text.slice(last), start: Math.max(first, start + firstShift), end: Math.max(first, end + shift)};
}

/** Folder records use Map so filenames cannot mutate object prototypes. */
export function fileHierarchy(paths) {
  const root = {name: '', path: '', folders: new Map(), files: []};
  for (const path of [...paths].sort()) {
    const pieces = path.replace(/\\/g, '/').split('/');
    let node = root, prefix = '';
    for (const part of pieces.slice(0, -1)) {
      prefix += part + '/';
      if (!node.folders.has(part)) node.folders.set(part, {name: part, path: prefix, folders: new Map(), files: []});
      node = node.folders.get(part);
    }
    node.files.push({name: pieces.at(-1), path});
  }
  return root;
}
