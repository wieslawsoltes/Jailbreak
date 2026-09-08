import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCSharp, parseCSharp } from '../packages/csharp-compiler/index.js';
import { compileCSharp as compileBrowser } from '../browser/packages/csharp/index.js';
const source = '#if BROWSER\npublic class View { public int Value = 42; }\n#else\nunsafe invalid native code\n#endif';
test('both compiler frontends compile only the selected C# branch', () => {
  const a = compileCSharp(source,{symbols:['BROWSER']}), b = compileBrowser(source,{symbols:['BROWSER']});
  assert.equal(a.success,true,JSON.stringify(a.diagnostics)); assert.equal(b.ok,true,JSON.stringify(b.diagnostics));
  assert.match(a.code,/42/); assert.match(b.code,/42/); assert.doesNotMatch(a.code,/unsafe/);
});
test('root AST discovery uses the same configured source as emission', () => {
  const result=parseCSharp(source,'Page.cs',{symbols:['BROWSER']});
  assert.equal(result.ast.declarations[0].name,'View'); assert.deepEqual(result.diagnostics,[]);
});
test('per-file symbols override the compilation default without leaking', () => {
  const text='#if LOCAL\npublic class A {}\n#else\npublic class B {}\n#endif';
  const a=compileCSharp([{path:'A.cs',text,symbols:['LOCAL']},{path:'B.cs',text,symbols:[]}]);
  assert.equal(a.success,true,JSON.stringify(a.diagnostics)); assert.deepEqual(a.types.map(t=>t.name).sort(),['A','B']);
});
test('preprocessor failure suppresses JavaScript in both workbenches', () => {
  assert.equal(compileCSharp('#error stop').code,''); assert.equal(compileBrowser('#error stop').code,'');
});
