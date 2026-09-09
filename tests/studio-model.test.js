import test from 'node:test';
import assert from 'node:assert/strict';
import {studioPreferences, visibleLines, diagnosticMatches, valueText, indentSource, fileHierarchy} from '../packages/workbench/studio-model.js';

test('Studio preferences validate every persisted choice and numeric range',()=>{
  assert.deepEqual(studioPreferences({perspective:'untrusted',tools:'bad',bottom:'bad',fontSize:400}),{perspective:'split',tools:'all',bottom:'problems',fontSize:20});
  assert.equal(studioPreferences({fontSize:NaN}).fontSize,13);
  assert.equal(studioPreferences({perspective:'binary',tools:'debug',bottom:'watch'}).perspective,'binary');
});
test('breakpoint gutter materializes only visible rows and retains original line numbers',()=>{
  const rows=visibleLines(1_000_000,22000,440,22,14);
  assert.ok(rows.length<=24);assert.equal(rows[0].line,1000);assert.equal(rows[0].top,-8);
  assert.equal(visibleLines(3,0,400,22).length,3);assert.deepEqual(visibleLines(0,0,400,22),[]);
});
test('diagnostic filtering combines severity and original file/code/message without regex',()=>{
  const d={severity:'warning',code:'JB[123]',file:'View.axaml',message:'Unknown value'};
  assert.equal(diagnosticMatches(d,{query:'JB[',severity:'warning'}),true);
  assert.equal(diagnosticMatches(d,{query:'AXAML'}),true);
  assert.equal(diagnosticMatches(d,{query:'value',severity:'error'}),false);
});
test('debug values describe actual snapshots and preserve strings distinctly from null',()=>{
  assert.equal(valueText('null'),'"null"');assert.equal(valueText(null),'null');
  assert.equal(valueText(undefined),'undefined');assert.equal(valueText([1,2]),'Array (2)');
  assert.equal(valueText({n:42}),'{ n }');
});
test('single-caret indentation inserts four spaces and positions the caret',()=>{
  assert.deepEqual(indentSource('ab',1,1),{text:'a    b',start:5,end:5});
});
test('multiline indent and outdent preserve CRLF and selection extent',()=>{
  const source='first\r\nsecond\r\nthird',r=indentSource(source,0,15);
  assert.equal(r.text,'    first\r\n    second\r\nthird');
  const back=indentSource(r.text,r.start,r.end,true);assert.equal(back.text,source);
});
test('outdent never removes source or makes selection negative',()=>{
  assert.deepEqual(indentSource('x',0,0,true),{text:'x',start:0,end:0});
  assert.equal(indentSource('\tvalue',1,1,true).text,'value');
  assert.throws(()=>indentSource('x',0,9),/Invalid/);
});
test('file hierarchy groups nested paths with exact source labels',()=>{
  const tree=fileHierarchy(['App.cs','Views/Main.axaml','Views/Parts/Button.cs']);
  assert.equal(tree.files[0].path,'App.cs');assert.equal(tree.folders.get('Views').files[0].name,'Main.axaml');
  assert.equal(tree.folders.get('Views').folders.get('Parts').files[0].path,'Views/Parts/Button.cs');
});
test('prototype-looking filenames remain inert Map keys',()=>{
  const tree=fileHierarchy(['__proto__/toString.cs','constructor/Value.cs']);
  assert.equal(tree.folders.get('__proto__').files[0].name,'toString.cs');
  assert.equal(Object.prototype.Value,undefined);
});
