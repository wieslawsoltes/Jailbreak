import test from 'node:test';
import assert from 'node:assert/strict';
import {compileIL,parseIL,compileAssemblies} from '../packages/msil-compiler/verified.js';
import {createBinaryRuntime} from '../packages/msil-runtime/index.js';
import {createExceptionFrame,ExecutionLimitError} from '../packages/msil-runtime/exception-frame.js';
import {readExceptionSections} from '../packages/managed-pe/exception-sections.js';
import {Reader} from '../packages/managed-pe/reader.js';
import * as DN from '../packages/dotnet-runtime/index.js';

const wrap=(body,ret='int32',params='')=>`.assembly EH {} .class public E {
 .method public static ${ret} Run(${params}) cil managed { .locals init ([0] int32 result) ${body} }
}`;
function run(source,options){const c=compileIL(source);assert.equal(c.success,true,JSON.stringify(c.diagnostics));const MS=createBinaryRuntime(options);new Function('MS',c.code)(MS);return MS.getType('EH','E');}
const recover=`.try { ldc.i4 84 ldarg.0 div stloc.0 leave done }
 catch [System.Runtime]System.DivideByZeroException {pop ldc.i4.m1 stloc.0 leave done}
 done: ldloc.0 ret`;

test('typed catch handles arithmetic failure and leaves normal results untouched',()=>{
 const E=run(wrap(recover,'int32','int32 divisor'));
 assert.equal(E.Run(2),42);assert.equal(E.Run(0),-1);assert.equal(E.Run(-2),-42);
});
test('nested finally clauses unwind inside-out on normal leave',()=>{
 const E=run(wrap(`
 .try { .try { ldc.i4.1 stloc.0 leave done }
 finally { ldloc.0 ldc.i4 10 mul ldc.i4.2 add stloc.0 endfinally } }
 finally { ldloc.0 ldc.i4 10 mul ldc.i4.3 add stloc.0 endfinally }
 done: ldloc.0 ret`));assert.equal(E.Run(),123);
});
test('exception unwinding runs finally before entering an outer catch',()=>{
 const E=run(wrap(`.try {
 .try { ldc.i4.1 stloc.0 ldnull throw }
 finally { ldloc.0 ldc.i4 10 mul ldc.i4.2 add stloc.0 endfinally }
 } catch [System.Runtime]System.Exception {pop ldloc.0 ldc.i4 10 mul ldc.i4.3 add stloc.0 leave done}
 done: ldloc.0 ret`));assert.equal(E.Run(),123);
});
test('fault executes on exceptional exit but not leave',()=>{
 const E=run(wrap(`.try {
 .try { ldarg.0 brfalse ok ldnull throw ok: ldc.i4.5 stloc.0 leave done }
 fault { ldc.i4.7 stloc.0 endfinally }
 } catch [System.Runtime]System.Exception {pop ldloc.0 ldc.i4 10 add stloc.0 leave done}
 done: ldloc.0 ret`,'int32','int32 fail'));assert.equal(E.Run(0),5);assert.equal(E.Run(1),17);
});
test('catch dispatch respects metadata order and managed inheritance',()=>{
 const E=run(wrap(`.try {newobj instance void [System.Runtime]System.ArgumentNullException::.ctor() throw}
 catch [System.Runtime]System.ArithmeticException {pop ldc.i4.1 stloc.0 leave done}
 catch [System.Runtime]System.ArgumentException {pop ldc.i4.2 stloc.0 leave done}
 catch [System.Runtime]System.Exception {pop ldc.i4.3 stloc.0 leave done}
 done: ldloc.0 ret`));assert.equal(E.Run(),2);
});
test('rethrow preserves the original exception object',()=>{
 const E=run(wrap(`.try { .try { ldarg.0 throw }
 catch [System.Runtime]System.Exception {pop rethrow} }
 catch [System.Runtime]System.Exception {ldarg.0 ceq stloc.0 leave done}
 done: ldloc.0 ret`,'int32','class [System.Runtime]System.Exception error'));
 assert.equal(E.Run(new DN.InvalidOperationException('same')),1);
});
test('exception thrown from a finally supersedes the original exception',()=>{
 const E=run(wrap(`.try {
 .try {newobj instance void [System.Runtime]System.ArgumentException::.ctor() throw}
 finally {newobj instance void [System.Runtime]System.InvalidOperationException::.ctor() throw}
 } catch [System.Runtime]System.InvalidOperationException {pop ldc.i4.8 stloc.0 leave done}
 done: ldloc.0 ret`));assert.equal(E.Run(),8);
});
test('local catches and nested leave inside a finally preserve outer unwind continuation',()=>{
 const E=run(wrap(`.try {
 .try {ldnull throw}
 finally {
   .try { .try {newobj instance void [System.Runtime]System.ArgumentException::.ctor() throw}
    catch [System.Runtime]System.ArgumentException {pop ldc.i4.7 stloc.0 leave finish} }
   finally {ldloc.0 ldc.i4 10 mul ldc.i4.8 add stloc.0 endfinally}
   finish: endfinally
 }
 } catch [System.Runtime]System.NullReferenceException {pop ldloc.0 ldc.i4 10 mul ldc.i4.s 9 add stloc.0 leave done}
 done: ldloc.0 ret`));assert.equal(E.Run(),789);
});
test('leave empties the evaluation stack rather than carrying values to the target',()=>{
 const E=run(wrap(`.try {ldc.i4 100 leave done}
 finally {ldc.i4 42 stloc.0 endfinally}
 done: ldloc.0 ret`));assert.equal(E.Run(),42);
});
test('external exception constructors and Message adapters use shared exception objects',()=>{
 const source=wrap(`.try {ldstr "message" newobj instance void [System.Runtime]System.InvalidOperationException::.ctor(string) throw}
 catch [System.Runtime]System.Exception {callvirt instance string [System.Runtime]System.Exception::get_Message() stloc.0 leave done}
 done: ldloc.0 ret`,'string').replace('[0] int32 result','[0] string result');
 assert.equal(run(source).Run(),'message');
});
test('budget errors are not swallowed by catch System.Object',()=>{
 const E=run(wrap(`.try {again: br again}
 catch [System.Runtime]System.Object {pop ldc.i4.1 stloc.0 leave done}
 done: ldloc.0 ret`),{instructionBudget:12});assert.throws(()=>E.Run(),ExecutionLimitError);
});
test('shared arithmetic, null and array helpers throw the matching managed exception class',()=>{
 assert.throws(()=>DN.idiv(-2147483648,-1),DN.OverflowException);
 assert.throws(()=>DN.idiv(1,0),DN.ArithmeticException);
 assert.throws(()=>DN.length(null),DN.NullReferenceException);
 assert.throws(()=>DN.getIndex([0],2),DN.IndexOutOfRangeException);
 assert.throws(()=>DN.setIndex(null,0,1),DN.NullReferenceException);
});
for(const [op,a,b,result] of [['add.ovf',40,2,42],['sub.ovf',-2,5,-7],['mul.ovf',1000,1000,1000000],['add.ovf.un',2147483648,1,-2147483647]]){
 test(op+' emits exact checked arithmetic',()=>{const E=run(wrap(`ldarg.0 ldarg.1 ${op} ret`,'int32','int32 a,int32 b'));assert.equal(E.Run(a,b),result);});
}
test('signed, unsigned and long checked overflow boundaries',()=>{
 for(const [op,a,b,k] of [['add.ovf',2147483647,1,'i4'],['sub.ovf',-2147483648,1,'i4'],['mul.ovf',123456789,123456789,'i4'],['add.ovf.un',-1,1,'i4'],['sub.ovf.un',0,1,'i4'],['mul.ovf',9223372036854775807n,2n,'i8']])assert.throws(()=>DN.checkedBinary(op,a,b,k),DN.OverflowException);
 assert.equal(DN.checkedBinary('mul.ovf',9007199254740993n,1n,'i8'),9007199254740993n);
 const E=run(wrap(`.try {ldarg.0 ldarg.1 add.ovf stloc.0 leave done}
 catch [System.Runtime]System.OverflowException {pop ldc.i4.s -10 stloc.0 leave done}
 done: ldloc.0 ret`,'int32','int32 a,int32 b'));assert.equal(E.Run(2147483647,1),-10);assert.equal(E.Run(40,2),42);
});
test('checked conversions truncate floating values then validate exact bounds',()=>{
 assert.equal(DN.checkedConvert('conv.ovf.i4',-42.75,'f'),-42);
 assert.equal(DN.checkedConvert('conv.ovf.u8.un',-1,'i4'),4294967295n);
 assert.equal(DN.checkedConvert('conv.ovf.i8',2**53,'f'),9007199254740992n);
 for(const [op,x,k]of [['conv.ovf.u1',256,'i4'],['conv.ovf.u1',-1,'i4'],['conv.ovf.i4',2147483648,'f'],['conv.ovf.i8',2**63,'f'],['conv.ovf.u8',-1,'i4'],['conv.ovf.i4',NaN,'f'],['conv.ovf.i4',Infinity,'f']])assert.throws(()=>DN.checkedConvert(op,x,k),DN.OverflowException);
});
test('verifier rejects illegal handler entry, exit, return, rethrow and endfinally',()=>{
 const invalid=[
  '.try {br handler} catch [System.Runtime]System.Exception {handler: pop leave done} done: ldc.i4.0 ret',
  '.try {ldc.i4.1 ret} finally {endfinally}',
  '.try {nop} finally {endfinally} ldc.i4.0 ret',
  '.try {leave done} finally {leave done} done: ldc.i4.0 ret',
  'rethrow', 'endfinally',
  '.try {leave done} catch [System.Runtime]System.Exception {endfinally} done: ldc.i4.0 ret',
  '.try {leave done} finally {ldc.i4.1 endfinally} done: ldc.i4.0 ret'
 ];
 for(const body of invalid){const c=compileIL(wrap(body));assert.equal(c.success,false,body);assert.equal(c.code,'');}
});
test('malformed, partially overlapping and unsupported exception metadata cannot emit code',()=>{
 const base=parseIL(wrap(recover,'int32','int32 divisor'));
 for(const change of [c=>c.tryOffset++,c=>c.handlerLength++,c=>c.kind='filter',c=>c.catchType={name:'NotAnException',assembly:'Unknown'}]){
  const a=parseIL(wrap(recover,'int32','int32 divisor'));change(a.methods[0].body.exceptionClauses[0]);const c=compileAssemblies([{assembly:a}]);assert.equal(c.success,false);assert.equal(c.code,'');
 }
 const a=parseIL(wrap(recover,'int32','int32 divisor'));a.methods[0].body.exceptionClauses.push({...base.methods[0].body.exceptionClauses[0]});assert.equal(compileAssemblies([{assembly:a}]).success,false);
});
test('small and fat binary exception sections decode identically',()=>{
 const type={name:'System.Exception',assembly:'System.Runtime'};
 for(const fat of [false,true]){
  const b=new Uint8Array(fat?28:16),v=new DataView(b.buffer);b[0]=fat?0x41:1;b[1]=b.length;
  if(fat){v.setUint32(4,0,true);v.setUint32(8,0,true);v.setUint32(12,4,true);v.setUint32(16,4,true);v.setUint32(20,3,true);v.setUint32(24,0x01000001,true);}
  else {v.setUint16(4,0,true);v.setUint16(6,0,true);b[8]=4;v.setUint16(9,4,true);b[11]=3;v.setUint32(12,0x01000001,true);}
  const r=new Reader(b),read=()=>readExceptionSections(r,0,10,t=>{assert.equal(t,0x01000001);return type;},(p,n)=>r.check(p,n));
  assert.deepEqual(read(),[{kind:'catch',tryOffset:0,tryLength:4,handlerOffset:4,handlerLength:3,catchType:type}]);
  b[1]--;assert.throws(read);b[1]++;b[0]=2;assert.throws(read);
 }
});
test('runtime exception frames remain independent between recursive calls',()=>{
 const c={id:0,kind:'catch',tryOffset:0,tryLength:5,handlerOffset:5,handlerLength:5,catchType:{}};
 const a=createExceptionFrame([c],()=>true),b=createExceptionFrame([c],()=>true),x=new DN.Exception('a'),y=new DN.Exception('b');
 a.raise(x,0);b.raise(y,0);assert.equal(a.rethrow(5),x);assert.equal(b.rethrow(5),y);
});

