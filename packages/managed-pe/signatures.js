import { Reader, BinaryError } from './reader.js';
import { decodeCoded } from './metadata-schema.js';
const primitive={1:'void',2:'bool',3:'char',4:'int8',5:'uint8',6:'int16',7:'uint16',8:'int32',9:'uint32',10:'int64',11:'uint64',12:'float32',13:'float64',14:'string',22:'typedref',24:'native int',25:'native uint',28:'object'};
export function readSignature(bytes,resolveType,kind='method'){
  const r=new Reader(bytes);let nodes=0;
  function type(depth=0){if(depth>32||++nodes>4096)throw new BinaryError('Signature complexity budget exceeded',r.pos);const code=r.u8();if(primitive[code])return primitive[code];
    switch(code){
      case 15:return {kind:'pointer',element:type(depth+1)};
      case 16:return {kind:'byref',element:type(depth+1)};
      case 17:case 18:return {kind:code===17?'valuetype':'class',...resolveType(decodeCoded(r.compressed(),'TypeDefOrRef'))};
      case 19:case 30:return {kind:code===19?'var':'mvar',index:r.compressed()};
      case 20:{const element=type(depth+1),rank=r.compressed(),sizes=[],lowerBounds=[];let n=r.compressed();if(n>32)throw new BinaryError('Invalid array signature');while(n--)sizes.push(r.compressed());n=r.compressed();if(n>32)throw new BinaryError('Invalid array bounds');while(n--)lowerBounds.push(r.compressed());return {kind:'array',element,rank,sizes,lowerBounds};}
      case 21:{const base=type(depth+1),count=r.compressed();if(count>128)throw new BinaryError('Generic arity budget exceeded');return {kind:'generic',base,args:Array.from({length:count},()=>type(depth+1))};}
      case 29:return {kind:'array',element:type(depth+1),rank:1};
      case 31:case 32:{const modifier=resolveType(decodeCoded(r.compressed(),'TypeDefOrRef'));return {kind:'modified',required:code===31,modifier,element:type(depth+1)};}
      case 69:return {kind:'pinned',element:type(depth+1)};
      default:throw new BinaryError('Unsupported signature element 0x'+code.toString(16),r.pos-1,'JB6004');
    }
  }
  if(kind==='type'){const value=type();if(r.pos!==r.end)throw new BinaryError('Trailing type signature bytes');return value;}
  const flags=r.u8();let result;
  if(kind==='field'){if(flags!==6)throw new BinaryError('Invalid field signature');result=type();}
  else if(kind==='locals'){if(flags!==7)throw new BinaryError('Invalid local-variable signature');const count=r.compressed();if(count>4096)throw new BinaryError('Local count budget exceeded');result=Array.from({length:count},()=>type());}
  else {const genericArity=flags&16?r.compressed():0,count=r.compressed();if(count>1024)throw new BinaryError('Parameter count budget exceeded');const returnType=type(),parameters=Array.from({length:count},()=>type());result={hasThis:!!(flags&32),explicitThis:!!(flags&64),callingConvention:flags&15,genericArity,returnType,parameters};}
  if(r.pos!==r.end)throw new BinaryError('Trailing signature bytes',r.pos);return result;
}
export { typeName, stackType } from '../compiler-core/managed-types.js';
