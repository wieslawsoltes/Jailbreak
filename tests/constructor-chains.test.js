import test from 'node:test';
import assert from 'node:assert/strict';
import {compileProject} from '../packages/project-system/index.js';
import {createRuntime} from '../packages/avalonia-runtime/index.js';
const opts=[{}, {debug:true}, {debug:true,cooperativeDebug:true}];
function setup(source,options,extra={}) {
  const r=compileProject({'Chain.cs':source,...extra},options);assert.equal(r.success,true,JSON.stringify(r.diagnostics));
  const JB=createRuntime(),events=[];
  if(options.debug)JB.enableDevelopment({debug:r.debug,nativeBreaks:false,report:(event,data)=>events.push({event,data})});
  new Function('JB',r.code)(JB);return {JB,r,events};
}
async function construct(JB,options,name,args=[]) {const T=JB.types.get(name);return options.cooperativeDebug?JB.dev.co.run(JB.dev.co.construct(T,args)).promise:Reflect.construct(T,args);}
const source=`public class Base { public int baseValue; public Base(int value){baseValue=value;} }
public class Chain:Base {
 public static int initialized=0; public int field=Initialize(); public string trace="";
 public Chain():this(4){trace+="outer";}
 public Chain(int value):this(value+1,2){trace+="middle/";}
 public Chain(int value,int scale):base(value*scale){trace="inner/";}
 private static int Initialize(){initialized++;return 17;}
}`;
for(const options of opts)test('delegation evaluates one allocation/initializer and bodies inside-out '+JSON.stringify(options),async()=>{
 const {JB}=setup(source,options),object=await construct(JB,options,'Chain');
 assert.equal(object.baseValue,10);assert.equal(object.trace,'inner/middle/outer');assert.equal(object.field,17);assert.equal(JB.types.get('Chain').initialized,1);assert.ok(object instanceof JB.types.get('Base'));assert.ok(object instanceof JB.types.get('Chain'));
});
test('forwarding expressions are evaluated once, left to right, and mutated parameter state reaches body',async()=>{
 const s=`public class C {public static int calls=0;public int a;public int b;public int tail;
 public C(int n):this(n++,Next()){tail=n;}
 public C(int x,int y){a=x;b=y;}
 public static int Next(){calls++;return calls;}}`;
 for(const o of opts){const {JB}=setup(s,o),c=await construct(JB,o,'C',[7]);assert.deepEqual([c.a,c.b,c.tail,JB.types.get('C').calls],[7,1,8,1]);}
});
test('constructor optional defaults and params arguments survive forwarding',async()=>{
 const s=`public class C {public int value;public int count; public C():this(2,4,5){} public C(int x,params int[] rest){value=x;count=rest.Length;}}`;
 for(const o of opts){const {JB}=setup(s,o),c=await construct(JB,o,'C');assert.deepEqual([c.value,c.count],[2,2]);}
 const optional='public class C {public int value;public C():this(7){}public C(int x,int y=3){value=x+y;}}';
 for(const o of opts){const {JB}=setup(optional,o);assert.equal((await construct(JB,o,'C')).value,10);}
});
test('separate explicit base initializers select by disjoint argument count',async()=>{
 const s='public class B {public int value;public B(int n){value=n;}} public class C:B {public C():base(1){}public C(int n):base(n+2){}}';
 for(const o of opts){const {JB}=setup(s,o);assert.equal((await construct(JB,o,'C')).value,1);assert.equal((await construct(JB,o,'C',[3])).value,5);}
});
test('delegating body early return does not skip the outer body',async()=>{
 const s='public class C {public int value;public C():this(2){value+=5;}public C(int n){value=n;return;}}';
 for(const o of opts){const {JB}=setup(s,o);assert.equal((await construct(JB,o,'C')).value,7);}
});
test('base class with its own delegation constructs the final prototype exactly once',async()=>{
 const s='public class B {public int value;public B():this(3){value++;}public B(int n){value=n;}}public class C:B {public int extra=7;public C():this(2){}public C(int n){extra+=n;}}';
 for(const o of opts){const {JB}=setup(s,o),c=await construct(JB,o,'C');assert.deepEqual([c.value,c.extra],[4,9]);assert.equal(c.constructor,JB.types.get('C'));}
});
test('cycles, unknown and overlapping targets fail before emitting executable JavaScript',()=>{
 for(const source of [
 'public class C {public C():this(){} }',
 'public class C {public C():this(1){} public C(int x):this(){} }',
 'public class C {public C():this(1,2){} }',
 'public class C {public C(int x){} public C(string s){} }',
 'public class C {public C(){} public C(int x=1){} }']){
   for(const o of opts){const r=compileProject({'C.cs':source},o);assert.equal(r.success,false,source);assert.equal(r.code,'');assert.ok(r.diagnostics.some(d=>/^JB226[3-6]$/.test(d.code)));}
 }
});
test('initializer cannot access unallocated this, base, instance fields or inherited UI state',()=>{
 for(const expression of ['this.value','value','Width','this.Read()','Read()','base.Read()']) {
  const source=`public class C:UserControl {public int value;public int Read(){return 1;}public C():this(${expression}){}public C(int x){}}`;
  const r=compileProject({'C.cs':source});assert.equal(r.success,false,expression);assert.ok(r.diagnostics.some(d=>d.code==='JB2267'));assert.equal(r.code,'');
 }
});
test('partial constructors retain their original file and paused parameters can be edited',async()=>{
 const files={'A.cs':'public partial class C {public int value;public C():this(5){value+=1;}}',
 'B.cs':'public partial class C {public C(int n){\nvalue=n;\n}}'};
 const {JB,r,events}=setup('',opts[2],files),point=r.debug.sites.find(p=>p.file==='B.cs'&&p.line===2&&p.cooperative);
 assert.ok(point);JB.dev.configure({breakpoints:[{file:point.file,line:point.line}]});
 const task=JB.dev.co.run(JB.dev.co.construct(JB.types.get('C'),[])),stop=events.findLast(e=>e.event==='debug-paused').data;
 assert.equal(stop.frames[0].locals.n,5);JB.dev.co.setLocal(task.taskId,stop.frames[0].id,'n',20);JB.dev.co.command(task.taskId,'continue');assert.equal((await task.promise).value,21);
});
test('delegation can pause inside XAML and cancellation disposes the same partially built control',async()=>{
 const s='public partial class View:UserControl {public static int tails=0;public View():this(1){tails++;}public View(int n){InitializeComponent();tails++;}}',
 x='<UserControl xmlns="https://github.com/avaloniaui" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" x:Class="View">\n<StackPanel><Button Name="B"/></StackPanel>\n</UserControl>';
 const {JB}=setup(s,opts[2],{'View.axaml':x}),created=[],register=JB.dev.register;
 JB.dev.register=(c,p)=>{created.push(c);return register(c,p);};JB.dev.configure({breakpoints:[{file:'View.axaml',line:2}]});
 const task=JB.dev.co.run(JB.createFromXamlSteps('View'));assert.ok(JB.dev.co.busy);assert.equal(JB.types.get('View').tails,0);
 JB.dev.co.command(task.taskId,'cancel');await task.promise;assert.equal(JB.types.get('View').tails,0);assert.ok(created.every(c=>c._disposed));assert.equal(JB.dev.co.busy,false);
});
test('delegation participates in constructor shape checks and strips continuation code in release',async()=>{
 const {planReload}=await import('../packages/development/reload.js');const before=compileProject({'C.cs':source},{debug:true}),after=compileProject({'C.cs':source.replace('this(4)','this(7)')},{debug:true});
 assert.equal(planReload(before,after).compatible,false);assert.doesNotMatch(compileProject({'C.cs':source}).code,/registerConstructor|checkpoint|@jb:/);
});
test('delegated constructors preserve explicit base method dispatch in both execution paths',async()=>{
 const s='public class B {public virtual int Read(){return 3;}}public class C:B {public int value;public override int Read(){return 9;}public C():this(1){value+=base.Read();}public C(int x){value=x;}}';
 for(const o of opts){const {JB}=setup(s,o);assert.equal((await construct(JB,o,'C')).value,4);}
});
