import { OverflowException } from './exceptions.js';

/** Exact overflow decisions, including 64-bit operands and products beyond 2^53. */
export function checkedBinary(op,a,b,kind){
  const bits=kind==='i8'?64:32,unsigned=op.endsWith('.un');
  a=unsigned?BigInt.asUintN(bits,BigInt(a)):BigInt.asIntN(bits,BigInt(a));
  b=unsigned?BigInt.asUintN(bits,BigInt(b)):BigInt.asIntN(bits,BigInt(b));
  const operation=op.split('.')[0];
  const result=operation==='add'?a+b:operation==='sub'?a-b:operation==='mul'?a*b:null;
  if(result===null)throw new TypeError('Unknown checked arithmetic operation');
  bounded(result,bits,unsigned);
  return kind==='i8'?BigInt.asIntN(64,result):Number(BigInt.asIntN(32,result));
}
function bounded(value,bits,unsigned){
  const min=unsigned?0n:-(1n<<BigInt(bits-1));
  const max=(1n<<BigInt(unsigned?bits:bits-1))-1n;
  if(value<min||value>max)throw new OverflowException('Arithmetic operation resulted in an overflow');
  return value;
}
export function checkedConvert(op,value,from){
  const match=/^conv\.ovf\.([iu])([1248])(\.un)?$/.exec(op);
  if(!match)throw new TypeError('Unknown checked numeric conversion');
  const unsigned=match[1]==='u',bits=Number(match[2])*8;
  let integer;
  if(from==='f'){
    if(!Number.isFinite(value))throw new OverflowException('Non-finite checked conversion');
    integer=BigInt(Math.trunc(value));
  }else{
    const sourceBits=from==='i8'?64:32;
    integer=match[3]?BigInt.asUintN(sourceBits,BigInt(value)):BigInt.asIntN(sourceBits,BigInt(value));
  }
  bounded(integer,bits,unsigned);
  return bits===64?BigInt.asIntN(64,integer):Number(bits===32?BigInt.asIntN(32,integer):integer);
}
