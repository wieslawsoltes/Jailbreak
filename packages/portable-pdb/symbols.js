import {readNativePdb,isNativePdb} from '../native-pdb/index.js';
import {readPortablePdb,pdbSources,inflateBounded,digest} from './index.js';
import {readAssembly} from '../managed-pe/structured.js';
import {decodeIL} from '../msil-compiler/instruction-set.js';
import {bytesOf,BinaryError} from '../managed-pe/reader.js';
const verified=new WeakMap();
const fail=message=>{throw new BinaryError(message,0,'JB6503');};
export function debugSymbols(assembly){return verified.get(assembly);}
/** Pairs exact PDB identity, optional checksum, metadata counts and IL/local ranges. */
export async function prepareDebugAssembly(input,options={}){
  const assembly=readAssembly(input.bytes,{...options,path:input.path,debug:true}),directory=assembly.debugDirectory;
  let bytes=input.pdb==null?null:bytesOf(input.pdb);
  if(!bytes&&directory.embedded)bytes=await inflateBounded(directory.embedded.bytes,directory.embedded.uncompressedSize,options.maxPdbBytes??16*1024*1024);
  if(!bytes)return assembly;
  const pdb=(isNativePdb(bytes)?readNativePdb:readPortablePdb)(bytes,{...options,maxBytes:options.maxPdbBytes??16*1024*1024});
  if(!directory.codeView.some(c=>c.id===pdb.id))fail('PDB identity does not match the DLL CodeView record');
  const copy=new Uint8Array(bytes);if(pdb.format==='portable-pdb')copy.fill(0,pdb.idOffset,pdb.idOffset+20);let checksumVerified=false;
  for(const record of directory.checksums){const algorithm={SHA256:'SHA-256',SHA384:'SHA-384',SHA512:'SHA-512'}[record.algorithm];if(algorithm){if(await digest(copy,algorithm)!==record.hash)fail('PDB checksum does not match the DLL');checksumVerified=true;}}
  if(directory.checksums.length&&!checksumVerified)fail('No supported PDB checksum algorithm');
  for(let i=0;i<48;i++)if(pdb.externalCounts[i]&&pdb.externalCounts[i]!==assembly.rowCounts[i])fail('PDB type-system table count does not match the DLL');
  if(pdb.entryPoint!==0&&pdb.entryPoint!==assembly.entryPoint)fail('PDB entrypoint does not match the DLL');
  const methods=new Map(assembly.methods.map(m=>[m.token,m]));
  for(const info of pdb.methods){
    const method=methods.get(info.token);if(!method)fail('PDB references missing method');
    if(!method.body){if(info.points.length||info.scopes.length)fail('PDB source points refer to a method without IL');continue;}
    const body=method.body,bounds=new Set(decodeIL(body.code,options).map(i=>i.offset));
    if(pdb.format==='native-pdb'&&info.codeSize!==body.code.length)fail('Native PDB method extent does not match IL');
    if(info.localSignature!==null&&info.localSignature!==(body.localToken&0xffffff)&&info.points.length)fail('PDB local signature does not match method IL');
    for(const p of info.points)if(!bounds.has(p.offset))fail('PDB sequence point is not an IL instruction boundary');
    const stack=[];
    for(const scope of info.scopes){
      if(scope.end>body.code.length||!bounds.has(scope.start)||scope.end!==body.code.length&&!bounds.has(scope.end))fail('PDB local scope is outside instruction bounds');
      while(stack.length&&stack.at(-1).end<=scope.start)stack.pop();
      if(stack.length&&scope.end>stack.at(-1).end)fail('PDB local scopes partially overlap');stack.push(scope);
      for(const v of scope.variables)if(v.slot>=body.locals.length)fail('PDB local slot is outside method locals');
    }
  }
  // A basename alias is permitted only if unique on BOTH sides. Checksums remain mandatory.
  const supplied={...options.sources},basename=p=>String(p).replace(/\\/g,'/').split('/').at(-1).toLowerCase();
  for(const doc of pdb.documents)if(!Object.hasOwn(supplied,doc.name)){
    const key=basename(doc.name),matches=Object.entries(options.sources??{}).filter(([p])=>basename(p)===key);
    if(matches.length===1&&pdb.documents.filter(d=>basename(d.name)===key).length===1)supplied[doc.name]=matches[0][1];
    else if(matches.length)fail('Ambiguous supplied source basename: '+key);
  }
  const sources=await pdbSources(pdb,{...options,sources:supplied});
  verified.set(assembly,{format:pdb.format,id:pdb.id,checksumVerified,documents:pdb.documents.map(({embedded,...d})=>d),methods:pdb.methods,sources,stateMachines:pdb.stateMachines});return assembly;
}
