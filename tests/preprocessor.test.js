import test from 'node:test';
import assert from 'node:assert/strict';
import { preprocessCSharp as pp, evaluateDirective as ev } from '../packages/build-profile/preprocessor.js';

test('directive expression precedence and symbol case sensitivity', () => {
  const s = new Set(['DEBUG', 'BROWSER']);
  assert.equal(ev('DEBUG && (!WINDOWS || false) == true', s), true);
  assert.equal(ev('debug || false && true', s), false);
  assert.equal(ev('true != false == true', s), true);
});
test('directive expressions reject unknown syntax, trailing input and deep recursion', () => {
  for (const x of ['', '1', 'defined(DEBUG)', 'true ||', 'true true', 'A = B', 'false && +']) assert.throws(() => ev(x));
  assert.throws(() => ev('!'.repeat(200)+'true'));
});
test('nested if/elif/else only retains selected branches', () => {
  const r = pp('#if DEBUG\n#if WINDOWS\nwin\n#elif BROWSER\nweb\n#else\nnone\n#endif\n#else\nrelease\n#endif', { symbols:['DEBUG', 'BROWSER'] });
  assert.equal(r.success, true); assert.match(r.text, /web/); assert.doesNotMatch(r.text, /win|none|release|#/);
});
test('disabled malformed source never reaches the lexer', () => {
  const r = pp('#if NATIVE\n"broken\n@this is not C# !!!\n#if ANY\nmore\n#endif\n#else\nclass C {}\n#endif');
  assert.equal(r.success, true); assert.match(r.text, /class C/); assert.doesNotMatch(r.text, /broken/);
});
test('positions, UTF-16 length and CRLF remain byte-location compatible', () => {
  const src = '\uFEFF#if NO\r\n🙃 discarded\r\n#else\r\nclass C { unknown; }\r\n#endif\r\n';
  const r = pp(src); assert.equal(r.text.length, src.length); assert.equal(r.text.indexOf('unknown'), src.indexOf('unknown'));
  assert.deepEqual([...r.text.matchAll(/\r\n/g)].map(m=>m.index), [...src.matchAll(/\r\n/g)].map(m=>m.index));
});
test('define and undef are file-local and respect inactive branches', () => {
  const input = new Set(['GLOBAL']);
  const r = pp('#define LOCAL\n#undef GLOBAL\n#if NO\n#define HIDDEN\n#endif\n#if LOCAL && !GLOBAL\nclass C {}\n#endif', { symbols:input });
  assert.equal(r.success, true); assert.deepEqual(r.symbols, ['LOCAL']); assert.deepEqual([...input], ['GLOBAL']);
});
test('define after source is an error but comments do not count as source', () => {
  assert.equal(pp('/* comment\nmore */\n#define X\nclass C {}').success, true);
  assert.equal(pp('class C {}\n#define X').success, false);
});
test('directives inside comments, verbatim and raw strings remain untouched', () => {
  const src = '/*\n#if COMMENT\n*/\nclass C { string V = @"\n#if LITERAL\n"; string R = """\n#if RAW\n"""; }';
  assert.deepEqual(pp(src).diagnostics, []); assert.equal(pp(src).text, src);
});
test('error and warning apply only to active code and carry original location', () => {
  const r = pp('#if NO\n#error hidden\n#endif\n#warning visible\n#error stop', { path:'Page.cs' });
  assert.equal(r.success, false); assert.deepEqual(r.diagnostics.map(d=>[d.code,d.line,d.file]), [['JB2304',4,'Page.cs'],['JB2303',5,'Page.cs']]);
});
test('unbalanced and duplicate directive structures fail explicitly', () => {
  for (const src of ['#endif','#else','#elif true','#if true','#if false\n#else\n#else\n#endif','#if true\n#else\n#elif true\n#endif','#else extra']) assert.equal(pp(src).success,false,src);
});
test('nullable metadata and regions work; remapping is not silently discarded', () => {
  assert.equal(pp('#region UI\n#nullable enable annotations\nclass C {}\n#endregion').success,true);
  assert.equal(pp('#line 400 "generated.cs"').success,false);
  assert.equal(pp('#region missing').success,false);
});
test('symbols are validated without prototype lookup or executable expressions', () => {
  assert.equal(pp('', { symbols:['true'] }).success,false);
  assert.equal(pp('', { symbols:['BAD-NAME'] }).success,false);
  assert.equal(ev('__proto__',new Set()),false);
  assert.equal(ev('constructor',new Set(['constructor'])),true);
});
