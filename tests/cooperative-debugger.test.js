import test from 'node:test';
import assert from 'node:assert/strict';
import {compileProject} from '../packages/project-system/index.js';
import {createRuntime} from '../packages/avalonia-runtime/index.js';
import {createCooperativeDebugger} from '../packages/development/cooperative-debugger.js';
import {planReload,reloadScript} from '../packages/development/reload.js';
const tick=()=>new Promise(r=>setTimeout(r,5));
function setup(source,options={}){
  const result=compileProject({'A.cs':source},{debug:true,cooperativeDebug:true});assert.equal(result.success,true,JSON.stringify(result.diagnostics));
  const JB=createRuntime(),events=[];JB.enableDevelopment({debug:result.debug,nativeBreaks:false,report:(event,data)=>events.push({event,data}),...options});new Function('JB',result.code)(JB);
  return {result,JB,co:JB.dev.co,obj:new (JB.types.get('A'))(),events};
}
const source=`public class A {
 public int Main(int x) {
  int y=Add(x,1);
  return y*2;
 }
 public int Add(int a,int b) {
  return a+b;
 }
}`;
test('compiled continuations preserve nested calls recursion loops and managed exceptions',async()=>{
  const {obj,co}=setup('public class A {public int Fib(int x){if(x<2)return x;return Fib(x-1)+Fib(x-2);} public int Loop(int n){int x=0;for(int i=0;i<n;i++){if(i==2)continue; x+=i;}try{if(n<0)throw new ArgumentException();}catch(ArgumentException e){x=-1;}finally{x+=10;}return x;}}');
  for(const n of [0,1,6,10])assert.equal(await co.start(obj,'Fib',[n]).promise,obj.Fib(n));
  for(const n of [-1,0,8])assert.equal(await co.start(obj,'Loop',[n]).promise,obj.Loop(n));
});
test('step into over out expose real suspended frames and local mutation changes continuation',async()=>{
  const {obj,co,events}=setup(source),task=co.start(obj,'Main',[2],{breakOnEntry:true});let pause=events.at(-1).data;
  assert.equal(pause.frames[0].method,'A.Main');assert.equal(co.state()[0].status,'paused');
  co.command(task.taskId,'into');pause=events.at(-1).data;assert.equal(pause.frames.length,2);assert.equal(pause.frames[0].method,'A.Add');
  assert.equal(co.inspectFrame(task.taskId,pause.frames[1].id,['x']).watches[0].value,2);
  co.setLocal(task.taskId,pause.frames[0].id,'a',10);co.command(task.taskId,'out');pause=events.at(-1).data;
  assert.equal(pause.frames.length,1);assert.equal(pause.frames[0].locals.y,11);
  co.setLocal(task.taskId,pause.frames[0].id,'y',20);co.command(task.taskId,'continue');assert.equal(await task.promise,40);assert.equal(co.busy,false);
  const next=co.start(obj,'Main',[3],{breakOnEntry:true});co.command(next.taskId,'over');pause=events.at(-1).data;assert.equal(pause.frames[0].locals.y,4);assert.equal(pause.frames.length,1);co.command(next.taskId,'continue');assert.equal(await next.promise,8);
});
test('local mutation validates managed integer ranges and frame lifetime',async()=>{
  const {obj,co,events}=setup(source),task=co.start(obj,'Main',[2],{breakOnEntry:true}),frame=events.at(-1).data.frames[0].id;
  for(const value of [1.5,2147483648,'text',{},null])assert.throws(()=>co.setLocal(task.taskId,frame,'x',value));
  assert.throws(()=>co.setLocal(task.taskId,frame,'this',0));co.command(task.taskId,'continue');await task.promise;assert.throws(()=>co.inspectFrame(task.taskId,frame));
});
test('source conditional breakpoints hit compiled continuation without a native pause',async()=>{
  const {JB,obj,co,events}=setup(source,{breakpoints:[{file:'A.cs',line:7,condition:'a == 2'}]});
  const task=co.start(obj,'Main',[2]);assert.equal(events.at(-1).event,'debug-paused');assert.equal(events.at(-1).data.point.line,7);
  assert.equal(events.find(e=>e.event==='debug-hit').data.nativePause,false);co.command(task.taskId,'continue');assert.equal(await task.promise,6);JB.dev.dispose();
});
test('explicit exception break suspends before throwing and retains exception identity',async()=>{
  const {JB,obj,co,events}=setup('public class A {public int cleaned=0;public Exception Run(Exception e){try{throw e;}catch(Exception same){return same;}finally{cleaned++;}}}',{breakOnThrow:true}),error=new JB.ArgumentException('original'),task=co.start(obj,'Run',[error]);
  assert.equal(events.at(-1).data.reason,'exception');assert.equal(obj.cleaned,0);co.command(task.taskId,'continue');assert.equal(await task.promise,error);assert.equal(obj.cleaned,1);
});
test('async nested calls retain Task results and step out resumes the awaiting caller',async()=>{
  const {obj,co,events}=setup('public class A {public async Task<int> Run(int x){int y=await Add(x);return y*2;}public async Task<int> Add(int x){await Task.Delay(1);return x+1;}}');
  const task=co.start(obj,'Run',[4],{breakOnEntry:true});co.command(task.taskId,'into');let pause=events.at(-1).data;
  assert.equal(pause.frames[0].method,'A.Add');assert.notEqual(pause.taskId,task.taskId);co.command(pause.taskId,'out');
  for(let i=0;i<30&&co.state().find(t=>t.taskId===task.taskId)?.status!=='paused';i++)await tick();
  pause=events.at(-1).data;assert.equal(pause.taskId,task.taskId);assert.equal(pause.frames[0].locals.y,5);
  co.command(task.taskId,'continue');assert.equal(await task.promise,10);
});
test('cancel runs finally and ignores the stale completion of an earlier await',async()=>{
  const {JB,obj,co}=setup('public class A {public int count=0;public async Task Run(){try{await Task.Delay(1);count++;}finally{await Task.Delay(2);count+=10;}}}'),resolvers=[];JB.Task.Delay=()=>new Promise(r=>resolvers.push(r));
  const task=co.start(obj,'Run');assert.equal(co.state()[0].status,'awaiting');co.command(task.taskId,'cancel');assert.equal(resolvers.length,2);
  resolvers[0]();await tick();assert.equal(obj.count,0);assert.equal(co.busy,true);resolvers[1]();await task.promise;assert.equal(obj.count,10);assert.equal(co.busy,false);
});
test('execution budgets terminate empty loops after allowing finally cleanup',async()=>{
  let cleaned=false;const co=createCooperativeDebugger({point:()=>({}),maxSteps:10,quantum:100});
  class A { Run(){} }co.register(A,[{name:'Run',fn:function*(){try{while(true)yield co.checkpoint(0,()=>({}));}finally{cleaned=true;yield co.checkpoint(0,()=>({}));}}}]);
  await assert.rejects(co.start(new A(),'Run').promise,/budget/);assert.equal(cleaned,true);assert.equal(co.busy,false);
});
test('compiled empty loops yield backedge sequence points and can be cancelled',async()=>{
  const {obj,co,events}=setup('public class A {public int clean=0;public void Loop(){try{while(true){}}finally{clean++;}}}');
  const task=co.start(obj,'Loop',[],{breakOnEntry:true});co.command(task.taskId,'into');assert.equal(events.at(-1).event,'debug-paused');co.command(task.taskId,'cancel');await task.promise;assert.equal(obj.clean,1);
});
test('member calls preserve receiver getter ordering and optional argument suppression',async()=>{
  const {obj,co}=setup('public class A {public int count=0;public int Side(){count++;return 3;}public object Run(object target){return target?.Callback(Side());}}');
  assert.equal(await co.start(obj,'Run',[null]).promise,undefined);assert.equal(obj.count,0);
  const seen=[],target={get Callback(){seen.push(obj.count);return x=>x+2;}};assert.equal(await co.start(obj,'Run',[target]).promise,5);assert.deepEqual(seen,[0]);assert.equal(obj.count,1);
});
test('CSharp method-group event subscriptions execute continuations and unsubscribe by identity',async()=>{
  const {obj,co,events}=setup('public class A {public int count=0; public Button button=new Button();public A(){button.Click+=Go;}public void Go(object s,RoutedEventArgs e){count++;}public void Off(){button.Click-=Go;}}');
  obj.button.raise('Click');await tick();assert.equal(obj.count,1);assert.ok(events.some(e=>e.event==='debug-completed'));obj.Off();obj.button.raise('Click');await tick();assert.equal(obj.count,1);assert.equal(co.busy,false);obj.button.Dispose();
});
test('cooperative method hot reload updates future continuations but rejects suspended frames',async()=>{
  const text='public class A {public int Value(){return 1;}}',{obj,JB,co,result}=setup(text);
  const next=compileProject({'A.cs':text.replace('return 1','return 2')},{debug:true,cooperativeDebug:true}),plan=planReload(result,next);assert.equal(plan.compatible,true,plan.reasons.join());
  const task=co.start(obj,'Value',[],{breakOnEntry:true}),script=reloadScript(plan,result,next,1).replace('(globalThis.Jailbreak)','(JB)');
  assert.throws(()=>new Function('JB',script)(JB),/active debug/);co.command(task.taskId,'continue');assert.equal(await task.promise,1);
  new Function('JB',script)(JB);assert.equal(await co.start(obj,'Value').promise,2);assert.equal(obj.Value(),2);
});
test('native execution mode remains synchronous and release excludes continuation code',()=>{
  const {obj}=setup(source);assert.equal(obj.Main(2),6);
  const release=compileProject({'A.cs':source},{cooperativeDebug:true});assert.equal(release.debug,undefined);assert.doesNotMatch(release.code,/checkpoint|co\.register|yield\*/);
});

