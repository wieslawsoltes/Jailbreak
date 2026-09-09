import test from 'node:test';
import assert from 'node:assert/strict';
import {LanguageWorkspace,completeXaml} from '../packages/language-service/index.js';
import {compileProject} from '../packages/project-system/index.js';
import {createRuntime} from '../packages/avalonia-runtime/index.js';
const C='public partial class View:UserControl {public int count; public int Run(int n){int total=0;for(int i=0;i<n;i++){total+=i;}return total;}}';
const X='<UserControl x:Class="View"><TextBlock x:Name="Label" Text="Count"/><Button Click="Run"/></UserControl>';
const model=(files={'V.cs':C,'V.axaml':X})=>new LanguageWorkspace().update(files);
test('name binding distinguishes member local and parameter scopes',()=>{
 const m=model();for(const name of ['n','i','total']){const r=m.references('V.cs',C.indexOf(name==='n'?'int n':name==='i'?'int i':'int total')+4);assert.ok(r.length>=(name==='n'?2:3),name);assert.ok(r.every(r=>C.slice(r.start,r.end)===name));}
 assert.equal(m.references('V.cs',C.indexOf('count')).length,1);
});
test('F12 resolves source method and cross-language generated names rather than text matches',()=>{
 const code=C.replace('return total','Label.Text="Hi";return total'),m=model({'V.cs':code,'V.axaml':X});
 assert.equal(m.definition('V.cs',code.indexOf('Label.Text'))[0].file,'V.axaml');
 assert.equal(m.definition('V.axaml',X.indexOf('Click="Run"')+7)[0].file,'V.cs');
 assert.equal(m.references('V.cs',code.indexOf('Run(')).filter(p=>p.file==='V.axaml').length,1);
});
test('partial type declarations and inherited member definitions survive file separation',()=>{
 const a='namespace App; public partial class C:B {public int Get(){return Value;}}',b='namespace App; public partial class C {public int Other;} public class B {public int Value;}';
 const m=model({'A.cs':a,'B.cs':b});assert.equal(m.definition('A.cs',a.indexOf('Value'))[0].file,'B.cs');assert.equal(m.definition('A.cs',a.indexOf('C:B')).length,2);
});
test('scoped local rename updates bound uses but not strings comments or same-name other methods',()=>{
 const text='public class C {public int Run(int n){ int total=1; // total\n string s="total"; total+=n;return total; }public int Other(){int total=9;return total;}}',m=model({'C.cs':text});
 const tx=m.rename('C.cs',text.indexOf('total=1'),'sum');assert.equal(tx.edits.length,3);assert.ok(tx.after.includes('// total'));assert.ok(tx.after.includes('"total"'));assert.ok(tx.after.includes('Other(){int total=9;return total;}'));
 const r=compileProject({'C.cs':tx.after});assert.equal(r.success,true,JSON.stringify(r.diagnostics));const JB=createRuntime();new Function('JB',r.code)(JB);assert.equal(new(JB.types.get('C'))().Run(4),5);
});
test('local rename resolves shadowing and refuses capture/collision instead of a textual replace',()=>{
 const text='class C {int total;int Run(int n){int sum=1;{int total=3;sum+=total;}return sum+total+n;}}',m=model({'C.cs':text});
 const tx=m.rename('C.cs',text.indexOf('int total=3')+4,'inner');assert.equal(tx.edits.length,2);assert.ok(tx.after.includes('sum+total+n'));
 assert.throws(()=>m.rename('C.cs',text.indexOf('int sum')+4,'total'),/collides/);
 assert.throws(()=>m.rename('C.cs',text.indexOf('int sum')+4,'class'),/identifier/);
 assert.throws(()=>m.rename('C.cs',text.indexOf('int total;')+4,'newMember'),/locals and parameters/);
});
test('lambda captures bind outer locals while lambda parameters create their own scope',()=>{
 const text='class C {void Run(){int n=2;Func<int,int> f=x=>x+n;}}',m=model({'C.cs':text});
 assert.equal(m.references('C.cs',text.indexOf('n=2')).length,2);assert.equal(m.references('C.cs',text.indexOf('x=>')).length,2);
 assert.ok(m.rename('C.cs',text.indexOf('n=2'),'number').after.includes('x+number'));
});
test('rename refuses interpolation and invalid parse rather than missing hidden references',()=>{
 const text='class C {string Run(int n){return $"{n}";}}';assert.throws(()=>model({'C.cs':text}).rename('C.cs',text.indexOf('int n')+4,'x'),/interpolated/);
 assert.throws(()=>model({'C.cs':'class C {void Run(){int n='}).rename('C.cs',24,'x'),/parsed/);
});
test('CSharp completion infers local control and XAML-generated field members',()=>{
 const text='public partial class View:UserControl {void Run(){var b=new Button();b.Con;Label.Te;}}',m=model({'V.cs':text,'V.axaml':X});
 const local=m.complete('V.cs',text.indexOf('b.Con')+5);assert.ok(local.items.some(x=>x.label==='Content'));assert.ok(local.items.every(x=>x.label.startsWith('Con')));
 const field=m.complete('V.cs',text.indexOf('Label.Te')+8);assert.ok(field.items.some(x=>x.label==='Text'));assert.equal(field.items.find(x=>x.label==='Text').start,text.indexOf('Label.Te')+6);
});
test('completion works on a dangling member dot without compiling or executing a placeholder',()=>{
 const text='public partial class View:UserControl {void Run(){Label.;}}',m=model({'V.cs':text,'V.axaml':X});
 assert.equal(m.units.get('V.cs').parsed.ast,null);assert.ok(m.complete('V.cs',text.indexOf('Label.')+6).items.some(x=>x.label==='Text'));assert.equal(m.units.get('V.cs').text,text);
});
test('completion suppresses strings comments and absent receiver types',()=>{
 const text='class C {void Run(){string s="Text"; // Label.Te\n Unknown.Te;}}',m=model({'C.cs':text});
 assert.equal(m.complete('C.cs',text.indexOf('"Text')+3).items.length,0);assert.equal(m.complete('C.cs',text.indexOf('// Label.Te')+11).items.length,0);assert.equal(m.complete('C.cs',text.indexOf('Unknown.Te')+10).items.length,0);
});
test('XAML completion supplies controls properties values and exact insertion positions',()=>{
 assert.ok(completeXaml('<Sta',4).items.some(x=>x.label==='StackPanel'));
 const s='<TextBlock Te',item=completeXaml(s,s.length).items.find(x=>x.label==='Text');assert.equal(item.insertText,'Text=""');assert.equal(item.cursor,6);
 const value='<StackPanel Orientation="Hor';assert.deepEqual(completeXaml(value,value.length).items.map(x=>x.label),['Horizontal']);
 assert.equal(completeXaml('<!-- <Sta',9).items.length,0);
 assert.equal(completeXaml('<TextBlock Text="hello" Te',25).items.some(x=>x.label==='Text'),false);
});
test('references and rename preserve CRLF and Unicode string/comment source positions',()=>{
 const text='class C {\r\n int Run(int n){\r\n // 😀 ą\r\n return n+n;\r\n }}',m=model({'C.cs':text}),r=m.references('C.cs',text.indexOf('int n')+4);
 assert.equal(r.length,3);assert.equal(r.at(-1).line,4);const tx=m.rename('C.cs',text.indexOf('int n')+4,'amount');assert.equal(tx.after,text.replaceAll(/\bn\b/g,'amount'));
});
test('index caches unchanged parse trees and evicts removed files',()=>{
 const m=model(),old=m.units.get('V.cs').parsed;m.update({'V.cs':C});assert.equal(m.units.get('V.cs').parsed,old);assert.equal(m.cache.has('V.axaml'),false);
});
test('budgets stop oversized indexing and invalid caret requests',()=>{
 assert.throws(()=>new LanguageWorkspace({maxFiles:1}).update({'A.cs':C,'B.cs':C}),/budget/);assert.throws(()=>new LanguageWorkspace({maxCharacters:10}).update({'A.cs':C}),/budget/);
 assert.throws(()=>model().complete('V.cs',-1),/position/);assert.throws(()=>model().complete('V.cs',Infinity),/position/);
});
