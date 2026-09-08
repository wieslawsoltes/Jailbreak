import { Bytes, BinaryError } from '../managed-pe/bytes.js';
export const opcodes = new Map();
const add=(code,name,operand='none')=>opcodes.set(code,{code,name,operand});
add(0,'nop');add(1,'break');
for(let i=0;i<4;i++){add(2+i,'ldarg.'+i);add(6+i,'ldloc.'+i);add(10+i,'stloc.'+i);}
for(const [i,name]of ['ldarg.s','ldarga.s','starg.s','ldloc.s','ldloca.s','stloc.s'].entries())add(14+i,name,'u1');
add(20,'ldnull');for(let i=-1;i<=8;i++)add(22+i,'ldc.i4.'+(i===-1?'m1':i));
add(31,'ldc.i4.s','i1');add(32,'ldc.i4','i4');add(33,'ldc.i8','i8');add(34,'ldc.r4','r4');add(35,'ldc.r8','r8');
add(37,'dup');add(38,'pop');add(39,'jmp','token');add(40,'call','token');add(41,'calli','token');add(42,'ret');
for(const [i,name]of ['br','brfalse','brtrue','beq','bge','bgt','ble','blt','bne.un','bge.un','bgt.un','ble.un','blt.un'].entries()){add(43+i,name+'.s','branch1');add(56+i,name,'branch4');}
add(69,'switch','switch');
for(const [i,name]of ['add','sub','mul','div','div.un','rem','rem.un','and','or','xor','shl','shr','shr.un','neg','not'].entries())add(88+i,name);
for(const [i,name]of ['conv.i1','conv.i2','conv.i4','conv.i8','conv.r4','conv.r8','conv.u4','conv.u8'].entries())add(103+i,name);
add(111,'callvirt','token');add(114,'ldstr','token');add(115,'newobj','token');add(116,'castclass','token');add(117,'isinst','token');add(122,'throw');
for(const [i,name]of ['ldfld','ldflda','stfld','ldsfld','stsflda','stsfld'].entries())add(123+i,name,'token');
add(140,'box','token');add(141,'newarr','token');add(142,'ldlen');add(143,'ldelema','token');
for(const [i,name]of ['ldelem.i1','ldelem.u1','ldelem.i2','ldelem.u2','ldelem.i4','ldelem.u4','ldelem.i8','ldelem.i','ldelem.r4','ldelem.r8','ldelem.ref','stelem.i','stelem.i1','stelem.i2','stelem.i4','stelem.i8','stelem.r4','stelem.r8','stelem.ref'].entries())add(144+i,name);
add(163,'ldelem','token');add(164,'stelem','token');add(165,'unbox.any','token');add(208,'ldtoken','token');add(211,'conv.i');add(224,'conv.u');
for(const [code,name]of [[0xfe01,'ceq'],[0xfe02,'cgt'],[0xfe03,'cgt.un'],[0xfe04,'clt'],[0xfe05,'clt.un']])add(code,name);
for(const [i,name]of ['ldarg','ldarga','starg','ldloc','ldloca','stloc'].entries())add(0xfe09+i,name,'u2');
add(0xfe16,'constrained.','token');add(0xfe1e,'readonly.');

/** Decode once at build time. Unknown instructions never disappear. */
export function decodeIL(body) {
  const b=new Bytes(Uint8Array.from(body.bytes)),out=[];let p=0;
  while(p<b.length){const offset=p;let code=b.u8(p++);if(code===254)code=0xfe00|b.u8(p++);const info=opcodes.get(code);if(!info)throw new BinaryError('Unsupported opcode 0x'+code.toString(16),offset,'JB6101');let operand;
    const read=(size,fn)=>{b.check(p,size);const value=b.view[fn](p,true);p+=size;return value;};
    switch(info.operand){
      case'u1':operand=b.u8(p++);break;case'i1':operand=read(1,'getInt8');break;case'u2':operand=read(2,'getUint16');break;
      case'i4':operand=read(4,'getInt32');break;case'token':operand=read(4,'getUint32');break;
      case'i8':operand=read(8,'getBigInt64').toString();break;case'r4':operand=read(4,'getFloat32');break;case'r8':operand=read(8,'getFloat64');break;
      case'branch1':operand=read(1,'getInt8')+p;break;case'branch4':operand=read(4,'getInt32')+p;break;
      case'switch':{const count=read(4,'getUint32');if(count>65536)throw new BinaryError('Switch budget exceeded',offset);b.check(p,count*4);const end=p+count*4;operand=Array.from({length:count},()=>read(4,'getInt32')+end);break;}
    }
    let name=info.name,index=null;
    if(/^(ldarg|ldloc|stloc)\.[0-3]$/.test(name)){index=+name.at(-1);name=name.slice(0,-2);}
    else if(/^(ldarg|starg|ldloc|stloc)\.s$/.test(name)){name=name.slice(0,-2);index=operand;}
    else if(['ldarg','starg','ldloc','stloc'].includes(name))index=operand;
    else if(name.startsWith('ldc.i4.')){operand=name==='ldc.i4.s'?operand:name.endsWith('m1')?-1:+name.at(-1);name='ldc.i4';}
    else if(info.operand.startsWith('branch'))name=name.replace(/\.s$/,'');
    out.push({offset,end:p,op:name,operand,index});
  }
  if(!out.length)throw new BinaryError('Empty IL method body');
  const offsets=new Set(out.map(i=>i.offset));
  for(const i of out)if(i.op==='switch'||/^br|^b(eq|ge|gt|le|lt|ne)/.test(i.op))for(const target of Array.isArray(i.operand)?i.operand:[i.operand])if(!offsets.has(target))throw new BinaryError('Branch does not target an instruction boundary',i.offset,'JB6102');
  return out;
}
