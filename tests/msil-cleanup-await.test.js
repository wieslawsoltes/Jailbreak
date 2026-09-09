import test from 'node:test';
import assert from 'node:assert/strict';
import {compileIL} from '../packages/msil-compiler/verified.js';
import {createBinaryRuntime} from '../packages/msil-runtime/index.js';
import {createCooperativeDebugger} from '../packages/development/cooperative-debugger.js';

test('cancelling cleanup waiting on another type initializer preserves the awaited value',async()=>{
  const source=`.assembly Concurrent {}
 .class public Concurrent.B {
 .field public static int32 value
 .method private static void .cctor() cil managed { ldc.i4.s 42 stsfld int32 Concurrent.B::value ret }
 .method public static int32 Get() cil managed { ldsfld int32 Concurrent.B::value ret }
 }
 .class public Concurrent.A {
 .field public static int32 trace
 .method public static void Run() cil managed {
 .try { leave end } finally { ldsfld int32 Concurrent.B::value stsfld int32 Concurrent.A::trace endfinally }
 end: ret }
 .method public static int32 Trace() cil managed { ldsfld int32 Concurrent.A::trace ret }
 }`;
  const result=compileIL(source,{debug:true,cooperativeDebug:true});assert.equal(result.success,true,JSON.stringify(result.diagnostics));
  const MS=createBinaryRuntime();new Function('MS',result.code)(MS);
  const co=MS.createDebugger({breakpoint:p=>p.method==='Concurrent.B..cctor'&&p.ilOffset===0});
  const B=MS.getType('Concurrent','Concurrent.B'),A=MS.getType('Concurrent','Concurrent.A');
  const initializer=co.start(B,'Get'),cleanup=co.start(A,'Run');
  assert.equal(co.state().find(t=>t.taskId===cleanup.taskId).status,'awaiting');
  co.command(cleanup.taskId,'cancel');
  assert.equal(co.state().find(t=>t.taskId===cleanup.taskId)?.status,'awaiting','Cancellation must not manufacture a value for pending cleanup');
  co.command(initializer.taskId,'continue');assert.equal(await initializer.promise,42);await cleanup.promise;
  assert.equal(A.Trace(),42);assert.equal(co.busy,false);
});

test('silent compiled safepoints keep long non-source regions cancellable without extra visible stops',async()=>{
  const co=createCooperativeDebugger({point:()=>null,quantum:2}),seen=[];
  const task=co.run((function*(){const frame=co.enter('owned silent region');try{while(true){seen.push('tick');yield {kind:'safepoint',critical:false};}}finally{seen.push('finally');co.leave(frame);}})());
  assert.equal(co.state()[0].status,'scheduled');assert.equal(seen.length,2);
  co.command(task.taskId,'cancel');await task.promise;assert.equal(seen.at(-1),'finally');assert.equal(co.busy,false);
});
