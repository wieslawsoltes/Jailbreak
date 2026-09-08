import { Bytes, BinaryError } from './bytes.js';
import { readTables } from './tables.js';
export { Bytes, BinaryError, binaryDiagnostic } from './bytes.js';

/** Read a CLI image into a serializable assembly model. Input bytes are never executed. */
export function readAssembly(input, {path='assembly.dll', maxBytes=32*1024*1024}={}) {
  const bytes=new Bytes(input);
  if(bytes.length>maxBytes)throw new BinaryError('Assembly size budget exceeded');
  if(bytes.u16(0)!==0x5a4d)throw new BinaryError('Expected a PE/DOS MZ header');
  const pe=bytes.u32(0x3c);
  if(bytes.u32(pe)!==0x4550)throw new BinaryError('Invalid PE signature',pe);
  const sections=bytes.u16(pe+6),optSize=bytes.u16(pe+20),opt=pe+24,magic=bytes.u16(opt);
  if(![0x10b,0x20b].includes(magic)||sections>96)throw new BinaryError('Unsupported PE optional header');
  const dir=opt+(magic===0x10b?96:112);
  if(optSize<dir-opt+15*8||bytes.u32(dir-4)<15)throw new BinaryError('PE has no CLI data directory');
  const map=[];
  for(let i=0;i<sections;i++){const s=opt+optSize+i*40;bytes.check(s,40);map.push({rva:bytes.u32(s+12),size:bytes.u32(s+16),raw:bytes.u32(s+20)});}
  function rva(address,length=1) {const matches=map.filter(s=>address>=s.rva&&address+length<=s.rva+s.size);if(matches.length!==1)throw new BinaryError('Unmapped or ambiguous RVA '+address.toString(16));const at=matches[0].raw+address-matches[0].rva;bytes.check(at,length);return at;}
  const cli=rva(bytes.u32(dir+14*8),72),flags=bytes.u32(cli+16);
  if(!(flags&1)||(flags&16)||bytes.u32(cli+64))throw new BinaryError('Only IL-only managed images without native entry points/ReadyToRun are supported');
  const metaSize=bytes.u32(cli+12),meta=rva(bytes.u32(cli+8),metaSize),md=new Bytes(bytes.slice(meta,metaSize));
  if(md.u32(0)!==0x424a5342)throw new BinaryError('Invalid CLI metadata root',meta);
  const versionSize=md.u32(12);let p=(16+versionSize+3)&~3;const streams=md.u16(p+2);p+=4;
  if(streams>32)throw new BinaryError('Metadata stream budget exceeded');
  const heaps=new Map();
  for(let i=0;i<streams;i++){const offset=md.u32(p),size=md.u32(p+4),name=md.zero(p+8,Math.min(32,md.length-p-8));p=(p+8+name.length+1+3)&~3;if(heaps.has(name))throw new BinaryError('Duplicate metadata stream '+name);heaps.set(name,new Bytes(md.slice(offset,size)));}
  const tableHeap=heaps.get('#~');if(!tableHeap)throw new BinaryError('Only compressed #~ metadata tables are supported');
  const tables=readTables(tableHeap),{rows,row,decode}=tables;
  const strings=heaps.get('#Strings'),blobHeap=heaps.get('#Blob'),us=heaps.get('#US');
  if(!strings||!blobHeap)throw new BinaryError('Missing metadata heaps');
  const str=index=>strings.zero(index);
  const blob=index=>{if(index===0)return new Bytes(new Uint8Array());const [length,start]=blobHeap.compressed(index);return new Bytes(blobHeap.slice(start,length));};
  const assemblyRow=rows[32][0];if(rows[32].length!==1)throw new BinaryError('Exactly one assembly manifest is required');
  const name=str(assemblyRow[7]),version=assemblyRow.slice(1,5).join('.');
  const references=rows[35].map(r=>({name:str(r[6]),version:r.slice(0,4).join('.')}));
  const typeCache=new Map(),busy=new Set();
  function typeToken(token){
    if(typeCache.has(token))return typeCache.get(token);if(busy.has(token))throw new BinaryError('Cyclic type metadata');busy.add(token);
    const table=token>>>24,rid=token&0xffffff,r=row(table,rid);let result;
    if(table===2){const nesting=rows[41].find(x=>x[0]===rid);const full=nesting?typeToken(0x02000000|nesting[1]).name+'+'+str(r[1]):[str(r[2]),str(r[1])].filter(Boolean).join('.');result={name:full,assembly:name};}
    else if(table===1){const scope=decode('ResolutionScope',r[0]),parent=scope.table===1?typeToken(scope.token):null;result={name:parent?parent.name+'+'+str(r[1]):[str(r[2]),str(r[1])].filter(Boolean).join('.'),assembly:parent?.assembly??(scope.table===35?references[scope.rid-1].name:name)};}
    else if(table===27)result={name:parseSignature(blob(r[0]),'type'),assembly:name};
    else throw new BinaryError('Unsupported type token '+token.toString(16));
    busy.delete(token);typeCache.set(token,result);return result;
  }
  function parseSignature(b,kind='method'){
    let at=0,depth=0;
    const compressed=()=>{const [n,p]=b.compressed(at);at=p;return n;};
    function type(){if(++depth>64)throw new BinaryError('Signature nesting budget exceeded');const e=b.u8(at++);let result;
      const primitives={1:'void',2:'bool',3:'char',4:'int8',5:'uint8',6:'int16',7:'uint16',8:'int32',9:'uint32',10:'int64',11:'uint64',12:'float32',13:'float64',14:'string',24:'nativeint',25:'nativeuint',28:'object'};
      if(primitives[e])result=primitives[e];
      else if(e===0x11||e===0x12){const info=typeToken(decode('TypeDefOrRef',compressed()).token);result=(e===0x11?'valuetype ':'')+'['+info.assembly+']'+info.name;}
      else if(e===0x1d)result=type()+'[]';else if(e===0xf||e===0x10)result=type()+(e===0xf?'*':'&');
      else if(e===0x13||e===0x1e)result=(e===0x13?'!':'!!')+compressed();
      else if(e===0x15){const base=type(),count=compressed();if(count>64)throw new BinaryError('Generic argument budget exceeded');result=base+'<'+Array.from({length:count},type).join(',')+'>';}
      else if(e===0x1f||e===0x20){compressed();result=type();}
      else if(e===0x45)result='pinned '+type();else throw new BinaryError('Unsupported signature element 0x'+e.toString(16));
      depth--;return result;
    }
    let result;
    if(kind==='type')result=type();else {const convention=b.u8(at++);
      if(kind==='field'){if(convention!==6)throw new BinaryError('Invalid field signature');result=type();}
      else if(kind==='locals'){if(convention!==7)throw new BinaryError('Invalid local signature');const count=compressed();if(count>4096)throw new BinaryError('Local variable budget exceeded');result=Array.from({length:count},type);}
      else{if((convention&15)!==0)throw new BinaryError('Vararg and unmanaged calling conventions are unsupported');const genericArity=convention&16?compressed():0,count=compressed();if(count>1024)throw new BinaryError('Parameter budget exceeded');result={hasThis:!!(convention&32),genericArity,returnType:type(),parameters:Array.from({length:count},type)};}
    }
    if(at!==b.length)throw new BinaryError('Trailing signature bytes');return result;
  }
  const types=rows[2].map((r,i)=>({token:0x02000000|i+1,...typeToken(0x02000000|i+1),flags:r[0],base:r[3]?typeToken(decode('TypeDefOrRef',r[3]).token):null,fields:[],methods:[]}));
  const fields=[],methods=[];
  for(let i=0;i<types.length;i++){
    const t=types[i],r=rows[2][i],next=rows[2][i+1];
    const fieldEnd=next?.[4]??rows[4].length+1,methodEnd=next?.[5]??rows[6].length+1;
    if(r[4]<1||fieldEnd<r[4]||fieldEnd>rows[4].length+1||r[5]<1||methodEnd<r[5]||methodEnd>rows[6].length+1)throw new BinaryError('Invalid field/method ownership range');
    for(let id=r[4];id<fieldEnd;id++){const f=row(4,id),field={token:0x04000000|id,owner:t.name,name:str(f[1]),flags:f[0],type:parseSignature(blob(f[2]),'field')};fields.push(field);t.fields.push(field.token);}
    for(let id=r[5];id<methodEnd;id++){const m=row(6,id),method={token:0x06000000|id,owner:t.name,name:str(m[3]),flags:m[2],implFlags:m[1],signature:parseSignature(blob(m[4])),body:null};
      if(m[0]){const start=rva(m[0]),first=bytes.u8(start);let codeSize,headerSize,maxStack,locals=[],initLocals=false,more=false;
        if((first&3)===2){codeSize=first>>>2;headerSize=1;maxStack=8;}
        else if((first&3)===3){const head=bytes.u16(start);headerSize=(head>>>12)*4;if(headerSize<12)throw new BinaryError('Invalid fat method header',start);maxStack=bytes.u16(start+2);codeSize=bytes.u32(start+4);const localToken=bytes.u32(start+8);initLocals=!!(head&16);more=!!(head&8);if(localToken){if(localToken>>>24!==17)throw new BinaryError('Invalid local signature token');locals=parseSignature(blob(row(17,localToken&0xffffff)[0]),'locals');}}
        else throw new BinaryError('Unsupported method header',start);
        if(codeSize>1000000)throw new BinaryError('Method code size budget exceeded');
        rva(m[0],headerSize+codeSize);method.body={bytes:Array.from(bytes.slice(start+headerSize,codeSize)),maxStack,locals,initLocals,hasExceptionRegions:more,fileOffset:start+headerSize};
      }
      methods.push(method);t.methods.push(method.token);
    }
  }
  const members=rows[10].map((r,i)=>{const owner=decode('MemberRefParent',r[0]);if(![1,2,27].includes(owner.table))throw new BinaryError('Unsupported member reference parent');const b=blob(r[2]),field=b.u8(0)===6;return {token:0x0a000000|i+1,owner:typeToken(owner.token),name:str(r[1]),kind:field?'field':'method',signature:parseSignature(b,field?'field':'method')};});
  const userStrings={};
  function userString(token){if(token>>>24!==0x70||!us)throw new BinaryError('Invalid user string token');const at=token&0xffffff,[length,start]=us.compressed(at);if(length<1||length%2!==1)throw new BinaryError('Invalid user string heap entry');return new TextDecoder('utf-16le').decode(us.slice(start,length-1));}
  // Copy user strings once. The resulting model has no reader closures or live PE mappings.
  if(us)for(let at=1;at<us.length;){if(us.u8(at)===0){at++;continue;}const [length,start]=us.compressed(at);userStrings[(0x70000000|at)>>>0]=userString((0x70000000|at)>>>0);at=start+length;}
  const referencedTypes={};for(let i=0;i<rows[1].length;i++)referencedTypes[0x01000000|i+1]=typeToken(0x01000000|i+1);
  return {format:'jailbreak-cli-v1',path,name,version,entryPoint:bytes.u32(cli+20),types,fields,methods,members,references,userStrings,referencedTypes,
    features:{genericDefinitions:rows[42].length,methodSpecifications:rows[43].length,explicitMethodOverrides:rows[25].length,fieldRvas:rows[29].length,interfaceImplementations:rows[9].length}};
}
