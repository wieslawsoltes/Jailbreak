import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {readNativePdb,readMsf,isNativePdb} from '../packages/native-pdb/index.js';
import {readNamedStreams} from '../packages/native-pdb/msf.js';
import {legacyMd5} from '../packages/native-pdb/legacy-checksum.js';
import {prepareDebugAssembly,debugSymbols} from '../packages/portable-pdb/symbols.js';
import {compileBinaryInputs} from '../packages/msil-compiler/debug.js';
import {createBinaryRuntime} from '../packages/msil-runtime/index.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/msil/native-pdb.json',import.meta.url),'utf8'));
const dll='Jailbreak.NativeSymbols.dll',pdbFile='Jailbreak.NativeSymbols.pdb';
const bytes=name=>Buffer.from(fixture.files[name].base64,'base64');
const inputs=(source=fixture.source)=>[{path:dll,bytes:bytes(dll)},{path:pdbFile,bytes:bytes(pdbFile)},{path:'Library.cs',text:source}];
function changeStream(index,at,edit){
  const data=bytes(pdbFile),msf=readMsf(data),copy=new Uint8Array(msf.read(index).bytes);
  edit(new DataView(copy.buffer),copy,at);let offset=0;
  for(const block of msf.streams[index].blocks){data.set(copy.subarray(offset,offset+msf.blockSize),block*msf.blockSize);offset+=msf.blockSize;}return data;
}
function moduleLayout(){
  const m=readMsf(bytes(pdbFile)),dbi=m.read(3);dbi.seek(64+34);
  const stream=dbi.u16(),symbols=dbi.u32();dbi.u32();const lines=dbi.u32();return {stream,symbols,lines};
}
function record(kind){const {stream,symbols}=moduleLayout(),r=readMsf(bytes(pdbFile)).read(stream);r.seek(4);while(r.pos<symbols){const at=r.pos,len=r.u16(),k=r.u16();if(k===kind)return {stream,at};r.skip(len-2);}throw Error('Fixture record not found');}
test('native fixture retains exact Windows compiler bytes and independent CLR results',()=>{
  for(const [name,v]of Object.entries(fixture.files))assert.equal(createHash('sha256').update(bytes(name)).digest('hex'),v.sha256);
  assert.equal(fixture.oracle.sum,45);assert.equal(fixture.oracle.twice,42);assert.equal(fixture.oracle.throwLine,22);
});
test('MSF validates magic and returns independent streams without mutating Buffer input',()=>{
  const data=bytes(pdbFile),before=Buffer.from(data),msf=readMsf(data),pdb=readNativePdb(data);
  msf.read(1).bytes.fill(0);assert.deepEqual(data,before);data.fill(0);assert.equal(isNativePdb(data),false);
  assert.notEqual(msf.read(1).u32(),0);assert.equal(pdb.format,'native-pdb');
  assert.deepEqual(pdb.methods.map(({name,token})=>({name,token})),fixture.oracle.methods);
});
test('managed C13 symbols contain CLR-confirmed original lines and hidden/scoped locals',()=>{
  const pdb=readNativePdb(bytes(pdbFile)),sum=pdb.methods.find(m=>m.name==='Sum');
  assert.ok(pdb.methods.find(m=>m.name==='Fail').points.some(p=>p.line===fixture.oracle.throwLine));
  assert.deepEqual(sum.scopes.flatMap(s=>s.variables).filter(v=>!v.hidden).map(v=>v.name),['total','i']);
  assert.ok(sum.points.some(p=>p.hidden));assert.ok(sum.scopes.some(s=>s.start===3&&s.end===25));
});
test('legacy MD5 matching agrees with independent Node implementation across padding boundaries',()=>{
  for(const n of [0,1,7,55,56,63,64,65,119,120,1024,8192]){const data=randomBytes(n);assert.equal(legacyMd5(data),createHash('md5').update(data).digest('hex'));}
  assert.equal(legacyMd5(new TextEncoder().encode('abc')),'900150983cd24fb0d6963f7d28e17f72');
});
test('MSF rejects invalid budgets truncated buffers and invalid superblocks',()=>{
  for(const maxBytes of [0,32,-1,NaN,Infinity])assert.throws(()=>readNativePdb(bytes(pdbFile),{maxBytes}),/budget/);
  for(const [at,value]of [[32,123],[36,3],[40,999999],[48,1],[52,1]]){const data=bytes(pdbFile);data.writeUInt32LE(value,at);assert.throws(()=>readNativePdb(data));}
  for(const n of [0,31,55,512,1024,bytes(pdbFile).length-1])assert.throws(()=>readNativePdb(bytes(pdbFile).subarray(0,n)));
  for(const maxRows of [0,-1,Infinity,NaN])assert.throws(()=>readNativePdb(bytes(pdbFile),{maxRows}),/budget/);
});
test('MSF refuses directory and stream aliases to reserved or already owned pages',()=>{
  const original=bytes(pdbFile),size=original.readUInt32LE(32),map=original.readUInt32LE(52)*size,dir=original.readUInt32LE(map)*size,count=original.readUInt32LE(dir);
  for(const target of [0,1,2,original.readUInt32LE(52),original.readUInt32LE(map)]){
    const data=Buffer.from(original);data.writeUInt32LE(target,dir+4+count*4);assert.throws(()=>readMsf(data),/shared or reserved/);
  }
  const data=Buffer.from(original);data.writeUInt32LE(data.readUInt32LE(dir+4+count*4),dir+8+count*4);assert.throws(()=>readMsf(data),/shared or reserved/);
});
test('native named stream hash occupancy and stream budgets are validated',()=>{
  const m=readMsf(bytes(pdbFile)),r=m.read(1);r.seek(28);assert.ok(readNamedStreams(r,m).has('/names'));
  const header=m.read(1);header.seek(28);const length=header.u32();
  const data=changeStream(1,32+length,(v,b,at)=>v.setUint32(at,999999,true));assert.throws(()=>readNativePdb(data),/hash/);
  assert.throws(()=>m.read(9999),/Missing/);assert.throws(()=>readMsf(bytes(pdbFile),{maxStreams:4}),/budget/);
});
test('native malformed procedure extents and lexical-scope endings are rejected',()=>{
  const {stream,at}=record(0x112a);
  for(const [delta,value]of [[8,7],[16,0],[28,0x06000000]]){
    const data=changeStream(stream,at+delta,(v,b,offset)=>v.setUint32(offset,value,true));assert.throws(()=>readNativePdb(data),/scope|procedure/);
  }
});
test('unknown native executable/local records never become pretend CLI symbols',()=>{
  const {stream,at}=record(0x112a),data=changeStream(stream,at+2,(v,b,offset)=>v.setUint16(offset,0x110f,true));
  assert.throws(()=>readNativePdb(data),/Unsupported native symbol record/);
});
test('native sequence points cannot contain out-of-range IL offsets',()=>{
  const {stream,symbols,lines}=moduleLayout(),r=readMsf(bytes(pdbFile)).read(stream);r.seek(symbols);let point;
  while(r.pos<symbols+lines){const kind=r.u32(),n=r.u32();if(kind===0xf2||kind===0xf9){point=r.pos+24;break;}r.skip(n);}
  assert.ok(point);const data=changeStream(stream,point,(v,b,at)=>v.setUint32(at,500,true));assert.throws(()=>readNativePdb(data),/sequence point/);
});
test('native GUID and age must match both DBI and DLL identities',async()=>{
  for(const at of [8,12]){
    const changed=changeStream(1,at,(v,b,offset)=>b[offset]^=1);
    const r=await compileBinaryInputs([{path:dll,bytes:bytes(dll)},{path:pdbFile,bytes:changed}],{debug:true});
    assert.equal(r.success,false);assert.equal(r.code,'');assert.match(r.diagnostics[0].message,/identity|DBI|age/);
  }
});
test('source aliases require an exact checksum and unique supplied basename',async()=>{
  const mismatch=await compileBinaryInputs(inputs(fixture.source+'// not original'),{debug:true});assert.equal(mismatch.success,false);assert.match(mismatch.diagnostics[0].message,/checksum/);
  const ambiguous=await compileBinaryInputs([...inputs(),{path:'other/Library.cs',text:fixture.source}],{debug:true});assert.equal(ambiguous.success,false);assert.match(ambiguous.diagnostics[0].message,/Ambiguous/);
});
test('native original-source hooks execute real IL and actual locals through shared AOT',async()=>{
  const r=await compileBinaryInputs(inputs(),{debug:true});assert.equal(r.success,true,JSON.stringify(r.diagnostics));assert.deepEqual(Object.values(r.debug.sources),[fixture.source]);assert.equal(r.debug.sites.length,16);
  const MS=createBinaryRuntime(),seen=[];MS.setDebugger((point,get)=>{seen.push({point,locals:get()});return false;});new Function('MS',r.code)(MS);
  const T=MS.getType('Jailbreak.NativeSymbols','NativeSymbols.Calculations');assert.equal(T.Sum(10),fixture.oracle.sum);assert.equal(T.Twice(21),fixture.oracle.twice);assert.throws(()=>T.Fail(),/native symbol fixture/);
  assert.ok(seen.some(s=>s.point.line===11&&s.locals.i===3&&s.locals.total===3));assert.ok(seen.some(s=>s.point.line===fixture.oracle.throwLine));
  assert.equal(seen.some(s=>Object.keys(s.locals).some(k=>k.startsWith('CS$'))),false);
});
test('native cooperative debugger mutates the real suspended local and resumes',async()=>{
  const r=await compileBinaryInputs(inputs(),{debug:true,cooperativeDebug:true});assert.equal(r.success,true,JSON.stringify(r.diagnostics));
  const MS=createBinaryRuntime();new Function('MS',r.code)(MS);const events=[],co=MS.createDebugger({breakpoint:(p,read)=>p.line===11&&read().i===2,report:(event,data)=>events.push({event,data})});
  const T=MS.getType('Jailbreak.NativeSymbols','NativeSymbols.Calculations'),task=co.start(T,'Sum',[4]);
  const frame=events.findLast(e=>e.event==='debug-paused').data.frames[0];assert.equal(frame.locals.total,1);
  co.setLocal(task.taskId,frame.id,'total',100);co.command(task.taskId,'continue');assert.equal(await task.promise,105);assert.equal(co.busy,false);
});
test('release excludes symbol sources and hooks; validated metadata is identity-bound',async()=>{
  const r=await compileBinaryInputs(inputs());assert.equal(r.success,true);assert.equal(r.debug,undefined);assert.doesNotMatch(r.code,/debugHit|@jb:|total \+= i/);
  const model=await prepareDebugAssembly({path:dll,bytes:bytes(dll),pdb:bytes(pdbFile)},{sources:{'Library.cs':fixture.source}});
  assert.equal(debugSymbols(model).format,'native-pdb');assert.equal(debugSymbols({...model}),undefined);
});

