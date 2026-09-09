import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileAssembly,compileAssemblies,compileIL,parseIL} from '../packages/msil-compiler/verified.js';
import {compileBinaryInputs} from '../packages/msil-compiler/debug.js';
import {createBinaryRuntime} from '../packages/msil-runtime/index.js';
import {createCooperativeDebugger} from '../packages/development/cooperative-debugger.js';
import {createRuntime} from '../packages/avalonia-runtime/index.js';
import {compileWorkspaceInputs,encodeBinaryFile} from '../packages/binary-project/workspace.js';
import {convertNuget} from '../packages/nuget/index.js';
import {exceptionCasesAsync} from './helpers/exception-cases.js';
const opts={debug:true,cooperativeDebug:true};
const fixture=name=>JSON.parse(fs.readFileSync(new URL('./fixtures/msil/'+name+'.json',import.meta.url),'utf8'));
const bytes=(f,name)=>Buffer.from(f.files[name].base64,'base64');
function setup(compiled,{breakpoint=()=>false,...options}={}){
  assert.equal(compiled.success,true,JSON.stringify(compiled.diagnostics));
  const MS=createBinaryRuntime(options),events=[],co=createCooperativeDebugger({point:()=>null,breakpoint,report:(event,data)=>events.push({event,data})});
  new Function('MS',compiled.code)(MS);MS.enableCooperative(co);
  const run=(object,name,...args)=>co.start(object,name,args).promise;
  return {MS,co,events,run};
}
const tick=()=>new Promise(r=>setTimeout(r,0));
function program(body,{returns='int32',params='',locals=''}={}){return `.assembly Demo {} .class public Demo.C { .method public static ${returns} Run(${params}) cil managed { .maxstack 8 ${locals} ${body} } }`;}
function proxy(co,Type){return new Proxy({}, {get:(_,name)=>(...args)=>co.start(Type,name,args).promise});}

