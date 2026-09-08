import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {readAssembly} from '../packages/managed-pe/structured.js';
import {Reader} from '../packages/managed-pe/reader.js';
import {compileAssembly,compileAssemblies,compileIL,parseIL,decodeIL} from '../packages/msil-compiler/verified.js';
import {createBinaryRuntime} from '../packages/msil-runtime/index.js';
import {compileBinaryProject} from '../packages/binary-project/index.js';
import {createRuntime} from '../packages/avalonia-runtime/index.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/msil/fixture.json',import.meta.url)));
const dll=Buffer.from(fixture.files['Jailbreak.BinaryExamples.dll'].base64,'base64'),assemblyName='Jailbreak.BinaryExamples';
function execute(c){assert.equal(c.success,true,JSON.stringify(c.diagnostics));const MS=createBinaryRuntime();new Function('MS',c.code)(MS);return MS;}
function il(body,{ret='int32',params='',locals='',max=8}={}){return `.assembly Test {} .class public Test.C extends [System.Runtime]System.Object { .method public static ${ret} Run(${params}) cil managed { .maxstack ${max} ${locals} ${body} } }`;}

test('SDK-built PE fixture identity, methods, properties and hashes',()=>{
 for(const f of Object.values(fixture.files))assert.equal(crypto.createHash('sha256').update(Buffer.from(f.base64,'base64')).digest('hex'),f.sha256);
 const a=readAssembly(dll);assert.equal(a.name,assemblyName);assert.equal(a.methods.length,21);assert.equal(a.types.length,5);assert.equal(a.references[0].name,'System.Runtime');assert.equal(a.types.find(t=>t.name==='BinaryExamples.Counter').properties[0].name,'Value');
});
test('actual converted DLL agrees with the independently recorded CLR oracle',()=>{
 const MS=execute(compileAssembly(dll)),C=MS.getType(assemblyName,'BinaryExamples.Calculator'),State=MS.getType(assemblyName,'BinaryExamples.State'),Named=MS.getType(assemblyName,'BinaryExamples.NamedCounter');
 const result={Add:C.Add(40,2),Multiply:C.Multiply(123456,654321),Sum:C.SumTo(100),Factorial:C.Factorial(6),Choice:C.Choose(2),Sequence:C.Sequence(5),Scale:C.Scale(2.5,3),Greeting:C.Greet('browser'),Counter:C.UseCounter(10),State1:State.Next(),State2:State.Next(),Virtual:new Named(1).Describe()};assert.deepEqual(result,fixture.oracle);
});
test('signed integer overflow, divide by zero, division overflow and unsigned bit reinterpretation',()=>{
 const C=execute(compileAssembly(dll)).getType(assemblyName,'BinaryExamples.Calculator');assert.equal(C.Add(2147483647,1),-2147483648);assert.equal(C.Divide(-7,2),-3);assert.throws(()=>C.Divide(1,0));assert.throws(()=>C.Divide(-2147483648,-1));
 const U=execute(compileIL(il('ldc.i4.m1 ldc.i4.2 div.un ret'))).getType('Test','Test.C');assert.equal(U.Run(),2147483647);
});
test('array bounds and constructor/property state are real runtime behaviors',()=>{
 const MS=execute(compileAssembly(dll)),C=MS.getType(assemblyName,'BinaryExamples.Calculator'),Counter=MS.getType(assemblyName,'BinaryExamples.Counter');assert.equal(C.SumArray([2,4,8]),14);assert.throws(()=>C.SumArray(null));assert.throws(()=>C.Sequence(-1));const c=new Counter(10);assert.equal(c.Value,10);c.Value=40;assert.equal(c.Increment(2),42);assert.throws(()=>c.Increment('bad'));
});
test('separate registrations do not share static initializer or instance state',()=>{
 const c=compileAssembly(dll),a=execute(c),b=execute(c);assert.equal(a.getType(assemblyName,'BinaryExamples.State').Next(),6);assert.equal(a.getType(assemblyName,'BinaryExamples.State').Next(),7);assert.equal(b.getType(assemblyName,'BinaryExamples.State').Next(),6);
});
test('emitted source consists of JS block functions and does not evaluate IL at runtime',()=>{
 const c=compileAssembly(dll);assert.match(c.code,/C\.D\.iadd/);assert.match(c.code,/case 0:/);assert.doesNotMatch(c.code,/decodeIL|eval\(|new Function/);assert.ok(c.assemblies[0].methods.some(m=>m.disassembly.includes('switch')));
});
test('invalid/truncated PE and oversized inputs produce diagnostics without output',()=>{
 for(const bytes of [new Uint8Array(),new Uint8Array(128),dll.subarray(0,512),dll.subarray(0,2000)]){const r=compileAssembly(bytes);assert.equal(r.success,false);assert.equal(r.code,'');}
 assert.equal(compileAssembly(dll,{maxBytes:100}).success,false);assert.equal(compileAssembly(dll,{maxRows:1}).success,false);
});
test('bounded reader respects subregions and compressed integer formats',()=>{
 const r=new Reader(Uint8Array.of(0x7f,0x80,0x80,0xc0,0,1,0));assert.equal(r.compressed(),127);assert.equal(r.compressed(),128);assert.equal(r.compressed(),256);assert.throws(()=>r.u8());assert.throws(()=>new Reader(Uint8Array.of(1),0,2));assert.throws(()=>new Reader(Uint8Array.of(0xff)).compressed());
});
test('instruction decoder rejects unknown/truncated opcodes and mid-instruction branch targets',()=>{
 for(const bytes of [[0x24],[0x20,0],[0xfe],[0x2b,0xff,0x2a],[0x45,255,255,255,255]])assert.throws(()=>decodeIL(Uint8Array.from(bytes)));
});
test('text IL supports labels, locals, loops and calls through the same verified backend',()=>{
 const src=il('ldc.i4.0 stloc.0 ldc.i4.1 stloc.1 br.s check body: ldloc.0 ldloc.1 add stloc.0 ldloc.1 ldc.i4.1 add stloc.1 check: ldloc.1 ldarg.0 ble.s body ldloc.0 ret',{params:'int32 n',locals:'.locals init ([0] int32 total,[1] int32 i)'});
 const C=execute(compileIL(src)).getType('Test','Test.C');assert.equal(C.Run(100),5050);
});
test('text IL string escaping is safe in generated script bodies',()=>{
 const r=compileIL(il('ldstr "</script>\\nIL_0: ret" ret',{ret:'string'}));const C=execute(r).getType('Test','Test.C');assert.equal(C.Run(),'</script>\nIL_0: ret');assert.ok(!r.code.includes('</script>'));
});
test('64-bit IL uses BigInt rather than lossy JavaScript doubles',()=>{
 const r=compileIL(il('ldc.i8 9223372036854775807 ldc.i8 1 add ret',{ret:'int64'}));assert.equal(execute(r).getType('Test','Test.C').Run(),-9223372036854775808n);
});
test('floating IL comparison, arithmetic and conversion',()=>{
 const r=compileIL(il('ldarg.0 ldc.r8 2.5 mul conv.i4 ret',{params:'float64 x'}));assert.equal(execute(r).getType('Test','Test.C').Run(3.2),8);
});
test('stack underflow, types, local bounds, argument bounds and invalid returns fail compilation',()=>{
 for(const body of ['add ret','ldc.i4.1 ldc.r8 2 add ret','ldloc.0 ret','ldarg.0 ret','ldc.i4.1 ldc.i4.2 ret','br.s missing','ldc.i4.1']){const r=compileIL(il(body));assert.equal(r.success,false,body);assert.equal(r.code,'');}
 assert.equal(compileIL(il('ldc.i4.1 ldc.i4.2 add ret',{max:1})).success,false);
});
test('incompatible stacks at joins fail before execution',()=>{
 const r=compileIL(il('ldarg.0 brtrue.s other ldc.i4.1 br.s done other: ldc.r8 1 done: ret',{params:'int32 x'}));assert.equal(r.success,false);assert.equal(r.code,'');
});
test('unsupported IL and exception sections are errors, never placeholder stubs',()=>{
 for(const body of ['ldarg.0 box [System.Runtime]System.Int32 ret','ldarg.0 conv.ovf.i ret','ldtoken [System.Runtime]System.Int32 ret'])assert.equal(compileIL(il(body,{params:'int32 a'})).success,false);
 const a=readAssembly(dll);a.methods[0].body.hasExceptionSections=true;const r=compileAssemblies([{assembly:a,path:'eh.dll'}]);assert.equal(r.success,false);assert.ok(r.diagnostics.some(d=>d.code==='JB6104'));
});
test('unresolved binary dependency calls and duplicate assembly identities are errors',()=>{
 const source=il('ldc.i4.1 call int32 [Missing]Library.C::Run(int32) ret');const r=compileIL(source);assert.equal(r.success,false);assert.match(r.diagnostics[0].message,/Missing/);assert.equal(compileAssemblies([{bytes:dll,path:'A'},{bytes:dll,path:'B'}]).success,false);
});
test('two explicit IL assemblies link by full owner and method signature',()=>{
 const a=parseIL('.assembly A {} .class public A.C { .method public static int32 Run() cil managed { ldc.i4 40 call int32 [B]B.C::PlusTwo(int32) ret } }');
 const b=parseIL('.assembly B {} .class public B.C { .method public static int32 PlusTwo(int32 n) cil managed { ldarg.0 ldc.i4.2 add ret } }');
 const MS=execute(compileAssemblies([{assembly:a,path:'A.il'},{assembly:b,path:'B.il'}]));assert.equal(MS.getType('A','A.C').Run(),42);
});
test('execution budgets guard infinite loops and recursive methods and recover per invocation',()=>{
 const c=compileIL(il('again: br.s again',{ret:'void'}));assert.equal(c.success,true);const MS=createBinaryRuntime({instructionBudget:20,maxDepth:8});new Function('MS',c.code)(MS);assert.throws(()=>MS.getType('Test','Test.C').Run(),/budget/);
 const binary=compileAssembly(dll),B=createBinaryRuntime({maxDepth:8});new Function('MS',binary.code)(B);const C=B.getType(assemblyName,'BinaryExamples.Calculator');assert.throws(()=>C.Factorial(100),/budget/);assert.equal(C.Add(1,2),3);assert.equal(B.stats().depth,0);
});
test('C# and XAML call the actual converted DLL through the shared type registry',()=>{
 const files={'Main.axaml':'<UserControl xmlns="https://github.com/avaloniaui" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" x:Class="Demo.Main"><TextBlock Name="Label"/></UserControl>','Main.cs':'using Avalonia.Controls;using BinaryExamples;namespace Demo;public partial class Main:UserControl {public Main(){InitializeComponent();Label.Text=Calculator.Greet("source + DLL");}public int Compute(){var c=new Counter(39);return c.Increment(3);}}'};
 const result=compileBinaryProject(files,[{bytes:dll,path:'Library.dll'}]);assert.equal(result.success,true,JSON.stringify(result.diagnostics));const JB=createRuntime();new Function('JB',result.code)(JB);const root=new (JB.types.get('Demo.Main'))();assert.equal(root.Label.Text,'Hello, source + DLL');assert.equal(root.Compute(),42);root.Dispose();
});

test('reference-only DLLs are explicitly rejected despite valid-looking method bodies',()=>{
 const bytes=Buffer.from(fixture.referenceOnly.base64,'base64');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),fixture.referenceOnly.sha256);
 const a=readAssembly(bytes);assert.equal(a.features.referenceAssembly,true);const r=compileAssembly(bytes);assert.equal(r.success,false);assert.equal(r.code,'');assert.ok(r.diagnostics.some(d=>d.message.includes('referenceAssembly')));
});
test('small integer array loads sign or zero extend and stores truncate',()=>{
 for(const [operation,expected]of [['i1',-1],['u1',255],['i2',-1],['u2',65535],['i4',-1],['u4',-1]]){
  const r=compileIL(il(`ldarg.0 ldc.i4.0 ldelem.${operation} ret`,{params:'int32[] data'}));assert.equal(execute(r).getType('Test','Test.C').Run([-1]),expected);
 }
 const r=compileIL(il('ldc.i4 255 stloc.0 ldloc.0 ret',{locals:'.locals init ([0] int8 n)'}));assert.equal(execute(r).getType('Test','Test.C').Run(),-1);
});
test('signed and unsigned widening preserve the intended i4 bits',()=>{
 for(const [op,expected]of [['i8',-1n],['u8',4294967295n]]){const r=compileIL(il(`ldc.i4.m1 conv.${op} ret`,{ret:'int64'}));assert.equal(execute(r).getType('Test','Test.C').Run(),expected);}
});
test('ILAsm operands, maxstack and duplicate definitions are validated',()=>{
 for(const code of ['ldc.i4.s 128 ret','ldc.i4 2147483648 ret','ldc.i4 1.5 ret'])assert.equal(compileIL(il(code)).success,false);
 for(const max of [-1,1.5,65536])assert.equal(compileIL(il('ldc.i4.1 ret',{max})).success,false);
 const a=parseIL(il('ldc.i4.1 ret'));a.methods.push({...a.methods[0],token:a.methods[0].token+1});assert.equal(compileAssemblies([{assembly:a}]).success,false);
 const empty=compileAssemblies([]);assert.equal(empty.success,false);assert.ok(empty.diagnostics.length);
});
test('text IL verifier errors retain source line plus separate IL offset',()=>{
 const code='.assembly Test {}\n.class public Test.C {\n.method public static int32 Bad() cil managed {\nldc.i4.1\nadd\nret\n}\n}';
 const r=compileIL(code,{path:'bad.il'});assert.equal(r.success,false);assert.equal(r.diagnostics[0].line,5);assert.equal(r.diagnostics[0].ilOffset,1);assert.equal(r.diagnostics[0].file,'bad.il');
});
test('binary runtime virtual dispatch works when the call uses a base method token',()=>{
 const r=compileAssembly(dll),MS=execute(r),Named=MS.getType(assemblyName,'BinaryExamples.NamedCounter');const base=r.assemblies[0].methods.find(m=>m.owner==='BinaryExamples.Counter'&&m.name==='Describe');assert.equal(MS.invoke(assemblyName,base.token,[],new Named(1)),'named counter');
});
