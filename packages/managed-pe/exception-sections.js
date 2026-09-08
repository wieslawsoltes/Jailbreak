import { BinaryError, align } from './reader.js';

/** ECMA-335 II.25.4.5-6: bounded, file-backed small/fat exception sections. */
export function readExceptionSections(reader, start, codeSize, resolveType, checkRange, {maxClauses=1024}={}) {
  const clauses=[];
  let at=align(start), more=true, sections=0;
  while(more){
    if(++sections>64)throw new BinaryError('Exception section budget exceeded',at);
    checkRange(at,4);
    const h=reader.sub(at,4),kind=h.u8(),fat=!!(kind&0x40);
    if((kind&0x3f)!==1)throw new BinaryError('Unsupported method data section',at,'JB6004');
    more=!!(kind&0x80);
    const size=fat?h.u8()+(h.u8()<<8)+(h.u8()<<16):h.u8();
    if(!fat&&h.u16()!==0)throw new BinaryError('Nonzero small exception-section reserved bytes',at);
    const stride=fat?24:12;
    if(size<4||(size-4)%stride)throw new BinaryError('Invalid exception-section size',at);
    const count=(size-4)/stride;
    if(!count||clauses.length+count>maxClauses)throw new BinaryError('Exception clause budget exceeded',at);
    checkRange(at,size);
    const data=reader.sub(at+4,size-4);
    for(let i=0;i<count;i++){
      const offset=data.pos,flags=fat?data.u32():data.u16();
      const tryOffset=fat?data.u32():data.u16(),tryLength=fat?data.u32():data.u8();
      const handlerOffset=fat?data.u32():data.u16(),handlerLength=fat?data.u32():data.u8(),token=data.u32();
      if(![0,1,2,4].includes(flags))throw new BinaryError('Unsupported exception clause flags',offset,'JB6004');
      for(const [p,n] of [[tryOffset,tryLength],[handlerOffset,handlerLength]])if(!n||p+n>codeSize)throw new BinaryError('Exception range leaves method body',offset);
      const clause={kind:({0:'catch',1:'filter',2:'finally',4:'fault'})[flags],tryOffset,tryLength,handlerOffset,handlerLength};
      if(flags===0){if(![1,2,27].includes(token>>>24))throw new BinaryError('Invalid catch type token',offset);clause.catchType=resolveType(token);}
      else if(flags===1){if(token>=handlerOffset)throw new BinaryError('Invalid exception filter offset',offset);clause.filterOffset=token;}
      else if(token!==0)throw new BinaryError('Finally/fault must have a zero class token',offset);
      clauses.push(clause);
    }
    at=align(at+size);
  }
  return clauses;
}
