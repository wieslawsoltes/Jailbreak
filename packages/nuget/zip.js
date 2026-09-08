import { Reader, BinaryError, bytesOf } from '../managed-pe/reader.js';
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function safeName(name){if(!name||name.includes('\0')||name.includes('\\')||name.startsWith('/')||/^[A-Za-z][\w+.-]*:/.test(name)||name.split('/').some(p=>p==='..'||p==='.'))throw new BinaryError('Unsafe ZIP entry path: '+name,0,'JB6301');return name;}
/** Local ZIP ingestion: no extraction to disk, no script execution, bounded decompression. */
export function readZip(input,{maxBytes=32*1024*1024,maxExpandedBytes=64*1024*1024,maxEntryBytes=32*1024*1024,maxEntries=4096,maxRatio=500}={}){
  const bytes=bytesOf(input);if(bytes.length>maxBytes)throw new BinaryError('Package exceeds compressed byte budget',0,'JB6301');const r=new Reader(bytes);let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(r.view.getUint32(i,true)===0x06054b50&&i+22+r.view.getUint16(i+20,true)===bytes.length){end=i;break;}
  if(end<0)throw new BinaryError('ZIP end-of-central-directory was not found',0,'JB6301');r.seek(end+4);const disk=r.u16(),centralDisk=r.u16(),diskCount=r.u16(),count=r.u16(),centralSize=r.u32(),centralOffset=r.u32();r.u16();
  if(disk||centralDisk||diskCount!==count)throw new BinaryError('Multi-disk ZIP archives are unsupported',end,'JB6301');
  if(count===65535||centralSize===0xffffffff||centralOffset===0xffffffff)throw new BinaryError('ZIP64 is not supported',end,'JB6301');
  if(count>maxEntries||centralOffset+centralSize>end)throw new BinaryError('Invalid central directory or entry budget exceeded',end,'JB6301');
  const cd=r.sub(centralOffset,centralSize),entries=new Map(),caseNames=new Set(),ranges=[];let expanded=0;
  for(let i=0;i<count;i++){
    if(cd.u32()!==0x02014b50)throw new BinaryError('Invalid ZIP central entry',cd.pos-4,'JB6301');cd.u16();const version=cd.u16(),flags=cd.u16(),method=cd.u16();cd.skip(4);const crc=cd.u32(),compressedSize=cd.u32(),size=cd.u32(),nameLength=cd.u16(),extraLength=cd.u16(),commentLength=cd.u16(),startDisk=cd.u16();cd.u16();const attributes=cd.u32(),offset=cd.u32();
    if(flags&0x2041||startDisk||!([0,8].includes(method))||version>20||(attributes>>>16&0xf000)===0xa000)throw new BinaryError('Encrypted, symlink or unsupported ZIP entry',offset,'JB6301');
    if(size===0xffffffff||compressedSize===0xffffffff||offset===0xffffffff)throw new BinaryError('ZIP64 entry is unsupported',offset,'JB6301');
    const nameBytes=cd.slice(nameLength);if(!(flags&0x800)&&nameBytes.some(b=>b>127))throw new BinaryError('Non-UTF8 legacy ZIP filenames are unsupported',offset,'JB6301');let name;try{name=safeName(new TextDecoder('utf-8',{fatal:true}).decode(nameBytes));}catch(e){throw new BinaryError(e.message,offset,'JB6301');}cd.skip(extraLength+commentLength);
    if(caseNames.has(name.toLowerCase()))throw new BinaryError('Duplicate/case-colliding ZIP entry: '+name,offset,'JB6301');caseNames.add(name.toLowerCase());
    expanded+=size;if(size>maxEntryBytes||expanded>maxExpandedBytes||size>Math.max(1,compressedSize)*maxRatio)throw new BinaryError('ZIP expansion budget exceeded',offset,'JB6301');
    const local=r.sub(offset,centralOffset-offset);if(local.u32()!==0x04034b50)throw new BinaryError('Invalid ZIP local header',offset,'JB6301');local.u16();if(local.u16()!==flags||local.u16()!==method)throw new BinaryError('Conflicting local/central ZIP header',offset,'JB6301');local.skip(4);const localCrc=local.u32(),localCompressed=local.u32(),localSize=local.u32(),ln=local.u16(),le=local.u16();const localName=new TextDecoder('utf-8',{fatal:true}).decode(local.slice(ln));if(localName!==name)throw new BinaryError('Conflicting ZIP filenames',offset,'JB6301');local.skip(le);const dataOffset=local.pos;local.check(dataOffset,compressedSize);
    if(!(flags&8)&&(localCrc!==crc||localCompressed!==compressedSize||localSize!==size))throw new BinaryError('Conflicting ZIP sizes/checksum',offset,'JB6301');
    ranges.push([offset,dataOffset+compressedSize]);entries.set(name,{name,size,compressedSize,method,crc,dataOffset,directory:name.endsWith('/')});
  }
  if(cd.pos!==cd.end)throw new BinaryError('Trailing or mismatched central-directory size',cd.pos,'JB6301');ranges.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++)if(ranges[i][0]<ranges[i-1][1])throw new BinaryError('Overlapping ZIP entries',ranges[i][0],'JB6301');
  return {entries,compressedBytes:bytes.length,expandedBytes:expanded,
    async read(name){const entry=entries.get(name);if(!entry)throw new BinaryError('Missing ZIP entry '+name,0,'JB6301');const compressed=bytes.subarray(entry.dataOffset,entry.dataOffset+entry.compressedSize);let output;
      if(entry.method===0)output=compressed.slice();else {
        if(!globalThis.DecompressionStream)throw new BinaryError('This host needs DecompressionStream(deflate-raw)',0,'JB6302');
        const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let length=0;
        try{for(;;){const {done,value}=await stream.read();if(done)break;length+=value.length;if(length>entry.size||length>maxEntryBytes){await stream.cancel();throw new BinaryError('Decompressed output exceeds declared size',entry.dataOffset,'JB6301');}parts.push(value);}output=new Uint8Array(length);let offset=0;for(const part of parts){output.set(part,offset);offset+=part.length;}}finally{stream.releaseLock();}
      }
      if(output.length!==entry.size||crc32(output)!==entry.crc)throw new BinaryError('ZIP CRC/size validation failed for '+name,entry.dataOffset,'JB6301');return output;
    }
  };
}