test('DLL workspace attachments remain byte-exact and original source is debugger-only',async()=>{
  const {encodeBinaryFile,decodeBinaryRecord,compileWorkspaceInputs}=await import('../packages/binary-project/workspace.js');
  const text=encodeBinaryFile(dll,bytes(dll),{pdb:bytes(pdbFile),sources:{'Library.cs':fixture.source}}),record=decodeBinaryRecord(text);
  assert.deepEqual(record.bytes,new Uint8Array(bytes(dll)));assert.deepEqual(record.pdb,new Uint8Array(bytes(pdbFile)));assert.equal(record.sources['Library.cs'],fixture.source);
  const r=await compileWorkspaceInputs({'Main.cs':'public class Main { public int Run(){return NativeSymbols.Calculations.Sum(10);} }','library.binary.json':text},{debug:true,cooperativeDebug:true});
  assert.equal(r.success,true,JSON.stringify(r.diagnostics));assert.deepEqual(Object.values(r.debug.sources),[fixture.source]);
  assert.equal(r.debug.sites.filter(p=>p.origin==='msil').length,16);
});
test('DLL workspace attachment parsing rejects malformed sources and oversized symbols',async()=>{
  const {encodeBinaryFile,decodeBinaryRecord}=await import('../packages/binary-project/workspace.js');
  for(const symbols of [null,[],{pdb:7},{sources:[]},{sources:{a:1}},{sources:{a:'x'.repeat(4*1024*1024+1)}}]){
    const r=JSON.parse(encodeBinaryFile(dll,bytes(dll)));r.symbols=symbols;assert.throws(()=>decodeBinaryRecord(JSON.stringify(r)));
  }
  assert.throws(()=>encodeBinaryFile('x.nupkg',new Uint8Array(),{pdb:new Uint8Array()}),/only/);
});
test('Native Symbols sample sources link to the unchanged independent Windows fixture',async()=>{
  const {encodeBinaryFile,compileWorkspaceInputs}=await import('../packages/binary-project/workspace.js');
  const files=Object.fromEntries(['MainView.axaml','MainView.axaml.cs','NativeSymbols.csproj'].map(n=>[n,fs.readFileSync(new URL('../examples/NativeSymbols/'+n,import.meta.url),'utf8')]));
  files['library.binary.json']=encodeBinaryFile(dll,bytes(dll),{pdb:bytes(pdbFile),sources:{'Library.cs':fixture.source}});
  const r=await compileWorkspaceInputs(files,{debug:true,cooperativeDebug:true});assert.equal(r.success,true,JSON.stringify(r.diagnostics));assert.deepEqual(Object.values(r.debug.sources),[fixture.source]);
});
