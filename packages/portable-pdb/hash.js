import {bytesOf} from '../managed-pe/reader.js';
const constants=new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const rotate=(v,n)=>(v>>>n)|(v<<(32-n));
/** Bounded SHA-1/SHA-256 fallback for opaque/offline origins without WebCrypto. Not authentication. */
export function portableHash(input,algorithm='SHA-256'){
  const bytes=bytesOf(input);if(bytes.length>32*1024*1024)throw new RangeError('Hash input exceeds 32 MiB');
  if(!['SHA-1','SHA-256'].includes(algorithm))throw new Error('This checksum needs a secure context with WebCrypto: '+algorithm);
  const data=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);data.set(bytes);data[bytes.length]=128;
  const view=new DataView(data.buffer);view.setBigUint64(data.length-8,BigInt(bytes.length)*8n,false);
  const sha1=algorithm==='SHA-1',h=sha1?[0x67452301,0xefcdab89,0x98badcfe,0x10325476,0xc3d2e1f0]:[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(80);
  for(let offset=0;offset<data.length;offset+=64){
    for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4,false);
    if(sha1){
      for(let i=16;i<80;i++)w[i]=rotate(w[i-3]^w[i-8]^w[i-14]^w[i-16],31);
      let [a,b,c,d,e]=h;
      for(let i=0;i<80;i++){const f=i<20?(b&c)|(~b&d):i<40?b^c^d:i<60?(b&c)|(b&d)|(c&d):b^c^d,k=i<20?0x5a827999:i<40?0x6ed9eba1:i<60?0x8f1bbcdc:0xca62c1d6,t=(rotate(a,27)+f+e+k+w[i])|0;e=d;d=c;c=rotate(b,2);b=a;a=t;}
      for(const [i,v]of [a,b,c,d,e].entries())h[i]=(h[i]+v)>>>0;
    }else{
      for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(rotate(a,7)^rotate(a,18)^a>>>3)+w[i-16]+(rotate(b,17)^rotate(b,19)^b>>>10)+w[i-7];}
      let [a,b,c,d,e,f,g,last]=h;
      for(let i=0;i<64;i++){const t1=(last+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+constants[i]+w[i])|0,t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))|0;last=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
      for(const [i,v]of [a,b,c,d,e,f,g,last].entries())h[i]=(h[i]+v)>>>0;
    }
  }return h.map(v=>v.toString(16).padStart(8,'0')).join('');
}
export async function digest(input,algorithm='SHA-256'){
  const bytes=bytesOf(input);if(bytes.length>32*1024*1024)throw new RangeError('Hash input exceeds 32 MiB');
  if(!globalThis.crypto?.subtle)return portableHash(bytes,algorithm);
  return Array.from(new Uint8Array(await crypto.subtle.digest(algorithm,bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
