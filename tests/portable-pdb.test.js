import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readPortablePdb,pdbSources,inflateBounded} from '../packages/portable-pdb/index.js';
import {prepareDebugAssembly,debugSymbols} from '../packages/portable-pdb/symbols.js';
import {compileBinaryInputs} from '../packages/msil-compiler/debug.js';
import {convertNugetPackages} from '../packages/nuget/index.js';
import {compileWorkspaceInputs,encodeBinaryFile} from '../packages/binary-project/workspace.js';
import {createBinaryRuntime} from '../packages/msil-runtime/index.js';
import {createRuntime} from '../packages/avalonia-runtime/index.js';
import {deflateRawSync} from 'node:zlib';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/msil/pdb.json',import.meta.url),'utf8'));
const bytes=name=>Buffer.from(fixture.files[name].base64,'base64');
const dll='Jailbreak.PdbExamples.dll',pdbName='Jailbreak.PdbExamples.pdb',pkg='Jailbreak.PdbExamples.1.0.0.nupkg';
const inputs=()=>[{path:dll,bytes:bytes(dll)},{path:pdbName,bytes:bytes(pdbName)}];
const compiled=()=>compileBinaryInputs(inputs(),{debug:true});
test('Portable PDB parser matches SDK metadata oracle without mutating a Buffer',()=>{
  const input=bytes(pdbName),before=Buffer.from(input),pdb=readPortablePdb(input);
  assert.deepEqual(input,before);assert.equal(pdb.id,fixture.oracle.id);
  assert.deepEqual(pdb.documents.map(({embedded,...d})=>d),fixture.oracle.documents);
  for(const expected of fixture.oracle.methods){const actual=pdb.methods.find(m=>m.token===expected.token);assert.deepEqual(actual.points,expected.points);assert.deepEqual(actual.scopes,expected.scopes);}
});
test('Embedded original C# source is decompressed and checksum verified',async()=>{
  const sources=await pdbSources(readPortablePdb(bytes(pdbName)));assert.deepEqual(Object.values(sources),[fixture.source]);
});
test('Changed supplied source fails its original checksum even when source is embedded',async()=>{
  const p=readPortablePdb(bytes(pdbName)),name=p.documents[0].name;
  await assert.rejects(()=>pdbSources(p,{sources:{[name]:fixture.source+'// changed'}}),/checksum/);
});
test('Embedded decompression validates exact output size and enforces bounds',async()=>{
  const data=new TextEncoder().encode('owned source\n'.repeat(100));const packed=deflateRawSync(data);
  assert.deepEqual(await inflateBounded(packed,data.length,data.length),data);
  await assert.rejects(()=>inflateBounded(packed,data.length-1,data.length),/declared size/);
  await assert.rejects(()=>inflateBounded(packed,data.length+1,data.length),/budget/);
  await assert.rejects(()=>inflateBounded(packed,data.length+1,data.length+1),/length mismatch/);
});
test('Assembly identity and PDB checksums reject modified symbol files',async()=>{
  const p=bytes(pdbName),model=readPortablePdb(p);p[model.idOffset]^=1;
  const result=await compileBinaryInputs([{path:dll,bytes:bytes(dll)},{path:pdbName,bytes:p}],{debug:true});
  assert.equal(result.success,false);assert.equal(result.code,'');assert.match(result.diagnostics[0].message,/identity/);
});
test('Only identity-validated assembly objects receive symbol metadata',async()=>{
  const a=await prepareDebugAssembly({path:dll,bytes:bytes(dll),pdb:bytes(pdbName)});
  assert.ok(debugSymbols(a));assert.equal(debugSymbols({...a}),undefined);
});
test('Debug compilation emits verified source sites and actual scoped locals',async()=>{
  const result=await compiled();assert.equal(result.success,true,JSON.stringify(result.diagnostics));
  assert.ok(result.debug.sites.length>10);assert.equal(result.debug.sites.some(s=>s.line===0xfeefee),false);
  const MS=createBinaryRuntime(),seen=[];MS.setDebugger((point,locals)=>{seen.push({point,locals:locals()});return false;});
  new Function('MS',result.code)(MS);const T=MS.getType('Jailbreak.PdbExamples','PdbExamples.Calculations');
  assert.equal(T.Sum(10),fixture.oracle.results.sum);assert.equal(T.Twice(9),fixture.oracle.results.twice);assert.equal(T.Guarded(2147483647),fixture.oracle.results.guarded);
  assert.ok(seen.some(e=>e.point.line===10&&e.locals.i===3&&e.locals.total===3));
});
test('Release binary compilation strips original sources and debug hooks',async()=>{
  const r=await compileBinaryInputs(inputs());assert.equal(r.success,true);assert.equal(r.debug,undefined);assert.doesNotMatch(r.code,/debugHit|@jb:|total \+= i/);
});
test('Local NuGet symbols use the same verified DLL compilation path',async()=>{
  const r=await convertNugetPackages([{path:pkg,bytes:bytes(pkg)}],{debug:true,targetFramework:'net8.0'});
  assert.equal(r.success,true,JSON.stringify(r.diagnostics));assert.ok(r.debug.sites.length);assert.deepEqual(Object.values(r.debug.sources),[fixture.source]);
});
test('Duplicate or unattached symbol files return diagnostics and no executable output',async()=>{
  for(const list of [[{path:pdbName,bytes:bytes(pdbName)}],[...inputs(),{path:pdbName,bytes:bytes(pdbName)}]]){
    const r=await compileBinaryInputs(list,{debug:true});assert.equal(r.success,false);assert.equal(r.code,'');
  }
});
test('Named Sum method in converted class is not lowered as LINQ Sum',async()=>{
  const base=new URL('../examples/PdbLibrary/',import.meta.url),files=Object.fromEntries(['MainView.axaml','MainView.axaml.cs','PdbLibrary.csproj'].map(n=>[n,fs.readFileSync(new URL(n,base),'utf8')]));
  files['library.binary.json']=encodeBinaryFile(pkg,bytes(pkg));
  const r=await compileWorkspaceInputs(files,{debug:true});assert.equal(r.success,true,JSON.stringify(r.diagnostics));
  const JB=createRuntime();new Function('JB',r.code)(JB);const root=JB.createFromXaml('PdbLibrary.MainView');root.Calculate(null,null);assert.equal(root.Result.Text,'Library sum: 45');root.Dispose();
});
