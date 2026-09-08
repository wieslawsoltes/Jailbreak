import { Reader, BinaryError, align, bytesOf } from './reader.js';
import { tableSchemas, tableNames, codedIndices, decodeCoded } from './metadata-schema.js';
import { readSignature } from './signatures.js';
export { BinaryError } from './reader.js';
export { typeName, stackType } from './signatures.js';

/** Decode a managed PE image without loading it into the OS or executing any method. */
export function readAssembly(input,{path='assembly.dll',maxBytes=32*1024*1024,maxRows=200000,maxMethodBytes=1024*1024}={}){
  const bytes=bytesOf(input);if(bytes.length>maxBytes)throw new BinaryError('Managed image exceeds byte budget');const r=new Reader(bytes);
  if(r.u16()!==0x5a4d)throw new BinaryError('Not a PE image: missing MZ signature');r.seek(0x3c);const pe=r.u32();r.seek(pe);
  if(r.u32()!==0x4550)throw new BinaryError('Invalid PE signature',pe);
  const machine=r.u16(),sectionCount=r.u16();if(!sectionCount||sectionCount>96)throw new BinaryError('Invalid PE section count');r.skip(12);const optionalSize=r.u16(),characteristics=r.u16(),optionalStart=r.pos;
  const optional=r.sub(optionalStart,optionalSize),magic=optional.u16(),is64=magic===0x20b;if(!is64&&magic!==0x10b)throw new BinaryError('Unsupported PE optional header');
  const directoryOffset=is64?112:96;optional.seek(optionalStart+directoryOffset-4);const directoryCount=optional.u32();if(directoryCount<15)throw new BinaryError('Native PE: no CLR header');optional.seek(optionalStart+directoryOffset+14*8);const cliRva=optional.u32(),cliSize=optional.u32();if(!cliRva||cliSize<72)throw new BinaryError('Native PE or invalid CLR header');
  r.seek(optionalStart+optionalSize);const sections=[];
  for(let i=0;i<sectionCount;i++){const name=new TextDecoder().decode(r.slice(8)).replace(/\0.*$/,''),virtualSize=r.u32(),rva=r.u32(),size=r.u32(),offset=r.u32();r.skip(16);r.check(offset,size);sections.push({name,virtualSize,rva,size,offset});}
  function mapRva(rva,n=1){const matches=sections.filter(s=>rva>=s.rva&&rva+n<=s.rva+s.size);if(matches.length!==1)throw new BinaryError('RVA does not map uniquely to file-backed data: 0x'+rva.toString(16),rva);return r.check(matches[0].offset+rva-matches[0].rva,n);}
  const cli=r.sub(mapRva(cliRva,72),72);const cb=cli.u32();if(cb<72)throw new BinaryError('Invalid CLR header size');cli.skip(4);const metadataRva=cli.u32(),metadataSize=cli.u32(),flags=cli.u32(),entryPoint=cli.u32();const resourcesRva=cli.u32(),resourcesSize=cli.u32();cli.seek(cli.start+64);const nativeHeader=cli.u32();cli.u32();
  const metadata=r.sub(mapRva(metadataRva,metadataSize),metadataSize);if(metadata.u32()!==0x424a5342)throw new BinaryError('Invalid CLI metadata signature',metadata.start);metadata.skip(8);const versionSize=metadata.u32();if(versionSize>1024)throw new BinaryError('Invalid metadata version length');const version=metadata.utf8(versionSize).replace(/\0.*$/,'');metadata.seek(align(metadata.pos));metadata.u16();const streamCount=metadata.u16();if(streamCount>32)throw new BinaryError('Metadata stream budget exceeded');const streams=new Map();
  for(let i=0;i<streamCount;i++){const offset=metadata.u32(),size=metadata.u32(),name=metadata.zeroString(32);metadata.seek(align(metadata.pos));if(streams.has(name))throw new BinaryError('Duplicate CLI stream '+name);metadata.check(metadata.start+offset,size);streams.set(name,{offset:metadata.start+offset,size});}
  const streamRanges=[...streams.values()].sort((a,b)=>a.offset-b.offset);for(let i=0;i<streamRanges.length;i++){const s=streamRanges[i];if(s.offset<metadata.pos||(i&&s.offset<streamRanges[i-1].offset+streamRanges[i-1].size))throw new BinaryError('Overlapping CLI streams',s.offset);}
  function heap(name,index){const s=streams.get(name);if(!s)throw new BinaryError('Missing metadata heap '+name);if(index<0||index>=s.size)throw new BinaryError('Invalid '+name+' heap index',index);return r.sub(s.offset+index,s.size-index);}
  const string=index=>index===0?'':heap('#Strings',index).zeroString(1_000_000);
  const blob=index=>{if(!index)return new Uint8Array();const h=heap('#Blob',index);return h.slice(h.compressed());};
  function userString(token){if(token>>>24!==0x70)throw new BinaryError('ldstr needs a user-string token',token);const h=heap('#US',token&0xffffff),n=h.compressed();if(!n)return '';if(n%2!==1)throw new BinaryError('Invalid UTF-16 user string',h.pos);const value=h.slice(n-1);h.u8();return new TextDecoder('utf-16le').decode(value);}
  const tableStream=streams.get('#~')??streams.get('#-');if(!tableStream)throw new BinaryError('Missing metadata tables');const t=r.sub(tableStream.offset,tableStream.size);t.skip(4);const major=t.u8(),minor=t.u8(),heapFlags=t.u8();t.u8();const valid=t.u64();t.u64();const counts=Array(64).fill(0),tables=Array.from({length:64},()=>[]);let totalRows=0;
  for(let i=0;i<64;i++)if(valid&(1n<<BigInt(i))){counts[i]=t.u32();totalRows+=counts[i];if(!tableSchemas[i]||totalRows>maxRows)throw new BinaryError('Unsupported metadata table or row budget exceeded',t.pos);}
  if([3,5,7,19,22].some(i=>counts[i]))throw new BinaryError('Unoptimized pointer tables are not supported',0,'JB6004');
  function width(kind){if(kind==='u16')return 2;if(kind==='u32')return 4;if(['string','guid','blob'].includes(kind))return heapFlags&({string:1,guid:2,blob:4}[kind])?4:2;if(typeof kind==='number')return counts[kind]>=65536?4:2;const [bits,ids]=codedIndices[kind];return ids.some(id=>id>=0&&counts[id]>=(1<<(16-bits)))?4:2;}
  for(let i=0;i<64;i++){if(!counts[i])continue;const schema=tableSchemas[i],rowSize=schema.reduce((n,[,k])=>n+width(k),0);t.check(t.pos,rowSize*counts[i]);for(let row=1;row<=counts[i];row++){const item={token:i*16777216+row};for(const [name,kind] of schema){const value=width(kind)===2?t.u16():t.u32();item[name]=kind==='string'?string(value):codedIndices[kind]?decodeCoded(value,kind):value;}tables[i].push(item);}}
  const row=token=>{const value=tables[token>>>24]?.[(token&0xffffff)-1];if(!value)throw new BinaryError('Invalid metadata token 0x'+token.toString(16));return value;};
  if(tables[32].length!==1)throw new BinaryError('Only single-module assemblies are supported');const assemblyRow=tables[32][0],name=assemblyRow.Name;
  const references=tables[35].map(a=>({token:a.token,name:a.Name,version:[a.MajorVersion,a.MinorVersion,a.BuildNumber,a.RevisionNumber].join('.'),culture:a.Culture,publicKeyToken:Array.from(blob(a.PublicKeyOrToken),b=>b.toString(16).padStart(2,'0')).join('')}));
  const nested=new Map(tables[41].map(x=>[x.NestedClass,x.EnclosingClass])),typeCache=new Map();
  function resolveType(token,trail=new Set()){
    if(!token)return null;if(typeCache.has(token))return typeCache.get(token);if(trail.has(token)||trail.size>32)throw new BinaryError('Cyclic/deep type metadata');trail.add(token);const raw=row(token),table=token>>>24;let value;
    if(table===27)value=readSignature(blob(raw.Signature),t=>resolveType(t,trail),'type');
    else if(table===2){const outer=nested.get(token&0xffffff);value={name:outer?resolveType(0x02000000+outer,trail).name+'+'+raw.Name:[raw.Namespace,raw.Name].filter(Boolean).join('.'),assembly:name};}
    else if(table===1){const scope=raw.ResolutionScope,st=scope>>>24;value={name:[raw.Namespace,raw.Name].filter(Boolean).join('.'),assembly:st===35?row(scope).Name:name};if(st===1){const outer=resolveType(scope,trail);value={name:outer.name+'+'+raw.Name,assembly:outer.assembly};}if(st===26)throw new BinaryError('Multi-module TypeRef unsupported');}
    else throw new BinaryError('Token does not refer to a type');trail.delete(token);typeCache.set(token,value);return value;
  }
  const types=tables[2].map(raw=>({token:raw.token,...resolveType(raw.token),flags:raw.Flags,base:resolveType(raw.Extends),fields:[],methods:[],properties:[]})),methods=[],fields=[],members=[];
  function signature(index,kind){return readSignature(blob(index),resolveType,kind);}
  function body(method){if(!method.RVA)return null;const at=mapRva(method.RVA),h=r.sub(at,bytes.length-at),first=h.u8();let size,maxStack,localToken=0,initLocals=false,moreSections=false;
    if((first&3)===2){size=first>>>2;maxStack=8;}
    else if((first&3)===3){h.seek(at);const header=h.u16(),words=header>>>12;if(words<3||words>15)throw new BinaryError('Invalid fat method header',at);maxStack=h.u16();size=h.u32();localToken=h.u32();initLocals=!!(header&16);moreSections=!!(header&8);h.seek(at+words*4);}
    else throw new BinaryError('Unsupported method body header',at);
    if(size>maxMethodBytes||maxStack>4096)throw new BinaryError('Method body budget exceeded',at);mapRva(method.RVA,h.pos-at+size);const code=h.slice(size),locals=localToken?signature(row(localToken).Signature,'locals'):[];
    if(localToken&&localToken>>>24!==17)throw new BinaryError('Invalid local signature token');
    return {offset:at,codeOffset:h.pos-size,code,maxStack,locals,initLocals,hasExceptionSections:moreSections};
  }
  for(let i=0;i<types.length;i++){
    const type=types[i],raw=tables[2][i],next=tables[2][i+1];
    const fieldEnd=next?.FieldList??tables[4].length+1,methodEnd=next?.MethodList??tables[6].length+1;
    if(raw.FieldList<1||raw.FieldList>tables[4].length+1||fieldEnd<raw.FieldList||fieldEnd>tables[4].length+1||raw.MethodList<1||methodEnd<raw.MethodList||methodEnd>tables[6].length+1)throw new BinaryError('Invalid member ownership range');
    for(let n=raw.FieldList;n<fieldEnd;n++){const f=tables[4][n-1],field={token:f.token,name:f.Name,owner:type.name,assembly:name,flags:f.Flags,static:!!(f.Flags&16),type:signature(f.Signature,'field')};fields.push(field);type.fields.push(field.token);}
    for(let n=raw.MethodList;n<methodEnd;n++){const m=tables[6][n-1],sig=signature(m.Signature,'method'),nextParam=tables[6][n]?.ParamList??tables[8].length+1;const method={token:m.token,name:m.Name,owner:type.name,assembly:name,flags:m.Flags,implFlags:m.ImplFlags,static:!!(m.Flags&16),virtual:!!(m.Flags&64),abstract:!!(m.Flags&1024),signature:sig,body:body(m),parameterNames:tables[8].slice(m.ParamList-1,nextParam-1).filter(p=>p.Sequence>0).map(p=>p.Name)};methods.push(method);type.methods.push(method.token);}
  }
  for(const m of tables[10]){const parent=m.Class>>>24;if(![1,2,27].includes(parent))throw new BinaryError('Unsupported member reference parent',0,'JB6004');const owner=resolveType(m.Class),raw=blob(m.Signature),field=raw[0]===6;members.push({token:m.token,name:m.Name,owner:owner.name,assembly:owner.assembly,kind:field?'field':'method',...(field?{type:signature(m.Signature,'field')}:{signature:signature(m.Signature,'method')})});}
  for(const map of tables[21]){const type=types[map.Parent-1];if(!type)throw new BinaryError('Invalid property owner');const idx=tables[21].indexOf(map),end=tables[21][idx+1]?.PropertyList??tables[23].length+1;for(let i=map.PropertyList;i<end;i++){const p=tables[23][i-1];if(!p)throw new BinaryError('Invalid property table range');const sem=tables[24].filter(s=>s.Association===p.token);type.properties.push({name:p.Name,get:sem.find(s=>s.Semantics&2)?.Method??null,set:sem.find(s=>s.Semantics&1)?.Method??null});}}
  const userStrings={}; // Strings are decoded on demand by the IL decoder, not searched heuristically.
  return {format:'cli-assembly-v1',path,name,version:[assemblyRow.MajorVersion,assemblyRow.MinorVersion,assemblyRow.BuildNumber,assemblyRow.RevisionNumber].join('.'),machine,is64,characteristics,cliFlags:flags,nativeHeader,entryPoint,metadataVersion:version,references,types,methods,fields,members,userStrings,
    resources:tables[40].map(x=>({name:x.Name,offset:x.Offset,embedded:!x.Implementation})),
    features:{referenceAssembly:tables[12].some(attr=>attr.Parent===0x20000001&&members.some(m=>m.token===attr.Type&&m.owner==='System.Runtime.CompilerServices.ReferenceAssemblyAttribute')),literalFields:fields.some(f=>f.flags&64),generics:counts[42]>0,methodSpecs:counts[43]>0,explicitOverrides:counts[25]>0,fieldRva:counts[29]>0,exportedTypes:counts[39]>0},
    tables:Object.fromEntries(counts.map((n,i)=>[tableNames[i],n]).filter(([,n])=>n)),
    resolveType,readUserString:userString};
}
