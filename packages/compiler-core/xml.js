import { SourceFile, DiagnosticBag, CompileError } from './index.js';
const names = /^[A-Za-z_][\w.:-]*/;
function decode(text, offset) {
  return text.replace(/&([^;]+);/g, (_, e) => {
    const v = {lt:'<',gt:'>',amp:'&',quot:'"',apos:"'"}[e]; if (v !== undefined) return v;
    if (/^#x[0-9a-f]+$/i.test(e) || /^#\d+$/.test(e)) {
      const n = e[1] === 'x' ? parseInt(e.slice(2),16) : Number(e.slice(1));
      if (n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)) return String.fromCodePoint(n);
    }
    throw new CompileError('JB1003', `Unknown or invalid XML entity &${e};`, offset);
  });
}
/** Small, deterministic XML parser. External entities and DTDs are deliberately forbidden. */
export function parseXml(text, path = 'document.xaml') {
  const source = new SourceFile(path, text), diagnostics = new DiagnosticBag(); let i = 0;
  const fail = (m, at = i) => { throw new CompileError('JB1001', m, at); };
  const skip = () => { while (/\s/.test(text[i] ?? '') && i < text.length) i++; };
  const name = () => { const m = names.exec(text.slice(i)); if (!m) fail('Expected XML name'); i += m[0].length; return m[0]; };
  const trivia = () => {
    for (;;) {
      skip();
      if (text.startsWith('<!--', i)) { const end = text.indexOf('-->',i+4); if (end<0) fail('Unterminated comment'); i=end+3; }
      else if (text.startsWith('<?',i)) { const end=text.indexOf('?>',i+2); if(end<0)fail('Unterminated processing instruction');i=end+2; }
      else break;
    }
  };
  function element() {
    const start=i; if (text[i++] !== '<') fail('Expected <');
    if (text[i] === '!') fail('DTD and XML entity declarations are not supported',start);
    const tag=name(), attributes={}, attributeSpans={}; skip();
    while (i<text.length && text[i] !== '>' && !text.startsWith('/>',i)) {
      const pos=i, key=name(); skip(); if(text[i++]!=='=')fail('Expected ='); skip(); const quote=text[i++];
      if(quote!=='"' && quote!=="'")fail('Expected quoted attribute');
      const s=i,end=text.indexOf(quote,i); if(end<0)fail('Unterminated attribute');
      if(Object.hasOwn(attributes,key))fail(`Duplicate attribute ${key}`,pos);
      attributes[key]=decode(text.slice(s,end),s);attributeSpans[key]={start:pos,end:end+1}; i=end+1;skip();
    }
    const node={kind:'element',tag,attributes,attributeSpans,children:[],span:{start,end:i}};
    if(text.startsWith('/>',i)) {i+=2;node.span.end=i;return node;}
    if(text[i++]!=='>')fail('Expected >');
    while(i<text.length) {
      if(text.startsWith('</',i)) {i+=2;const close=name();skip();if(text[i++]!=='>')fail('Expected >');if(close!==tag)fail(`Expected </${tag}>, found </${close}>`);node.span.end=i;return node;}
      if(text.startsWith('<!--',i)){const end=text.indexOf('-->',i+4);if(end<0)fail('Unterminated comment');i=end+3;continue;}
      if(text.startsWith('<![CDATA[',i)){const s=i,end=text.indexOf(']]>',i+9);if(end<0)fail('Unterminated CDATA');node.children.push({kind:'text',text:text.slice(i+9,end),span:{start:s,end:end+3}});i=end+3;continue;}
      if(text[i]==='<')node.children.push(element());
      else {const s=i;while(i<text.length&&text[i]!=='<')i++;const value=decode(text.slice(s,i),s);if(value.trim())node.children.push({kind:'text',text:value,span:{start:s,end:i}});}
    }
    fail(`Unclosed <${tag}>`,start);
  }
  let root=null;
  try {if(text.charCodeAt(0)===0xfeff)i++;trivia();root=element();trivia();if(i!==text.length)fail('Unexpected content after XML root');}
  catch(e){if(!(e instanceof CompileError))throw e;diagnostics.add(e.code,e.message,source,e.offset);}
  return {root,source,diagnostics:diagnostics.items};
}