test('all owned baseline CLR results also execute through the cooperative emitter',async()=>{
  const f=fixture('fixture'),{MS,co,run}=setup(compileAssembly(bytes(f,'Jailbreak.BinaryExamples.dll'),opts)),a='Jailbreak.BinaryExamples';
  const C=MS.getType(a,'BinaryExamples.Calculator'),State=MS.getType(a,'BinaryExamples.State'),Named=MS.getType(a,'BinaryExamples.NamedCounter');
  const named=await co.run(co.construct(Named,[1])).promise;
  const result={Add:await run(C,'Add',40,2),Multiply:await run(C,'Multiply',123456,654321),Sum:await run(C,'SumTo',100),Factorial:await run(C,'Factorial',6),Choice:await run(C,'Choose',2),Sequence:await run(C,'Sequence',5),Scale:await run(C,'Scale',2.5,3),Greeting:await run(C,'Greet','browser'),Counter:await run(C,'UseCounter',10),State1:await run(State,'Next'),State2:await run(State,'Next'),Virtual:await run(named,'Describe')};
  assert.deepEqual(result,f.oracle);assert.equal(co.busy,false);assert.equal(MS.stats().depth,0);
});
for(const kind of ['DLL','NuGet'])test('cooperative '+kind+' matches all 35 independent CLR exception cases',async()=>{
  const f=fixture('exceptions'),compiled=kind==='DLL'?compileAssembly(bytes(f,'Jailbreak.ExceptionExamples.dll'),opts):await convertNuget(bytes(f,'Jailbreak.ExceptionExamples.1.0.0.nupkg'),{...opts,targetFramework:'net8.0'});
  const {MS,co}=setup(compiled),C=MS.getType('Jailbreak.ExceptionExamples','ExceptionExamples.Recovery');
  assert.deepEqual(await exceptionCasesAsync(proxy(co,C)),f.oracle);assert.equal(co.busy,false);
});
test('nested calls keep actual evaluation stacks and support step into over and out',async()=>{
  const src=`.assembly Demo {} .class public Demo.C {
 .method public static int32 Run(int32 x) cil managed { ldc.i4.5 ldarg.0 call int32 Demo.C::Twice(int32) add ret }
 .method public static int32 Twice(int32 x) cil managed { ldarg.0 ldc.i4.2 mul ret }
 }`,{MS,co,events}=setup(compileIL(src,opts)),C=MS.getType('Demo','Demo.C'),t=co.start(C,'Run',[3],{breakOnEntry:true});
  co.command(t.taskId,'into');co.command(t.taskId,'into');
  assert.deepEqual(events.at(-1).data.frames[0].locals.$evaluationStack,[5,3]);
  co.command(t.taskId,'into');let frames=events.at(-1).data.frames;
  assert.equal(frames.length,2);assert.equal(frames[0].method,'Demo.C.Twice');assert.deepEqual(frames[1].locals.$evaluationStack,[5]);
  co.command(t.taskId,'out');assert.equal(events.at(-1).data.frames.length,1);assert.deepEqual(events.at(-1).data.frames[0].locals.$evaluationStack,[5,6]);
  co.command(t.taskId,'continue');assert.equal(await t.promise,11);
});
test('PDB breakpoints pause with real scoped locals and scalar edits change the result',async()=>{
  const f=fixture('pdb'),compiled=await compileBinaryInputs(['Jailbreak.PdbExamples.dll','Jailbreak.PdbExamples.pdb'].map(path=>({path,bytes:bytes(f,path)})),opts);
  const {MS,co,events}=setup(compiled,{breakpoint:(p,read)=>p.line===10&&read().i===3});
  const C=MS.getType('Jailbreak.PdbExamples','PdbExamples.Calculations'),t=co.start(C,'Sum',[5]);
  const stop=events.at(-1).data;assert.equal(stop.point.origin,'msil');assert.equal(stop.point.cooperative,true);
  const frame=stop.frames[0];assert.equal(frame.locals.total,3);assert.ok(frame.editable.includes('total'));
  assert.throws(()=>co.setLocal(t.taskId,frame.id,'total',2147483648),/integer/);
  co.setLocal(t.taskId,frame.id,'total',100);co.command(t.taskId,'continue');assert.equal(await t.promise,107);
  assert.throws(()=>co.setLocal(t.taskId,frame.id,'total',1),/paused/);
});
test('source CSharp steps into a package DLL using Studio shared frames and returns to its caller',async()=>{
  const f=fixture('pdb'),files={'Main.cs':'public class Main { public int Run(){int result=PdbExamples.Calculations.Sum(5);return result+1;} }','library.binary.json':encodeBinaryFile('Jailbreak.PdbExamples.1.0.0.nupkg',bytes(f,'Jailbreak.PdbExamples.1.0.0.nupkg'))};
  const r=await compileWorkspaceInputs(files,opts);assert.equal(r.success,true,JSON.stringify(r.diagnostics));
  const JB=createRuntime(),events=[];JB.enableDevelopment({debug:r.debug,nativeBreaks:false,breakpoints:[{file:Object.keys(r.debug.sources)[0],line:10,condition:'i == 2'}],report:(event,data)=>events.push({event,data})});
  new Function('JB',r.code)(JB);const root=new (JB.types.get('Main'))(),task=JB.dev.co.start(root,'Run');
  const pause=events.findLast(e=>e.event==='debug-paused').data;assert.equal(pause.frames.length,2);assert.equal(pause.frames[0].method,'PdbExamples.Calculations.Sum');assert.equal(pause.frames[1].method,'Main.Run');
  JB.dev.co.command(task.taskId,'out');assert.equal(events.findLast(e=>e.event==='debug-paused').data.frames[0].method,'Main.Run');
  JB.dev.co.command(task.taskId,'continue');assert.equal(await task.promise,11);JB.dev.dispose();
});
test('no-symbol DLLs expose labeled read-only disassembly rather than invented CSharp',()=>{
  const f=fixture('fixture'),r=compileAssembly(bytes(f,'Jailbreak.BinaryExamples.dll'),opts);
  assert.equal(r.success,true);assert.ok(r.debug.sites.length>100);assert.ok(r.debug.sites.every(p=>p.sourceKind==='disassembly'&&p.language==='msil'));
  for(const p of r.debug.sites){const text=r.debug.sources[p.file];assert.match(text.slice(p.offset),/^IL_/);assert.match(p.file,/^jailbreak-il\//);}
});
test('authored IL retains its actual file text and coordinates',()=>{
  const text=program('ldc.i4.1\nret'),r=compileIL(text,{...opts,path:'Original.il'});assert.equal(r.debug.sources['Original.il'],text);
  assert.equal(r.debug.sites[1].offset,text.indexOf('ret'));assert.ok(r.debug.sites.every(p=>p.sourceKind==='il-source'));
});
test('cancelling before a throwing instruction runs nested finally exactly once and skips tail',async()=>{
  const f=fixture('exceptions'),r=compileAssembly(bytes(f,'Jailbreak.ExceptionExamples.dll'),opts);
  const point=r.debug.sites.find(p=>p.method.endsWith('.NestedFinally')&&r.debug.sources[p.file].slice(p.offset).split('\n')[0].includes('div'));
  const {MS,co}=setup(r,{breakpoint:p=>p.id===point.id}),C=MS.getType('Jailbreak.ExceptionExamples','ExceptionExamples.Recovery');
  const t=co.start(C,'NestedFinally',[2]);assert.equal(co.state()[0].status,'paused');co.command(t.taskId,'cancel');await t.promise;
  assert.equal(C.Trace(),123);assert.equal(co.busy,false);
});
test('cancel during active finally defers until cleanup finishes and does not rerun it',async()=>{
  const f=fixture('exceptions'),r=compileAssembly(bytes(f,'Jailbreak.ExceptionExamples.dll'),opts),m=r.assemblies[0].methods.find(m=>m.name==='NestedFinally');
  const clause=m.exceptionClauses.find(c=>c.kind==='finally'),point=r.debug.sites.find(p=>p.token===m.token&&p.ilOffset===clause.handlerOffset+5);
  assert.ok(point);const {MS,co}=setup(r,{breakpoint:p=>p.id===point.id}),C=MS.getType('Jailbreak.ExceptionExamples','ExceptionExamples.Recovery');
  const t=co.start(C,'NestedFinally',[2]);assert.equal(co.state()[0].status,'paused');co.command(t.taskId,'cancel');await t.promise;
  assert.equal(C.Trace(),123);assert.equal(co.busy,false);
});
test('unwind state survives pausing at every instruction through nested catches and finally',async()=>{
  const f=fixture('exceptions'),{MS,co}=setup(compileAssembly(bytes(f,'Jailbreak.ExceptionExamples.dll'),opts),{breakpoint:()=>true});
  const C=MS.getType('Jailbreak.ExceptionExamples','ExceptionExamples.Recovery'),t=co.start(C,'NestedCatchInFinally',[0]);let stops=0;
  while(co.state().some(s=>s.status==='paused')){assert.ok(++stops<300);co.command(t.taskId,'continue');}
  assert.equal(await t.promise,789);assert.ok(stops>20);assert.equal(C.Trace(),789);
});
test('suspended static initialization blocks competing debug tasks and fails closed for native calls',async()=>{
  const f=fixture('fixture'),r=compileAssembly(bytes(f,'Jailbreak.BinaryExamples.dll'),opts),p=r.debug.sites.find(p=>p.method.endsWith('.State..cctor'));
  assert.ok(p);const {MS,co}=setup(r,{breakpoint:q=>q.id===p.id}),C=MS.getType('Jailbreak.BinaryExamples','BinaryExamples.State');
  const first=co.start(C,'Next');assert.equal(co.state()[0].status,'paused');const second=co.start(C,'Next');assert.equal(co.state()[1].status,'awaiting');
  assert.throws(()=>C.Next(),/initialization is suspended/);co.command(first.taskId,'continue');assert.equal(await first.promise,6);assert.equal(await second.promise,7);assert.equal(co.busy,false);
});
test('cancelled static initialization releases waiters and caches its failure',async()=>{
  const f=fixture('fixture'),r=compileAssembly(bytes(f,'Jailbreak.BinaryExamples.dll'),opts),p=r.debug.sites.find(p=>p.method.endsWith('.State..cctor'));
  const {MS,co}=setup(r,{breakpoint:q=>q.id===p.id}),C=MS.getType('Jailbreak.BinaryExamples','BinaryExamples.State');
  const first=co.start(C,'Next'),second=co.start(C,'Next');const failure=assert.rejects(second.promise,/initialization cancelled/);
  co.command(first.taskId,'cancel');await first.promise;await failure;assert.throws(()=>C.Next(),/initialization cancelled/);assert.equal(co.busy,false);
});
test('per-task binary instruction budgets remain independent across interleaved pauses',async()=>{
  const src=program('ldarg.0\nldc.i4.1\nadd\nret',{params:'int32 x'}),{MS,co}=setup(compileIL(src,opts),{instructionBudget:4});
  const C=MS.getType('Demo','Demo.C'),a=co.start(C,'Run',[1],{breakOnEntry:true}),b=co.start(C,'Run',[2],{breakOnEntry:true});
  for(let i=0;i<3;i++){co.command(a.taskId,'into');co.command(b.taskId,'into');}
  co.command(a.taskId,'continue');co.command(b.taskId,'continue');assert.equal(await a.promise,2);assert.equal(await b.promise,3);
});
test('silent PDB checkpoints still yield to the event loop and permit loop cancellation',async()=>{
  const r=compileIL(program('again: br.s again',{returns:'void'}),opts);const {MS,co}=setup(r,{instructionBudget:100000});const C=MS.getType('Demo','Demo.C');
  const task=co.start(C,'Run');assert.ok(co.busy);await tick();co.command(task.taskId,'cancel');await task.promise;assert.equal(co.busy,false);
});
test('cross-assembly calls link through exact signatures during continuation stepping',async()=>{
  const a=parseIL('.assembly A {} .class public A.C { .method public static int32 Run() cil managed { ldc.i4 40 call int32 [B]B.C::PlusTwo(int32) ret } }',{path:'A.il'});
  const b=parseIL('.assembly B {} .class public B.C { .method public static int32 PlusTwo(int32 n) cil managed { ldarg.0 ldc.i4.2 add ret } }',{path:'B.il'});
  const {MS,co}=setup(compileAssemblies([{assembly:a},{assembly:b}],opts));assert.equal(await co.start(MS.getType('A','A.C'),'Run').promise,42);
});
test('native and release execution remain synchronous with no emitted continuation factories',()=>{
  const source=program('ldc.i4.1 ret'),release=compileIL(source,{cooperativeDebug:true}),debug=compileIL(source,{debug:true});
  for(const r of [release,debug]){assert.equal(r.success,true);assert.doesNotMatch(r.code,/callSteps|safepoint|function\*/);const MS=createBinaryRuntime();new Function('MS',r.code)(MS);assert.equal(MS.getType('Demo','Demo.C').Run(),1);}
  assert.equal(release.debug,undefined);
});
test('unsupported IL still blocks all executable output in cooperative builds',()=>{
  for(const body of ['ldc.i4.1 box [System.Runtime]System.Int32 ret','ldarg.0 ret','add ret']){const r=compileIL(program(body),opts);assert.equal(r.success,false);assert.equal(r.code,'');}
});

test('async source callers retain task results around compiled DLL continuations',async()=>{
  const f=fixture('pdb'),files={'Main.cs':'public class Main { public async Task<int> Run(){await Task.Delay(1);int value=PdbExamples.Calculations.Sum(5);await Task.Delay(1);return value+2;} }','library.binary.json':encodeBinaryFile('Jailbreak.PdbExamples.1.0.0.nupkg',bytes(f,'Jailbreak.PdbExamples.1.0.0.nupkg'))};
  const r=await compileWorkspaceInputs(files,opts);assert.equal(r.success,true,JSON.stringify(r.diagnostics));const JB=createRuntime();JB.enableDevelopment({debug:r.debug,nativeBreaks:false});new Function('JB',r.code)(JB);
  assert.equal(await JB.dev.co.start(new (JB.types.get('Main'))(),'Run').promise,12);assert.equal(JB.dev.co.busy,false);JB.dev.dispose();
});
test('cancelling a binary callee also unwinds its source callers finally without executing its tail',async()=>{
  const f=fixture('pdb'),files={'Main.cs':'public class Main { public int count=0; public int Run(){try{int value=PdbExamples.Calculations.Sum(5);count++;return value;}finally{count+=10;}} }','library.binary.json':encodeBinaryFile('Jailbreak.PdbExamples.1.0.0.nupkg',bytes(f,'Jailbreak.PdbExamples.1.0.0.nupkg'))};
  const r=await compileWorkspaceInputs(files,opts);assert.equal(r.success,true);const JB=createRuntime();JB.enableDevelopment({debug:r.debug,nativeBreaks:false,breakpoints:[{file:Object.keys(r.debug.sources)[0],line:10}]});new Function('JB',r.code)(JB);
  const root=new (JB.types.get('Main'))(),t=JB.dev.co.start(root,'Run');assert.ok(JB.dev.co.state().some(t=>t.status==='paused'));JB.dev.co.command(t.taskId,'cancel');await t.promise;assert.equal(root.count,10);JB.dev.dispose();
});
test('binary instruction and recursion failures release frames and later invocations start fresh',async()=>{
  const f=fixture('fixture'),{MS,co}=setup(compileAssembly(bytes(f,'Jailbreak.BinaryExamples.dll'),opts),{instructionBudget:40,maxDepth:3}),C=MS.getType('Jailbreak.BinaryExamples','BinaryExamples.Calculator');
  await assert.rejects(co.start(C,'SumTo',[100]).promise,/budget/);assert.equal(co.busy,false);
  await assert.rejects(co.start(C,'Factorial',[8]).promise,/recursion/);assert.equal(co.busy,false);
  assert.equal(await co.start(C,'Add',[40,2]).promise,42);
});
test('debugger cancellation does not execute IL fault handlers',async()=>{
  const source=`.assembly Demo {} .class public Demo.C {
 .field public static int32 trace
 .method public static void Run() cil managed { .maxstack 2
 .try { loop: br.s loop } fault { ldc.i4.1 stsfld int32 Demo.C::trace endfinally }
 }
 .method public static int32 Trace() cil managed { ldsfld int32 Demo.C::trace ret }
 }`;
  const {MS,co}=setup(compileIL(source,opts)),C=MS.getType('Demo','Demo.C'),t=co.start(C,'Run',[],{breakOnEntry:true});
  co.command(t.taskId,'cancel');await t.promise;assert.equal(C.Trace(),0);
});