test('session disposal completes awaited cleanup using captured continuation context',async()=>{
  const {JB,obj,co}=setup('public class A {public int count=0;public async Task Run(){try{await Task.Delay(1);count++;}finally{await Cleanup();count+=100;}}public async Task Cleanup(){await Task.Delay(2);Count();}public void Count(){count+=10;}}'),resolvers=[];
  JB.Task.Delay=()=>new Promise(r=>resolvers.push(r));const task=co.start(obj,'Run');JB.dev.dispose();assert.equal(JB.dev,undefined);
  resolvers[0]();await tick();assert.equal(obj.count,0);resolvers[1]();await task.promise;assert.equal(obj.count,110);assert.equal(co.busy,false);
});
test('multiple paused invocations retain independent frames and validate budgets',async()=>{
  const {obj,co,events}=setup(source),a=co.start(obj,'Main',[1],{breakOnEntry:true}),b=co.start(obj,'Main',[10],{breakOnEntry:true});
  const frameB=events.at(-1).data.frames[0].id;assert.throws(()=>co.inspectFrame(a.taskId,frameB));co.command(a.taskId,'continue');assert.equal(await a.promise,4);assert.equal(co.state()[0].status,'paused');co.command(b.taskId,'continue');assert.equal(await b.promise,22);
  assert.throws(()=>createCooperativeDebugger({quantum:0}),/budgets/);
});
