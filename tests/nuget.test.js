import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {deflateRawSync} from 'node:zlib';
import {readZip,crc32,inspectNuget,convertNuget,satisfiesVersion} from '../packages/nuget/index.js';import {createBinaryRuntime} from '../packages/msil-runtime/index.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/msil/fixture.json',import.meta.url))),dll=Buffer.from(fixture.files['Jailbreak.BinaryExamples.dll'].base64,'base64'),packageBytes=Buffer.from(fixture.files['Jailbreak.BinaryExamples.1.0.0.nupkg'].base64,'base64');
function zip(entries,{deflate=false}={}){const locals=[],central=[];let offset=0;for(const [name,input]of entries){const bytes=Buffer.from(input),filename=Buffer.from(name),body=deflate?deflateRawSync(bytes):bytes,crc=crc32(bytes),local=Buffer.alloc(30),cd=Buffer.alloc(46);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(deflate?8:0,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(filename.length,26);cd.writeUInt32LE(0x02014b50);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(0x800,8);cd.writeUInt16LE(deflate?8:0,10);cd.writeUInt32LE(crc,16);cd.writeUInt32LE(body.length,20);cd.writeUInt32LE(bytes.length,24);cd.writeUInt16LE(filename.length,28);cd.writeUInt32LE(offset,42);locals.push(local,filename,body);central.push(cd,filename);offset+=local.length+filename.length+body.length;}const end=Buffer.alloc(22),directory=Buffer.concat(central);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,directory,end]);}
const manifest=(body='')=>`<?xml version="1.0"?><package><metadata><id>Fixture</id><version>1.0.0</version><authors>Jailbreak</authors><license type="expression">MIT</license>${body}</metadata></package>`;

test('real SDK nupkg selects executable implementation DLL and matches CLR behavior',async()=>{
 const result=await convertNuget(packageBytes);assert.equal(result.success,true,JSON.stringify(result.diagnostics));assert.equal(result.packages[0].id,'Jailbreak.BinaryExamples');assert.equal(result.packages[0].license.value,'MIT');assert.deepEqual(result.packages[0].selectedFiles,['lib/net8.0/Jailbreak.BinaryExamples.dll']);const MS=createBinaryRuntime();new Function('MS',result.code)(MS);assert.equal(MS.getType('Jailbreak.BinaryExamples','BinaryExamples.Calculator').SumTo(100),fixture.oracle.Sum);
});
test('ZIP supports stored and raw-deflate entries with CRC checks',async()=>{
 for(const deflate of [false,true]){const bytes=zip([['a.txt','hello'],['b.txt','other']],{deflate}),archive=readZip(bytes);assert.equal(new TextDecoder().decode(await archive.read('a.txt')),'hello');assert.equal(archive.entries.size,2);}
});
test('CRC corruption is rejected on entry read',async()=>{const bytes=zip([['a.txt','hello']]);bytes[35]^=1;await assert.rejects(readZip(bytes).read('a.txt'),/CRC/);});
test('traversal, absolute paths, duplicate/case collisions and backslashes are rejected',()=>{
 for(const names of [['../a'],['/a'],['C:/a'],['a\\b'],['A','a'],['a','a'],['a/./b']])assert.throws(()=>readZip(zip(names.map(n=>[n,'x']))));
});
test('ZIP validates local headers, bounded sizes and encrypted entries',()=>{
 assert.throws(()=>readZip(packageBytes,{maxBytes:32}));assert.throws(()=>readZip(packageBytes,{maxEntries:1}));assert.throws(()=>readZip(zip([['a','abc']]),{maxExpandedBytes:2}));const bytes=zip([['a','x']]);bytes.writeUInt16LE(1,6);assert.throws(()=>readZip(bytes),/Conflicting/);assert.throws(()=>readZip(bytes.subarray(0,10)));
});
test('multiple implementation TFMs require explicit selection rather than accidental merging',async()=>{
 const bytes=zip([['Fixture.nuspec',manifest()],['lib/net8.0/Fixture.dll',dll],['lib/netstandard2.0/Fixture.dll',dll]],{deflate:true});assert.equal((await convertNuget(bytes)).success,false);const r=await convertNuget(bytes,{targetFramework:'net8.0'});assert.equal(r.success,true,JSON.stringify(r.diagnostics));assert.equal(r.assemblies.length,1);assert.equal((await convertNuget(bytes,{targetFramework:'net9.0'})).code,'');
});
test('ref-only packages do not produce pretend executable output',async()=>{
 const bytes=zip([['Fixture.nuspec',manifest()],['ref/net8.0/Fixture.dll',dll]]);const r=await convertNuget(bytes);assert.equal(r.success,false);assert.equal(r.code,'');assert.match(r.diagnostics[0].message,/No executable/);
});
test('unprovided package dependencies block conversion without automatic network restore',async()=>{
 const bytes=zip([['Fixture.nuspec',manifest('<dependencies><group targetFramework="net8.0"><dependency id="Missing.Package" version="[1.0.0,2.0.0)" /></group></dependencies>')],['lib/net8.0/Fixture.dll',dll]]);const r=await convertNuget(bytes);assert.equal(r.success,false);assert.equal(r.code,'');assert.ok(r.diagnostics.some(d=>d.message.includes('Missing.Package')));
});
test('tasks and native assets are inventoried, never executed',async()=>{
 const bytes=zip([['Fixture.nuspec',manifest()],['lib/net8.0/Fixture.dll',dll],['tools/install.ps1','throw "never"'],['build/Fixture.targets','<Project><Target/></Project>']]);const r=await convertNuget(bytes);assert.equal(r.success,true);assert.equal(r.packages[0].ignoredAssets.length,2);assert.ok(r.diagnostics.some(d=>d.severity==='warning'));
});
test('manifest DTD, duplicate manifests and malformed metadata fail',async()=>{
 await assert.rejects(inspectNuget(zip([['a.nuspec','<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><package/>']])));await assert.rejects(inspectNuget(zip([['a.nuspec',manifest()],['b.nuspec',manifest()]])));await assert.rejects(inspectNuget(zip([['a.nuspec','<package/>']])));
});
test('explicit simple NuGet version ranges are checked; prerelease resolution is not guessed',()=>{
 assert.ok(satisfiesVersion('1.2.3','[1.0.0,2.0.0)'));assert.ok(!satisfiesVersion('2.0.0','[1.0.0,2.0.0)'));assert.ok(satisfiesVersion('1.0.0','[1.0.0]'));assert.ok(!satisfiesVersion('1.1.0','[1.0.0]'));assert.throws(()=>satisfiesVersion('1.0.0-beta','1.0.0'));
});