test('real SDK DLL and NuGet package match every recorded CLR result and cleanup trace',async()=>{
 const fs=await import('node:fs');const {createHash}=await import('node:crypto');
 const {compileAssembly,readAssembly}=await import('../packages/msil-compiler/verified.js');
 const {convertNuget}=await import('../packages/nuget/index.js');
 const {exceptionCases}=await import('./helpers/exception-cases.js');
 const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/msil/exceptions.json',import.meta.url)));
 for(const f of Object.values(fixture.files))assert.equal(createHash('sha256').update(Buffer.from(f.base64,'base64')).digest('hex'),f.sha256);
 const dll=Buffer.from(fixture.files['Jailbreak.ExceptionExamples.dll'].base64,'base64');
 const model=readAssembly(dll);
 assert.deepEqual(model.methods.map(m=>({method:m.name,token:m.token,clauses:m.body.exceptionClauses.map(c=>({...c,catchType:c.catchType?.name??null}))})),fixture.regions);
 for(const c of [compileAssembly(dll),await convertNuget(Buffer.from(fixture.files['Jailbreak.ExceptionExamples.1.0.0.nupkg'].base64,'base64'),{targetFramework:'net8.0'})]){
  assert.equal(c.success,true,JSON.stringify(c.diagnostics));const MS=createBinaryRuntime();new Function('MS',c.code)(MS);
  assert.deepEqual(exceptionCases(MS.getType('Jailbreak.ExceptionExamples','ExceptionExamples.Recovery')),fixture.oracle);
 }
});
test('C# can catch shared exception classes produced by a converted DLL',async()=>{
 const fs=await import('node:fs');const {compileWorkspaceInputs}=await import('../packages/binary-project/workspace.js');
 const {createRuntime}=await import('../packages/avalonia-runtime/index.js');
 const dir=new URL('../examples/ExceptionLibrary/',import.meta.url),files=Object.fromEntries(fs.readdirSync(dir).map(name=>[name,fs.readFileSync(new URL(name,dir),'utf8')]));
 const c=await compileWorkspaceInputs(files);assert.equal(c.success,true,JSON.stringify(c.diagnostics));
 const JB=createRuntime();new Function('JB',c.code)(JB);const view=new (JB.types.get('RecoveryDemo.MainView'))();
 view.CatchOverflow(null,null);assert.equal(view.Result.Text,'Caught DLL OverflowException in C#');assert.equal(view.Cleanup.Text,'C# finally completed');
 view.NestedCleanup(null,null);assert.equal(view.Result.Text,'Nested result: -4; cleanup order: 12345');view.Dispose();
});

test('handler entry and malformed predecoded instruction models are rejected before emission',()=>{
 const illegal=wrap(`finallyStart: endfinally
 .try {leave done} finally {endfinally}
 done: ldc.i4.0 ret`);
 const model=parseIL(illegal),method=model.methods[0];
 method.body.exceptionClauses[0].handlerOffset=0;method.body.exceptionClauses[0].handlerLength=1;
 assert.equal(compileAssemblies([{assembly:model}]).success,false);
 for(const mutate of [i=>i.operand='0;throw 42',i=>i.offset='0;throw 42',i=>i.next=0,i=>i.operand=0.5]){
  const a=parseIL(wrap('ldc.i4 42 ret'));mutate(a.methods[0].instructions[0]);
  const compiled=compileAssemblies([{assembly:a}]);assert.equal(compiled.success,false);assert.equal(compiled.code,'');
 }
});
