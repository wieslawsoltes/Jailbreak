/** Bounds-checked little-endian reader shared by PE/CLI and NuGet ZIP decoding. */
export class BinaryError extends Error {
  constructor(message,offset=0,code='JB6001'){super(message);this.code=code;this.offset=offset;}
}
export function bytesOf(input){
  if(input instanceof Uint8Array)return input;
  if(input instanceof ArrayBuffer)return new Uint8Array(input);
  if(ArrayBuffer.isView(input))return new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
  throw new TypeError('Expected ArrayBuffer or typed-array input');
}
export class Reader {
  constructor(input,start=0,length){this.bytes=bytesOf(input);this.view=new DataView(this.bytes.buffer,this.bytes.byteOffset,this.bytes.byteLength);this.start=start;this.end=start+(length??this.bytes.length-start);this.pos=start;this.check(start,this.end-start);}
  check(at,n){if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||at+n>this.bytes.length||at<this.start||at+n>this.end)throw new BinaryError('Truncated or out-of-range binary data',at);return at;}
  read(n){const at=this.check(this.pos,n);this.pos+=n;return at;}
  u8(){return this.view.getUint8(this.read(1));} i8(){return this.view.getInt8(this.read(1));}
  u16(){return this.view.getUint16(this.read(2),true);} i16(){return this.view.getInt16(this.read(2),true);}
  u32(){return this.view.getUint32(this.read(4),true);} i32(){return this.view.getInt32(this.read(4),true);}
  u64(){return this.view.getBigUint64(this.read(8),true);} i64(){return this.view.getBigInt64(this.read(8),true);}
  f32(){return this.view.getFloat32(this.read(4),true);} f64(){return this.view.getFloat64(this.read(8),true);}
  skip(n){this.read(n);return this;} seek(at){this.check(at,0);this.pos=at;return this;}
  slice(n){const at=this.read(n);return this.bytes.subarray(at,at+n);}
  sub(at,length){this.check(at,length);return new Reader(this.bytes,at,length);}
  compressed(){const at=this.pos,a=this.u8();if(!(a&128))return a;if((a&192)===128)return ((a&63)<<8)|this.u8();if((a&224)===192)return ((a&31)*16777216)+(this.u8()<<16)+(this.u8()<<8)+this.u8();throw new BinaryError('Invalid CLI compressed unsigned integer',at);}
  utf8(n){try{return new TextDecoder('utf-8',{fatal:true}).decode(this.slice(n));}catch{throw new BinaryError('Invalid UTF-8 metadata',this.pos-n);}}
  zeroString(max=1024){const at=this.pos;while(this.pos<this.end&&this.pos-at<max)if(this.u8()===0)return new TextDecoder().decode(this.bytes.subarray(at,this.pos-1));throw new BinaryError('Unterminated binary string',at);}
}
export function align(value,multiple=4){return Math.ceil(value/multiple)*multiple;}
