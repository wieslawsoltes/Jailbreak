import {bytesOf} from '../managed-pe/reader.js';
const shift = [7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
const constants = Uint32Array.from({length:64}, (_, i) => Math.floor(Math.abs(Math.sin(i+1))*2**32));
/** RFC1321 compatibility for legacy document matching ONLY. MD5 is not authentication. */
export function legacyMd5(input) {
  const bytes = bytesOf(input);
  if (bytes.length > 32*1024*1024) throw new RangeError('Legacy checksum byte budget exceeded');
  const data = new Uint8Array(Math.ceil((bytes.length+9)/64)*64); data.set(bytes); data[bytes.length] = 128;
  const v = new DataView(data.buffer); v.setBigUint64(data.length-8, BigInt(bytes.length)*8n, true);
  const h = [0x67452301,0xefcdab89,0x98badcfe,0x10325476];
  for (let at = 0; at < data.length; at += 64) {
    let [a,b,c,d] = h;
    for (let i = 0; i < 64; i++) {
      const round = i >>> 4, g = round === 0 ? i : round === 1 ? (5*i+1)%16 : round === 2 ? (3*i+5)%16 : (7*i)%16;
      const f = round === 0 ? (b&c)|(~b&d) : round === 1 ? (d&b)|(~d&c) : round === 2 ? b^c^d : c^(b|~d);
      const sum = (a+f+constants[i]+v.getUint32(at+g*4,true))|0, n = shift[round*4+i%4];
      const next = (b+((sum<<n)|(sum>>>(32-n))))|0; a=d; d=c; c=b; b=next;
    }
    for (const [i,value] of [a,b,c,d].entries()) h[i] = (h[i]+value)>>>0;
  }
  const out = new Uint8Array(16), view = new DataView(out.buffer); h.forEach((n,i) => view.setUint32(i*4,n,true));
  return Array.from(out,b=>b.toString(16).padStart(2,'0')).join('');
}
