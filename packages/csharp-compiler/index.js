import { compileCSharp as compileBackend } from './backend.js';
import { parseCSharp as parseBackend } from './parser.js';
import { preprocessCSharp } from '../build-profile/preprocessor.js';
export { lexCSharp } from './lexer.js';
export { preprocessCSharp } from '../build-profile/preprocessor.js';

export function parseCSharp(text, path = 'source.cs', options = {}) {
  const prepared = preprocessCSharp(text, { path, symbols: options.symbols ?? [] });
  const parsed = parseBackend(prepared.text, path);
  return { ...parsed, ast: prepared.success ? parsed.ast : null,
    diagnostics: [...prepared.diagnostics, ...parsed.diagnostics] };
}
/** Symbols may be supplied per file, so project references do not leak defines. */
export function compileCSharp(input, options = {}) {
  const files = typeof input === 'string' ? [{ path: options.path ?? 'program.cs', text: input }] : input;
  const diagnostics = [], prepared = files.map(file => {
    const result = preprocessCSharp(file.text, { path: file.path, symbols: file.symbols ?? options.symbols ?? [] });
    diagnostics.push(...result.diagnostics); return { ...file, text: result.text };
  });
  if (diagnostics.some(d => d.severity === 'error')) return { success: false, code: '', types: [], diagnostics };
  const result = compileBackend(prepared, options);
  return { ...result, diagnostics: [...diagnostics, ...result.diagnostics] };
}
