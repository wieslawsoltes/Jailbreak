/** Source locations and diagnostics shared by every compiler. No browser dependencies. */
export class SourceFile {
  constructor(path, text) {
    if (typeof text !== 'string') throw new TypeError('Source text must be a string');
    this.path = path; this.text = text; this.lines = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') this.lines.push(i + 1);
  }
  location(offset = 0) {
    offset = Math.min(Math.max(offset, 0), this.text.length);
    let lo = 0, hi = this.lines.length;
    while (lo + 1 < hi) { const m = (lo + hi) >>> 1; if (this.lines[m] <= offset) lo = m; else hi = m; }
    return { file: this.path, offset, line: lo + 1, column: offset - this.lines[lo] + 1 };
  }
}
export class DiagnosticBag {
  constructor() { this.items = []; }
  add(code, message, source, offset = 0, severity = 'error', length = 1) {
    const d = { code, message, severity, length, ...(source?.location(offset) ?? { file: '', line: 1, column: 1, offset }) };
    this.items.push(d); return d;
  }
  get hasErrors() { return this.items.some(x => x.severity === 'error'); }
  merge(other) { this.items.push(...(other.items ?? other)); }
}
export class CompileError extends Error {
  constructor(code, message, offset = 0) { super(message); this.code = code; this.offset = offset; }
}
export function escapeJs(value) { return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
export function identifier(name) { return name.replace(/[^\w$]/g, '_'); }
export function hash(text) { let n = 2166136261; for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619); return (n >>> 0).toString(16); }
/** Split a markup extension argument list without splitting nested braces/quoted strings. */
export function splitTopLevel(text, separator = ',') {
  const out = []; let start = 0, depth = 0, quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote && text[i - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if ('{(['.includes(c)) depth++;
    else if ('})]'.includes(c)) depth--;
    else if (c === separator && depth === 0) { out.push(text.slice(start, i).trim()); start = i + 1; }
  }
  out.push(text.slice(start).trim()); return out;
}
