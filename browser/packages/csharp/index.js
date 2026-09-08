import { compileCSharp as compileBackend } from './backend.js';
import { preprocessCSharp } from '../../../packages/build-profile/preprocessor.js';
export { tokenize, Parser, Emitter } from './backend.js';
export { preprocessCSharp } from '../../../packages/build-profile/preprocessor.js';

export function compileCSharp(input, options = {}) {
  const files = typeof input === 'string' ? [{ path: options.file ?? 'source.cs', content: input }] : input;
  const diagnostics = [], prepared = files.map(file => {
    const result = preprocessCSharp(file.content, { path: file.path, symbols: file.symbols ?? options.symbols ?? [] });
    diagnostics.push(...result.diagnostics); return { ...file, content: result.text };
  });
  if (diagnostics.some(d => d.severity === 'error')) return { ok: false, code: '', classes: [], diagnostics };
  const result = compileBackend(prepared, options);
  return { ...result, diagnostics: [...diagnostics, ...result.diagnostics] };
}
