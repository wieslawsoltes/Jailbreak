/** Source-aware diagnostics shared by all compiler frontends. */
export class CompileError extends Error {
  constructor(code, message, source = '', offset = 0, file = '') {
    super(message); this.name = 'CompileError';
    const head = source.slice(0, offset), line = head.split('\n').length;
    this.diagnostic = { code, severity: 'error', message, file, offset, line, column: offset - head.lastIndexOf('\n') };
  }
}
export function diagnostic(code, message, file = '', severity = 'error', node = {}) {
  return {code, message, file, severity, line: node.line || 1, column: node.column || 1, offset: node.offset || 0};
}
export function failure(error, file = '') {
  if (error instanceof CompileError) return {...error.diagnostic, file: error.diagnostic.file || file};
  return diagnostic('JB0001', error.message || String(error), file);
}
export function location(source, offset) {
  const head = source.slice(0, offset);
  return {offset, line: head.split('\n').length, column: offset - head.lastIndexOf('\n')};
}
export function hashText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}
/** XML 1.0 subset: elements, quoted attrs, entities, comments, PI and CDATA; no DTD/XXE. */
export function parseXml(source, {file = '', maxNodes = 100000, maxDepth = 256} = {}) {
  let i = 0, count = 0; const roots = [], stack = [];
  const fail = (message, at = i) => {throw new CompileError('JB1001', message, source, at, file);};
  const ws = () => {while (/\s/.test(source[i] || '') && i < source.length) i++;};
  const name = () => {const m = /^[A-Za-z_][\w.:-]*/.exec(source.slice(i)); if (!m) fail('Expected XML name'); i += m[0].length; return m[0];};
  function decode(s, at) {
    return s.replace(/&([^;\s]+);|&/g, (all, entity, delta) => {
      const known = {lt:'<',gt:'>',amp:'&',quot:'"',apos:"'"};
      if (Object.hasOwn(known, entity)) return known[entity];
      if (entity && /^#(?:x[0-9a-fA-F]+|[0-9]+)$/.test(entity)) {
        const cp = entity[1] === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1));
        if ((cp === 9 || cp === 10 || cp === 13 || cp >= 32) && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) && cp !== 0xfffe && cp !== 0xffff) return String.fromCodePoint(cp);
      }
      fail(`Invalid or undeclared XML entity ${all}`, at + delta);
    });
  }
  function text(s, at, raw = false) {
    if (!stack.length) {if (s.trim()) fail('Text outside the root element', at); return;}
    stack.at(-1).children.push({kind:'text', value:raw ? s : decode(s,at), ...location(source,at)});
  }
  while (i < source.length) {
    if (source[i] !== '<') {const start = i; while (i < source.length && source[i] !== '<') i++; text(source.slice(start,i),start); continue;}
    if (source.startsWith('<!--',i)) {const end=source.indexOf('-->',i+4); if(end<0)fail('Unterminated XML comment'); if(source.slice(i+4,end).includes('--'))fail('Invalid XML comment'); i=end+3; continue;}
    if (source.startsWith('<?',i)) {const end=source.indexOf('?>',i+2); if(end<0)fail('Unterminated processing instruction'); i=end+2; continue;}
    if (source.startsWith('<![CDATA[',i)) {const start=i+9,end=source.indexOf(']]>',start);if(end<0)fail('Unterminated CDATA');text(source.slice(start,end),start,true);i=end+3;continue;}
    if (source.startsWith('<!',i)) fail('DTD and external entities are not supported');
    if (source.startsWith('</',i)) {i+=2; const tag=name(); ws(); if(source[i++]!=='>')fail('Expected >'); const open=stack.pop(); if(!open||open.tag!==tag)fail(`Mismatched closing tag ${tag}`);continue;}
    const start=i++; const tag=name(), attrs=Object.create(null), attrLocations=Object.create(null);
    ws();
    while(i<source.length && source[i]!=='>' && !source.startsWith('/>',i)) {
      const at=i,key=name(); if(Object.hasOwn(attrs,key))fail(`Duplicate attribute ${key}`,at);
      ws();if(source[i++]!=='=')fail('Expected = after attribute name');ws();const quote=source[i++];if(quote!=="'"&&quote!=='"')fail('Attributes must be quoted');
      const begin=i;while(i<source.length&&source[i]!==quote){if(source[i]==='<')fail('Unescaped < in attribute');i++;}if(i>=source.length)fail('Unterminated attribute');
      attrs[key]=decode(source.slice(begin,i),begin);attrLocations[key]=location(source,at);i++; if(i<source.length&&!/\s|>|\//.test(source[i]))fail('Expected whitespace between attributes');ws();
    }
    if(i>=source.length)fail('Unterminated element');
    const empty=source.startsWith('/>',i);i+=empty?2:1;
    const node={kind:'element',tag,attrs,attrLocations,children:[],...location(source,start)};
    if(++count>maxNodes)fail('XML node budget exceeded',start);
    if(stack.length)stack.at(-1).children.push(node);else roots.push(node);
    if(!empty){stack.push(node);if(stack.length>maxDepth)fail('XML nesting budget exceeded',start);}
  }
  if(stack.length)fail(`Unclosed element ${stack.at(-1).tag}`,stack.at(-1).offset);
  if(roots.length!==1)fail('A document must contain exactly one root element',0);
  return roots[0];
}
export const elements = node => node.children.filter(x => x.kind === 'element');
export const textContent = node => node.children.map(x => x.kind === 'text' ? x.value : textContent(x)).join('');
