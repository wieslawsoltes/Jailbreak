import { SourceFile, DiagnosticBag } from '../compiler-core/index.js';

const symbolPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Evaluate the C# conditional-directive grammar, never JavaScript source. */
export function evaluateDirective(expression, symbols = new Set(), maxDepth = 128) {
  let i = 0, depth = 0;
  const tokens = [];
  while (i < expression.length) {
    if (/\s/.test(expression[i])) { i++; continue; }
    const match = /^(?:&&|\|\||==|!=|[!()]|[A-Za-z_][A-Za-z0-9_]*)/.exec(expression.slice(i));
    if (!match) throw new Error(`Invalid conditional token at column ${i + 1}`);
    tokens.push(match[0]); i += match[0].length;
  }
  tokens.push('<end>'); i = 0;
  const take = value => tokens[i] === value ? (++i, true) : false;
  function atom() {
    if (++depth > maxDepth) throw new Error('Conditional expression nesting budget exceeded');
    let value;
    if (take('!')) value = !atom();
    else if (take('(')) { value = or(); if (!take(')')) throw new Error('Expected ) in conditional expression'); }
    else {
      const token = tokens[i++];
      if (!symbolPattern.test(token)) throw new Error('Expected a symbol, true, or false');
      value = token === 'true' || (token !== 'false' && symbols.has(token));
    }
    depth--; return value;
  }
  function equality() { let value = atom(); while (['==', '!='].includes(tokens[i])) { const op = tokens[i++], right = atom(); value = op === '==' ? value === right : value !== right; } return value; }
  function and() { let value = equality(); while (take('&&')) { const right = equality(); value = value && right; } return value; }
  function or() { let value = and(); while (take('||')) { const right = and(); value = value || right; } return value; }
  const value = or(); if (tokens[i] !== '<end>') throw new Error(`Unexpected conditional token ${tokens[i]}`);
  return value;
}

/** Track multiline lexical trivia so a literal/comment containing #if is never a directive. */
function scanLine(line, state) {
  let token = false;
  for (let i = 0; i < line.length;) {
    if (state.mode === 'block') { const end = line.indexOf('*/', i); if (end < 0) return token; state.mode = null; i = end + 2; continue; }
    if (state.mode === 'raw') {
      if (line[i] === '"') { let end = i; while (line[end] === '"') end++; if (end - i >= state.quotes) state.mode = null; i = end; } else i++;
      continue;
    }
    if (state.mode === 'verbatim') {
      if (line[i++] === '"') { if (line[i] === '"') i++; else state.mode = null; } continue;
    }
    if (state.mode === 'string' || state.mode === 'char') {
      const c = line[i++]; if (c === '\\') i++; else if (c === (state.mode === 'char' ? "'" : '"')) state.mode = null;
      continue;
    }
    if (/\s/.test(line[i])) { i++; continue; }
    if (line.startsWith('//', i)) break;
    if (line.startsWith('/*', i)) { state.mode = 'block'; i += 2; continue; }
    token = true;
    if (line.startsWith('@"', i) || line.startsWith('$@"', i) || line.startsWith('@$"', i)) {
      state.mode = 'verbatim'; i += line.startsWith('@"', i) ? 2 : 3; continue;
    }
    if (line[i] === '"') {
      let end = i; while (line[end] === '"') end++;
      if (end - i >= 3) { state.mode = 'raw'; state.quotes = end - i; i = end; }
      else { state.mode = 'string'; i++; }
      continue;
    }
    if (line[i] === "'") state.mode = 'char';
    i++;
  }
  // Ordinary literals cannot cross a source newline; the lexer diagnoses malformed literals.
  if (state.mode === 'string' || state.mode === 'char') state.mode = null;
  return token;
}

/**
 * Source-to-source C# conditional compilation. Removed text is replaced by spaces,
 * retaining every UTF-16 offset and CR/LF. Symbols are copied and remain file-local.
 */
