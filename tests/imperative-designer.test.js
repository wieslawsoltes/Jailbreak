import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSource,editProperty,EditHistory} from '../packages/development/designer.js';
import {compileProject} from '../packages/project-system/index.js';
import {createRuntime} from '../packages/avalonia-runtime/index.js';
const wrap=body=>'public class View : UserControl { public View(){ '+body+' } }';
const at=text=>text.indexOf('new Button');
function execute(text){const result=compileProject({'View.cs':text},{debug:true});assert.equal(result.success,true,JSON.stringify(result.diagnostics));const JB=createRuntime();new Function('JB',result.code)(JB);return new (JB.types.get('View'))();}
test('designer reads final imperative assignment instead of overwritten initializer',()=>{
  const text=wrap('var b=new Button {Content="first"}; b.Content="last"; Children.Add(b);');
  const model=inspectSource(text,'View.cs',at(text));assert.equal(model.provenance,'local-flow');assert.equal(model.properties.Content.literal,'last');assert.equal(model.properties.Content.origin,'assignment');assert.equal(model.properties.Content.writes,2);
  const edit=editProperty(text,'View.cs',at(text),'Content','edited');assert.match(edit.after,/Content="first"/);assert.match(edit.after,/b.Content="edited"/);
  const root=execute(edit.after);assert.equal(root.Children[0].Content,'edited');root.Dispose();
});
test('direct local alias chains target the actual last literal write',()=>{
  const text=wrap('var b=new Button(); var alias=b; var last=alias; alias.Width=120; last.Width=160;');
  const edit=editProperty(text,'View.cs',at(text),'Width','200');assert.ok(edit.after.endsWith('alias.Width=120; last.Width=200; } }'));
});
test('reassignment kills an alias without confusing two distinct constructions',()=>{
  const text=wrap('var b=new Button {Width=100}; var alias=b; b=new Button(); b.Width=50; alias.Width=130;');
  const edit=editProperty(text,'View.cs',at(text),'Width',140);assert.match(edit.after,/b.Width=50; alias.Width=140/);
  const second=text.indexOf('new Button()',at(text)+1);assert.equal(inspectSource(text,'View.cs',second).properties.Width.literal,50);
});
test('already-declared local may become an alias through assignment',()=>{
  const text=wrap('Button other=null; var b=new Button(); other=b; other.Width=75;');
  assert.equal(inspectSource(text,'View.cs',at(text)).properties.Width.literal,75);
  assert.match(editProperty(text,'View.cs',at(text),'Width','80').after,/other.Width=80/);
});
test('literal replacement preserves CRLF comments, spaces and unrelated statements byte-for-byte',()=>{
  const text=wrap('var b = new Button();\r\n  // retain\r\n  b.Content /*property*/ = /*value*/ "before" ;\r\n  int unrelated=7;');
  const edit=editProperty(text,'View.cs',at(text),'Content','Łódź <&>');assert.equal(edit.after,text.replace('"before"','"Łódź \\u003c&>"'));
});
test('numeric and boolean imperative edits are encoded as literals, not arbitrary code',()=>{
  const text=wrap('var b=new Button(); b.Width=-25.5; b.IsEnabled=true;');
  assert.match(editProperty(text,'View.cs',at(text),'Width','1.2e2').after,/b.Width=120/);
  assert.match(editProperty(text,'View.cs',at(text),'IsEnabled','false').after,/IsEnabled=false/);
  for(const value of ['NaN','Infinity','2; attack()'])assert.throws(()=>editProperty(text,'View.cs',at(text),'Width',value));
});
test('unknown callbacks and helpers protect both existing and missing properties',()=>{
  for(const tail of ['Modify(b);','this.saved=b;','Action later=()=>{b.Width=10;};','if(true) b.Width=10;','while(true){b.Width=10;break;}','var value=b.Width;']){
    const text=wrap('var b=new Button {Width=100}; '+tail),model=inspectSource(text,'View.cs',at(text));
    assert.ok(model.reason,tail);assert.equal(model.properties.Width.editable,false,tail);
    for(const p of ['Width','Height'])assert.throws(()=>editProperty(text,'View.cs',at(text),p,'200'),undefined,tail);
  }
});
test('compound and computed last writes cannot be hidden by editing the initializer',()=>{
  for(const tail of ['b.Width+=5;','b.Width=1+2;']){
    const text=wrap('var b=new Button {Width=50}; '+tail);
    assert.equal(inspectSource(text,'View.cs',at(text)).properties.Width.editable,false);
    assert.throws(()=>editProperty(text,'View.cs',at(text),'Width',100),/protected/);
  }
});
test('construction inside loops and callbacks is not claimed as unique imperative provenance',()=>{
  for(const text of [wrap('for(int i=0;i<2;i++){var b=new Button();b.Width=50;}'),wrap('Action f=()=>{var b=new Button();b.Width=50;};')]){
    assert.ok(inspectSource(text,'View.cs',at(text)).reason);assert.throws(()=>editProperty(text,'View.cs',at(text),'Width',20));
  }
});
test('return and known child ownership permit editing without invoking application code',()=>{
  const text='public class View { public Button Build(){var b=new Button(); b.Content="original"; return b;} }';
  assert.equal(inspectSource(text,'View.cs',at(text)).reason,null);
  assert.match(editProperty(text,'View.cs',at(text),'Content','ok').after,/b.Content="ok"/);
});
test('removing imperative assignments refuses to expose earlier state',()=>{
  const text=wrap('var b=new Button {Width=100};b.Width=150;');assert.throws(()=>editProperty(text,'View.cs',at(text),'Width',null),/earlier state/);
});
test('new literal properties still extend a proven-safe initializer',()=>{
  const text=wrap('var b=new Button();b.Content="Hi";');assert.match(editProperty(text,'View.cs',at(text),'Height',44).after,/new Button\(\) \{ Height = 44 \}/);
});
test('design transaction undo and redo restore exactly the imperative source',()=>{
  const text=wrap('var b=new Button();b.Content="first";'),files={'View.cs':text},history=new EditHistory();
  const edit=editProperty(text,'View.cs',at(text),'Content','second');history.apply(files,edit);history.undo(files);assert.equal(files['View.cs'],text);history.redo(files);assert.equal(files['View.cs'],edit.after);
});
