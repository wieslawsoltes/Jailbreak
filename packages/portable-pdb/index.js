import {legacyMd5} from '../native-pdb/legacy-checksum.js';
import {digest} from './hash.js';
export {digest} from './hash.js';
/** Portable PDB metadata reader. Source Link never causes network or filesystem access. */
import {Reader,BinaryError,align,bytesOf} from '../managed-pe/reader.js';
const utf8=new TextDecoder('utf-8',{fatal:true}),hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const fail=(message,at=0)=>{throw new BinaryError(message,at,'JB6501');};
const shaGuid={'406ea660-64cf-4c82-b6f0-42d48172a799':'MD5','ff1816ec-aa5e-4d10-87f7-6f4963833460':'SHA-1','8829d00f-11b8-4213-878b-770e8597ac16':'SHA-256'};
const embeddedKind='0e8a571b-6926-466e-b4ad-8ab04611f5fe';
export function signedCompressed(reader){
  const start=reader.pos,raw=reader.compressed(),width=reader.pos-start,bits=width===1?6:width===2?13:28;
  return Math.floor(raw/2)-(raw&1?2**bits:0);
}
export function decodeSequencePoints(input,initialDocument,documentCount,{maxPoints=100000}={}){
  const r=new Reader(input);if(!r.end)return {localSignature:0,points:[]};
  const localSignature=r.compressed(),points=[];let document=initialDocument||r.compressed(),offset=0,line=0,column=0,first=true,firstVisible=true;
  if(!document||document>documentCount)fail('Invalid sequence point document');
  while(r.pos<r.end){
    if(points.length>=maxPoints)fail('PDB sequence-point budget exceeded',r.pos);
    let delta=r.compressed();
    if(!first&&delta===0){document=r.compressed();if(!document||document>documentCount)fail('Invalid sequence point document change',r.pos);if(r.pos===r.end)fail('Trailing document record');delta=r.compressed();if(!delta)fail('Sequence points must advance their IL offset');}
    offset=first?delta:offset+delta;first=false;
    const lines=r.compressed(),columns=lines===0?r.compressed():signedCompressed(r);
    if(lines===0&&columns===0){points.push({offset,document,line:0xfeefee,column:0,endLine:0xfeefee,endColumn:0,hidden:true});continue;}
    if(firstVisible){line=r.compressed();column=r.compressed();firstVisible=false;}else {line+=signedCompressed(r);column+=signedCompressed(r);}
    const endLine=line+lines,endColumn=column+columns;
    if(line<=0||line>=0xfeefee||column<0||endLine>=0xfeefee||endColumn<0||lines===0&&endColumn<=column)fail('Invalid Portable PDB source span',r.pos);
    points.push({offset,document,line,column,endLine,endColumn,hidden:false});
  }return {localSignature,points};
}
const schemas={
  48:['blob','guid','blob','guid'],49:[48,'blob'],50:[6,53,51,52,'u32','u32'],51:['u16','u16','str'],52:['str','blob'],53:[53,'blob'],54:[6,6],55:['custom','guid','blob']
};
const customTables=[6,4,1,2,8,9,10,0,14,23,20,17,26,27,32,35,38,39,40,42,44,43,48,50,51,52,53];
export function readPortablePdb(input,{maxBytes=16*1024*1024,maxRows=200000,maxPoints=500000}={}){
  const bytes=bytesOf(input);if(bytes.length>maxBytes)fail('PDB byte budget exceeded');const r=new Reader(bytes);
  if(r.u32()!==0x424a5342)fail('Not a Portable PDB metadata image');r.u16();r.u16();r.u32();const versionLength=r.u32();if(versionLength>1024)fail('PDB version string exceeds budget');r.slice(versionLength);r.seek(align(r.pos,4));r.u16();const count=r.u16();if(count>16)fail('Too many PDB streams');
  const streams=new Map();for(let i=0;i<count;i++){const offset=r.u32(),size=r.u32(),name=r.zeroString(32);r.seek(align(r.pos,4));r.check(offset,size);if(streams.has(name))fail('Duplicate PDB stream');streams.set(name,{offset,size});}
  const ranges=[...streams.values()].filter(s=>s.size).sort((a,b)=>a.offset-b.offset);let end=r.pos;for(const s of ranges){if(s.offset<end)fail('Overlapping PDB streams',s.offset);end=s.offset+s.size;}
  const get=name=>{const s=streams.get(name);if(!s)fail('Missing PDB stream '+name);return r.sub(s.offset,s.size);};
  const ph=get('#Pdb'),id=hex(ph.slice(20)),entryPoint=ph.u32(),externalMask=ph.u64(),externalCounts=Array(64).fill(0);
  for(let i=0;i<64;i++)if(externalMask&(1n<<BigInt(i))){if(i>=48)fail('PDB references a debug table as external metadata');externalCounts[i]=ph.u32();if(externalCounts[i]>maxRows)fail('PDB external row budget exceeded');}
  if(ph.pos!==ph.end)fail('Unexpected trailing #Pdb header bytes');
  const tables=get('#~');tables.u32();if(tables.u8()!==2||tables.u8()!==0)fail('Unsupported Portable PDB table version');const flags=tables.u8();if(flags&~7)fail('Unsupported PDB heap flags');tables.u8();const valid=tables.u64();tables.u64();
  const counts=Array(64).fill(0);let totalRows=0;
  for(let t=0;t<64;t++)if(valid&(1n<<BigInt(t))){if(!schemas[t])fail('Unsupported table in standalone Portable PDB: '+t);counts[t]=tables.u32();totalRows+=counts[t];if(totalRows>maxRows)fail('PDB row budget exceeded');}
  const combined=counts.map((n,t)=>n||externalCounts[t]);
  const indexSize=t=>combined[t]>=65536?4:2;
  const readIndex=size=>size===2?tables.u16():tables.u32();
  const raw=Array.from({length:64},()=>[]),heapWidth={str:flags&1?4:2,guid:flags&2?4:2,blob:flags&4?4:2};
  const customSize=customTables.some(t=>combined[t]>=2048)?4:2;
  for(let t=48;t<=55;t++)for(let i=0;i<counts[t];i++)raw[t].push(schemas[t].map(field=>field==='u16'?tables.u16():field==='u32'?tables.u32():field==='custom'?readIndex(customSize):typeof field==='number'?readIndex(indexSize(field)):readIndex(heapWidth[field])));
  // Alignment padding may be present; table payloads may not hide arbitrary data.
  if(tables.end-tables.pos>3||Array.from(tables.slice(tables.end-tables.pos)).some(Boolean))fail('Unexpected PDB table payload');
  function blob(index){const s=streams.get('#Blob');if(!index)return new Uint8Array();if(!s||index>=s.size)fail('PDB blob index out of range');const b=r.sub(s.offset+index,s.size-index),size=b.compressed();return b.slice(size);}
  function str(index){if(!index)return '';const s=streams.get('#Strings');if(!s||index>=s.size)fail('PDB string index out of range');return r.sub(s.offset+index,s.size-index).zeroString(Math.min(65536,s.size-index));}
  function guid(index){if(!index)return '00000000-0000-0000-0000-000000000000';const s=streams.get('#GUID');if(!s||index*16>s.size)fail('PDB GUID index out of range');const b=Uint8Array.from(r.sub(s.offset+(index-1)*16,16).slice(16));return [hex(b.slice(0,4).reverse()),hex(b.slice(4,6).reverse()),hex(b.slice(6,8).reverse()),hex(b.slice(8,10)),hex(b.slice(10))].join('-');}
  function documentName(index){const n=new Reader(blob(index));if(!n.end)fail('Missing PDB document name');const separator=n.u8(),parts=[];if(separator>127)fail('PDB document separator must be ASCII');while(n.pos<n.end){const part=utf8.decode(blob(n.compressed()));if(part.includes('\0'))fail('NUL in PDB document name');parts.push(part);if(parts.length>512)fail('Too many document path parts');}const name=parts.join(String.fromCharCode(separator));if(!name||name.length>8192)fail('Invalid PDB document path');return name;}
  const documents=raw[48].map(([name,hashAlgorithm,hash,language],i)=>({id:i+1,name:documentName(name),hashAlgorithm:guid(hashAlgorithm),hash:hex(blob(hash)),language:guid(language)}));
  if(counts[49]!==0&&counts[49]!==externalCounts[6])fail('PDB method debug rows must match MethodDef rows');
  let usedPoints=0;const methods=raw[49].map(([document,sequence],i)=>{if(document>documents.length)fail('Invalid method document');const decoded=decodeSequencePoints(blob(sequence),document,documents.length,{maxPoints:maxPoints-usedPoints});if(decoded.localSignature>externalCounts[17])fail('PDB local signature index out of range');usedPoints+=decoded.points.length;return {token:0x06000000+i+1,...decoded,scopes:[]};});
  const variables=raw[51].map(([attributes,slot,name])=>{if(attributes&~1)fail('Unsupported local variable attributes');const value=str(name);if(!value)fail('Local variable name is missing');return {name:value,slot,hidden:!!(attributes&1)};});
  raw[52].forEach(([name,signature])=>{str(name);blob(signature);});
  raw[53].forEach(([parent,imports],i)=>{if(parent>i)fail('Cyclic or forward import scope');blob(imports);});
  let lastMethod=0,lastStart=-1,lastLength=Infinity;
  for(let i=0;i<raw[50].length;i++){
    const [method,imports,firstVariable,firstConstant,start,length]=raw[50][i],next=raw[50][i+1];
    if(!method||method>methods.length||imports>raw[53].length||!length||start+length>0xffffffff)fail('Invalid Portable PDB local scope');
    if(method<lastMethod||method===lastMethod&&(start<lastStart||start===lastStart&&length>lastLength))fail('Unsorted Portable PDB local scopes');lastMethod=method;lastStart=start;lastLength=length;
    const stop=next?.[2]??variables.length+1,constantStop=next?.[3]??raw[52].length+1;
    if(!firstVariable||stop<firstVariable||stop>variables.length+1||!firstConstant||constantStop<firstConstant||constantStop>raw[52].length+1)fail('Invalid PDB local-list range');
    const vars=variables.slice(firstVariable-1,stop-1);if(new Set(vars.map(v=>v.slot)).size!==vars.length||new Set(vars.map(v=>v.name)).size!==vars.length)fail('Duplicate local variable in one scope');
    methods[method-1].scopes.push({start,end:start+length,variables:vars});
  }
  const stateMachines=raw[54].map(([moveNext,kickoff])=>{if(!moveNext||!kickoff||moveNext>externalCounts[6]||kickoff>externalCounts[6])fail('Invalid PDB state-machine method');return {moveNext:0x06000000+moveNext,kickoff:0x06000000+kickoff};});
  const custom=[];
  for(const [parent,kind,value]of raw[55]){const table=customTables[parent&31],row=parent>>>5;if(table===undefined||!row||row>combined[table])fail('Invalid custom debug parent');const id=guid(kind),data=blob(value);if(table===48&&id===embeddedKind){const doc=documents[row-1];if(doc.embedded)fail('Duplicate embedded source');doc.embedded=data;}else custom.push({table,row,kind:id,bytes:data});}
  return {format:'portable-pdb',id,entryPoint,externalCounts,documents,methods,stateMachines,custom,idOffset:streams.get('#Pdb').offset};
}
export async function inflateBounded(input,size,max){
  if(size>max)fail('Embedded source exceeds size budget');
  const stream=new Blob([input]).stream().pipeThrough(new DecompressionStream('deflate-raw')),reader=stream.getReader(),chunks=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max||total>size)fail('Embedded source expansion exceeds declared size');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  if(total!==size)fail('Embedded source length mismatch');const result=new Uint8Array(total);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length;}return result;
}
/** Validate explicitly supplied/embedded UTF-8 sources. Paths are labels, never fetch targets. */
export async function pdbSources(pdb,{sources={},maxSourceBytes=4*1024*1024,maxTotalSourceBytes=16*1024*1024}={}){
  const result=Object.create(null);let total=0;
  for(const doc of pdb.documents){let data;
    if(Object.hasOwn(sources,doc.name)){data=typeof sources[doc.name]==='string'?new TextEncoder().encode(sources[doc.name]):bytesOf(sources[doc.name]);}
    else if(doc.embedded){const r=new Reader(doc.embedded),size=r.u32(),content=r.slice(r.end-r.pos);data=size?await inflateBounded(content,size,maxSourceBytes):content;}
    if(!data)continue;if(data.length>maxSourceBytes||(total+=data.length)>maxTotalSourceBytes)fail('Source text budget exceeded');
    const algorithm=shaGuid[doc.hashAlgorithm];if(!algorithm||!doc.hash)fail('Source requires a supported checksum');if((algorithm==='MD5'?legacyMd5(data):await digest(data,algorithm))!==doc.hash)fail('PDB document source checksum mismatch: '+doc.name);
    result[doc.name]=utf8.decode(data);
  }return result;
}