export function preprocessCSharp(text, { path = 'source.cs', symbols = [], maxDepth = 128 } = {}) {
  const source = new SourceFile(path, text), bag = new DiagnosticBag();
  const defined = new Set(), frames = [], regions = [], lexical = { mode: null };
  const supplied = typeof symbols === 'string' ? symbols.split(/[;,\s]+/).filter(Boolean) : symbols;
  for (const symbol of supplied) {
    if (typeof symbol !== 'string' || !symbolPattern.test(symbol) || ['true', 'false'].includes(symbol)) bag.add('JB2301', `Invalid conditional symbol '${symbol}'`, source);
    else defined.add(symbol);
  }
  let active = true, seenToken = false, offset = 0; const output = [];
  const report = (code, message, at, severity = 'error') => bag.add(code, message, source, at, severity);
  for (const match of text.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)) {
    const line = match[0]; if (!line) continue;
    const directive = (!active || lexical.mode === null) && /^[\t \uFEFF]*#\s*([A-Za-z_]+)([^\r\n]*)/.exec(line);
    if (directive) {
      const command = directive[1], raw = directive[2].trim(), args = raw.replace(/\s*\/\/.*$/, '').trim(), at = offset + line.indexOf('#');
      const conditional = () => evaluateDirective(args, defined, maxDepth);
      try {
        switch (command) {
          case 'if': {
            if (frames.length >= maxDepth) throw new Error('Conditional directive nesting budget exceeded');
            const selected = conditional(); frames.push({ parent: active, matched: selected, otherwise: false, at }); active = active && selected; break;
          }
          case 'elif': {
            const frame = frames.at(-1); if (!frame || frame.otherwise) throw new Error('#elif requires an open #if before #else');
            const selected = conditional(); active = frame.parent && !frame.matched && selected; frame.matched ||= selected; break;
          }
          case 'else': {
            if (args) throw new Error('Unexpected text after #else'); const frame = frames.at(-1);
            if (!frame || frame.otherwise) throw new Error('Duplicate or unmatched #else');
            frame.otherwise = true; active = frame.parent && !frame.matched; frame.matched = true; break;
          }
          case 'endif': {
            if (args) throw new Error('Unexpected text after #endif'); const frame = frames.pop();
            if (!frame) throw new Error('Unmatched #endif'); active = frame.parent; break;
          }
          default:
            if (!active) break;
            if (command === 'define' || command === 'undef') {
              if (seenToken) throw new Error(`#${command} must precede the first source token`);
              if (!symbolPattern.test(args) || ['true', 'false'].includes(args)) throw new Error(`Invalid symbol after #${command}`);
              command === 'define' ? defined.add(args) : defined.delete(args);
            } else if (command === 'error' || command === 'warning') report(command === 'error' ? 'JB2303' : 'JB2304', raw, at, command === 'error' ? 'error' : 'warning');
            else if (command === 'region') regions.push(at);
            else if (command === 'endregion') { if (!regions.length) throw new Error('Unmatched #endregion'); regions.pop(); }
            else if (command === 'nullable') { if (!/^(enable|disable|restore)(?:\s+(warnings|annotations))?$/.test(args)) throw new Error('Invalid #nullable directive'); }
            else if (command === 'pragma' && /^warning\s+(disable|restore)(?:\s+[\w, ]+)?$/.test(args)) report('JB2305', 'C# warning suppression is not applied to Jailbreak diagnostics', at, 'warning');
            else if (command === 'line' && ['default', 'hidden'].includes(args)) { /* Runtime debugger sequence points are not emitted. */ }
            else throw new Error(`Unsupported directive #${command}${command === 'line' ? '; source remapping requires a source-map backend' : ''}`);
        }
      } catch (error) { report('JB2302', error.message, at); }
      output.push(line.replace(/[^\r\n]/g, ' '));
    } else if (active) {
      seenToken = scanLine(line, lexical) || seenToken; output.push(line);
    } else output.push(line.replace(/[^\r\n]/g, ' '));
    offset += line.length;
  }
  for (const frame of frames) report('JB2302', 'Unclosed #if directive', frame.at);
  for (const at of regions) report('JB2302', 'Unclosed #region directive', at);
  return { success: !bag.hasErrors, text: output.join(''), diagnostics: bag.items, symbols: [...defined].sort() };
}
