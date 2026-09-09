import test from 'node:test';
import assert from 'node:assert/strict';
import {arrangeSelection,moveSelection,snapGuides,selectionBounds,validateSelection} from '../packages/development/design-geometry.js';
import {editSelectionProperties} from '../packages/development/design-transactions.js';
import {EditHistory} from '../packages/development/designer.js';
import {canvasPreferences} from '../packages/workbench/design-canvas.js';
const item=(id,x,y,width=40,height=20)=>({id,movable:true,parent:{id:'canvas',type:'Canvas'},source:{language:'xaml',file:'View.axaml',offset:0},layout:{x,y,width,height}});
const items=()=>[item('a',10,20),item('b',70,40),item('c',180,80)];
test('alignment uses selection bounds and does not mutate source geometry',()=>{
  const selection=items(),before=JSON.stringify(selection);assert.deepEqual(arrangeSelection(selection,'left').map(i=>i.values['Canvas.Left']),[10,10,10]);
  assert.deepEqual(arrangeSelection(selection,'bottom').map(i=>i.values['Canvas.Top']),[80,80,80]);assert.equal(JSON.stringify(selection),before);
});
test('center and trailing-edge alignment account for different widths and heights',()=>{
  const selection=[item('a',0,10,40,20),item('b',60,70,60,40)];
  assert.deepEqual(arrangeSelection(selection,'center-x').map(i=>i.values['Canvas.Left']),[40,30]);
  assert.deepEqual(arrangeSelection(selection,'right').map(i=>i.values['Canvas.Left']),[80,60]);
  assert.deepEqual(arrangeSelection(selection,'center-y').map(i=>i.values['Canvas.Top']),[50,40]);
});
test('equal-gap distribution preserves the outer extents and respects visual sizes',()=>{
  const result=arrangeSelection([item('b',80,0,20),item('a',0,0,40),item('c',200,0,60)],'distribute-x');
  assert.deepEqual(result.map(i=>[i.id,i.values['Canvas.Left']]),[['a',0],['b',110],['c',200]]);
});
test('group snapping moves every member by the same delta; no cumulative drift',()=>{
  const original=items(),edits=moveSelection(original,13,5,{snap:8});assert.deepEqual(edits.map(e=>e.values['Canvas.Left']-original.find(i=>i.id===e.id).layout.x),[14,14,14]);
  assert.equal(edits[0].values['Canvas.Top'],24);
});
test('guide snapping chooses close sibling edges and ignores unrelated parents',()=>{
  const original=[item('a',10,10)],snap=snapGuides(original,[item('b',100,100)],47,0,5);assert.equal(snap.dx,50);assert.ok(snap.guides.some(g=>g.axis==='x'));
  assert.equal(snapGuides(original,[{...item('b',100,100),parent:{id:'other',type:'Canvas'}}],47,0,5).dx,47);
});
test('size matching uses first selection as explicit anchor',()=>{
  assert.deepEqual(arrangeSelection([item('a',0,0,55),item('b',50,20,90)],'same-width').map(i=>i.values.Width),[55,55]);
});
test('layout rejects transforms templates mismatched hosts invalid numbers and ambiguous identities',()=>{
  for(const bad of [[...items(),items()[0]],[{...item('a',0,0),movable:false}],items().map(i=>({...i,template:true})),[item('a',0,NaN)],items().map((i,n)=>({...i,parent:{id:'p'+n,type:'Canvas'}})),items().map(i=>({...i,source:{...i.source,language:'csharp'}}))])assert.throws(()=>validateSelection(bad));
  assert.throws(()=>arrangeSelection(items().slice(0,2),'distribute-x'));assert.throws(()=>arrangeSelection(items(),'unknown'));assert.throws(()=>moveSelection(items(),Infinity,0));
});
test('batch property edits preserve preceding source offsets comments and CRLF',()=>{
  const text='<Canvas>\r\n<!-- keep -->\r\n<Button Name="A" Canvas.Left="10" Canvas.Top="20"/>\r\n<Button Name="B" Canvas.Left="100" Canvas.Top="30"/>\r\n</Canvas>',files={'View.axaml':text};
  const a={...item('a',10,20),source:{language:'xaml',file:'View.axaml',offset:text.indexOf('<Button')}},b={...item('b',100,30),source:{language:'xaml',file:'View.axaml',offset:text.lastIndexOf('<Button')}};
  const transaction=editSelectionProperties(files,[a,b],[{id:'a',values:{Width:120,'Canvas.Left':30}},{id:'b',values:{Width:180,'Canvas.Left':130}}]);
  assert.match(transaction.after,/<!-- keep -->/);assert.equal(transaction.after.split('\r\n').length,5);assert.equal(files['View.axaml'],text);
  const history=new EditHistory();history.apply(files,transaction);history.undo(files);assert.equal(files['View.axaml'],text);history.redo(files);assert.equal(files['View.axaml'],transaction.after);
});
test('batch validation refuses protected values without partially modifying files',()=>{
  const text='<Canvas><Button Canvas.Left="{Binding X}"/><Button Width="40"/></Canvas>',files={'View.axaml':text},a={...item('a',0,0),source:{language:'xaml',file:'View.axaml',offset:8}},b={...item('b',40,0),source:{language:'xaml',file:'View.axaml',offset:text.lastIndexOf('<Button')}};
  assert.throws(()=>editSelectionProperties(files,[a,b],[{id:'b',values:{Width:50}},{id:'a',values:{'Canvas.Left':10}}]),/protected/);assert.equal(files['View.axaml'],text);
  for(const edit of [{id:'missing',values:{Width:50}},{id:'a',values:{Width:-1}},{id:'a',values:{Name:'new'}},{id:'a',values:{Height:NaN}}])assert.throws(()=>editSelectionProperties(files,[a,b],[edit]));
});
test('artboard preferences are bounded numbers and do not carry CSS injection',()=>{
  assert.deepEqual(canvasPreferences({width:'10px;display:none',height:Infinity,zoom:50,snap:true}),{width:960,height:640,zoom:2,grid:true,snap:true,guides:true});
  assert.equal(canvasPreferences(null).width,960);assert.equal(canvasPreferences({width:-1}).width,240);
});
