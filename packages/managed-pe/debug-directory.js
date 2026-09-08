import {Reader,BinaryError,bytesOf} from './reader.js';
const hex=b=>Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');
/** Decode file-backed PE debug records only; CodeView paths are never filesystem inputs. */
export function readDebugDirectory(input,rva,size,mapRva,{maxBytes=16*1024*1024}={}){
  if(!rva&&!size)return {codeView:[],checksums:[],embedded:null};
  if(!rva||!size||size%28||size/28>128)throw new BinaryError('Invalid PE debug directory',rva,'JB6502');
  const bytes=bytesOf(input),r=new Reader(bytes),table=r.sub(mapRva(rva,size),size),result={codeView:[],checksums:[],embedded:null};let total=0;
  while(table.pos<table.end){
    const flags=table.u32(),stamp=table.slice(4),major=table.u16(),minor=table.u16(),kind=table.u32(),length=table.u32(),address=table.u32(),pointer=table.u32();
    if(flags||length>maxBytes||(total+=length)>maxBytes)throw new BinaryError('Invalid or oversized PE debug record',pointer,'JB6502');
    if(!length)continue;
    r.check(pointer,length);if(address&&mapRva(address,length)!==pointer)throw new BinaryError('Debug record RVA/file offset mismatch',pointer,'JB6502');
    const data=r.sub(pointer,length);
    if(kind===2&&minor===0x504d){
      if(data.u32()!==0x53445352)throw new BinaryError('Portable PDB needs RSDS CodeView record',pointer,'JB6502');
      const id=hex(data.slice(16))+hex(stamp),age=data.u32();if(age!==1)throw new BinaryError('Portable PDB CodeView age must be one',pointer,'JB6502');
      const path=data.zeroString(8192);result.codeView.push({id,path});
    }else if(kind===19){
      if(major!==1||minor!==0)throw new BinaryError('Unsupported PDB checksum record version',pointer,'JB6502');
      const algorithm=data.zeroString(64),hash=hex(data.slice(data.end-data.pos));
      const sizes={SHA256:64,SHA384:96,SHA512:128};if(sizes[algorithm]&&hash.length!==sizes[algorithm])throw new BinaryError('Invalid PDB checksum length',pointer,'JB6502');result.checksums.push({algorithm,hash});
    }else if(kind===17){
      if(minor!==0x100||data.u32()!==0x4244504d||result.embedded)throw new BinaryError('Invalid embedded Portable PDB record',pointer,'JB6502');
      const uncompressedSize=data.u32();if(uncompressedSize>maxBytes)throw new BinaryError('Embedded PDB exceeds byte budget',pointer,'JB6502');
      result.embedded={uncompressedSize,bytes:data.slice(data.end-data.pos)};
    }
  }return result;
}
