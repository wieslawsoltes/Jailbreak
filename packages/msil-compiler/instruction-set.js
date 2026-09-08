import { Reader, BinaryError } from '../managed-pe/reader.js';
/** Operand widths are explicit. Unknown/reserved opcodes never guess instruction lengths. */
export const opcodes=new Map();
function add(code,name,operand='none'){opcodes.set(code,{code,name,operand});}
function series(start,names,operand='none'){names.split(' ').forEach((name,i)=>add(start+i,name,operand));}
series(0,'nop break ldarg.0 ldarg.1 ldarg.2 ldarg.3 ldloc.0 ldloc.1 ldloc.2 ldloc.3 stloc.0 stloc.1 stloc.2 stloc.3');
series(0x0e,'ldarg.s ldarga.s starg.s ldloc.s ldloca.s stloc.s','u8');
series(0x14,'ldnull ldc.i4.m1 ldc.i4.0 ldc.i4.1 ldc.i4.2 ldc.i4.3 ldc.i4.4 ldc.i4.5 ldc.i4.6 ldc.i4.7 ldc.i4.8');
add(0x1f,'ldc.i4.s','i8');add(0x20,'ldc.i4','i32');add(0x21,'ldc.i8','i64');add(0x22,'ldc.r4','f32');add(0x23,'ldc.r8','f64');
add(0x25,'dup');add(0x26,'pop');add(0x27,'jmp','token');add(0x28,'call','token');add(0x29,'calli','token');add(0x2a,'ret');
series(0x2b,'br.s brfalse.s brtrue.s beq.s bge.s bgt.s ble.s blt.s bne.un.s bge.un.s bgt.un.s ble.un.s blt.un.s','branch8');
series(0x38,'br brfalse brtrue beq bge bgt ble blt bne.un bge.un bgt.un ble.un blt.un','branch32');add(0x45,'switch','switch');
series(0x46,'ldind.i1 ldind.u1 ldind.i2 ldind.u2 ldind.i4 ldind.u4 ldind.i8 ldind.i ldind.r4 ldind.r8 ldind.ref stind.ref stind.i1 stind.i2 stind.i4 stind.i8 stind.r4 stind.r8');
series(0x58,'add sub mul div div.un rem rem.un and or xor shl shr shr.un neg not conv.i1 conv.i2 conv.i4 conv.i8 conv.r4 conv.r8 conv.u4 conv.u8');
add(0x6f,'callvirt','token');series(0x70,'cpobj ldobj ldstr newobj castclass isinst','token');add(0x76,'conv.r.un');add(0x79,'unbox','token');add(0x7a,'throw');
series(0x7b,'ldfld ldflda stfld ldsfld ldsflda stsfld stobj','token');
series(0x82,'conv.ovf.i1.un conv.ovf.i2.un conv.ovf.i4.un conv.ovf.i8.un conv.ovf.u1.un conv.ovf.u2.un conv.ovf.u4.un conv.ovf.u8.un conv.ovf.i.un conv.ovf.u.un');
add(0x8c,'box','token');add(0x8d,'newarr','token');add(0x8e,'ldlen');add(0x8f,'ldelema','token');
series(0x90,'ldelem.i1 ldelem.u1 ldelem.i2 ldelem.u2 ldelem.i4 ldelem.u4 ldelem.i8 ldelem.i ldelem.r4 ldelem.r8 ldelem.ref stelem.i stelem.i1 stelem.i2 stelem.i4 stelem.i8 stelem.r4 stelem.r8 stelem.ref');
series(0xa3,'ldelem stelem unbox.any','token');series(0xb3,'conv.ovf.i1 conv.ovf.u1 conv.ovf.i2 conv.ovf.u2 conv.ovf.i4 conv.ovf.u4 conv.ovf.i8 conv.ovf.u8');
add(0xc2,'refanyval','token');add(0xc3,'ckfinite');add(0xc6,'mkrefany','token');add(0xd0,'ldtoken','token');
series(0xd1,'conv.u2 conv.u1 conv.i conv.ovf.i conv.ovf.u add.ovf add.ovf.un mul.ovf mul.ovf.un sub.ovf sub.ovf.un endfinally');add(0xdd,'leave','branch32');add(0xde,'leave.s','branch8');add(0xdf,'stind.i');add(0xe0,'conv.u');
series(0xfe00,'arglist ceq cgt cgt.un clt clt.un');add(0xfe06,'ldftn','token');add(0xfe07,'ldvirtftn','token');series(0xfe09,'ldarg ldarga starg ldloc ldloca stloc','u16');add(0xfe0f,'localloc');add(0xfe11,'endfilter');add(0xfe12,'unaligned.','u8');add(0xfe13,'volatile.');add(0xfe14,'tail.');add(0xfe15,'initobj','token');add(0xfe16,'constrained.','token');add(0xfe17,'cpblk');add(0xfe18,'initblk');add(0xfe19,'no.','u8');add(0xfe1a,'rethrow');add(0xfe1c,'sizeof','token');add(0xfe1d,'refanytype');add(0xfe1e,'readonly.');
export const byName=new Map([...opcodes.values()].map(o=>[o.name,o]));
export function decodeIL(code,{maxInstructions=100000}={}){
  const r=new Reader(code),instructions=[];
  while(r.pos<r.end){if(instructions.length>=maxInstructions)throw new BinaryError('IL instruction budget exceeded',r.pos);const offset=r.pos;let value=r.u8();if(value===0xfe)value=0xfe00+r.u8();const op=opcodes.get(value);if(!op)throw new BinaryError('Unknown/reserved IL opcode 0x'+value.toString(16),offset,'JB6101');let operand=null;
    if(['u8','i8','u16','i32','i64','f32','f64'].includes(op.operand))operand=r[op.operand]();
    else if(op.operand==='token')operand=r.u32();
    else if(op.operand==='branch8'){operand=r.i8();operand+=r.pos;}
    else if(op.operand==='branch32'){operand=r.i32();operand+=r.pos;}
    else if(op.operand==='switch'){const count=r.u32();if(count>65536)throw new BinaryError('Switch table budget exceeded',offset);r.check(r.pos,count*4);const base=r.pos+count*4;operand=Array.from({length:count},()=>base+r.i32());}
    instructions.push({offset,name:op.name,operand,next:r.pos});
  }
  const offsets=new Set(instructions.map(i=>i.offset));for(const i of instructions){const operand=byName.get(i.name).operand;for(const target of operand==='switch'?i.operand:operand.startsWith('branch')?[i.operand]:[])if(!offsets.has(target))throw new BinaryError('Branch target is not an instruction boundary',i.offset,'JB6102');}
  return instructions;
}
export function disassemble(method){return (method.instructions??decodeIL(method.body.code)).map(i=>`IL_${i.offset.toString(16).padStart(4,'0')}: ${i.name}${i.operand==null?'':' '+(typeof i.operand==='bigint'?i.operand.toString():Array.isArray(i.operand)?'('+i.operand.map(n=>'IL_'+n.toString(16).padStart(4,'0')).join(', ')+')':byName.get(i.name)?.operand?.startsWith('branch')?'IL_'+i.operand.toString(16).padStart(4,'0'):byName.get(i.name)?.operand==='token'?'0x'+i.operand.toString(16).padStart(8,'0'):i.operand)}`).join('\n');}
