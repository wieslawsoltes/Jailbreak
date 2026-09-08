import { BinaryError } from '../managed-pe/bytes.js';
import { category } from './linker.js';
const arithmetic=new Set('add sub mul div div.un rem rem.un and or xor shl shr shr.un'.split(' '));
const compare=new Set('ceq cgt cgt.un clt clt.un'.split(' '));
export function verifyMethod(a,m,instructions,link) {
  const body=m.body;
  if(body.hasExceptionRegions)throw new BinaryError('Exception regions need structured EH lowering',0,'JB6106');
  if(body.locals.length&&!body.initLocals)throw new BinaryError('Uninitialized locals require definite-assignment verification');
  const byOffset=new Map(instructions.map(i=>[i.offset,i])),states=new Map([[instructions[0].offset,[]]]),queue=[instructions[0].offset],leaders=new Set([instructions[0].offset]);
  const args=[...(m.signature.hasThis?['ref']:[]),...m.signature.parameters.map(category)],locals=body.locals.map(category);
  const references=new Map();
  // Resolve every instruction, even unreachable ones. Unsupported IL is not dead-code erased.
  for(const i of instructions){
    if(['call','callvirt','newobj'].includes(i.op))references.set(i.offset,link.resolve(a,i.operand));
    else if(['ldfld','stfld','ldsfld','stsfld'].includes(i.op))references.set(i.offset,link.resolve(a,i.operand,'field'));
    else if(i.op==='newarr')references.set(i.offset,link.resolveType(a,i.operand));
    else if(!['nop','break','ldarg','starg','ldloc','stloc','ldnull','ldc.i4','ldc.i8','ldc.r4','ldc.r8','ldstr','dup','pop','ret','br','brtrue','brfalse','switch','neg','not','ldlen','throw','conv.i1','conv.i2','conv.i4','conv.u4','conv.r4','conv.r8','conv.i','conv.u',...arithmetic,...compare,'ldelem.i4','ldelem.u4','ldelem.ref','ldelem.r4','ldelem.r8','stelem.i4','stelem.ref','stelem.r4','stelem.r8'].includes(i.op)&&!/^b(eq|ge|gt|le|lt|ne)(\.un)?$/.test(i.op))throw new BinaryError('Unsupported IL instruction '+i.op,i.offset,'JB6101');
    if(i.op==='ldstr'&&!Object.hasOwn(a.userStrings,i.operand))throw new BinaryError('Invalid user string token',i.offset);
  }
  function merge(offset,stack){if(!byOffset.has(offset))throw new BinaryError('Control flow falls beyond method',offset,'JB6107');const old=states.get(offset);if(old){if(old.length!==stack.length||old.some((x,i)=>x!==stack[i]))throw new BinaryError('Incompatible evaluation-stack join',offset,'JB6107');}else{states.set(offset,[...stack]);queue.push(offset);}}
  for(let cursor=0;cursor<queue.length;cursor++){
    const offset=queue[cursor],i=byOffset.get(offset),s=[...states.get(offset)],op=i.op;
    const fail=message=>{throw new BinaryError(message,offset,'JB6107');};
    const pop=(expected=null)=>{if(!s.length)fail('Evaluation stack underflow');const value=s.pop();if(expected&&value!==expected)fail(`Expected ${expected}, found ${value}`);return value;};
    const variable=(array,index)=>{if(!Number.isInteger(index)||index<0||index>=array.length)fail('Invalid argument/local index');return array[index];};
    let terminal=false,branches=[];
    if(op==='ldarg')s.push(variable(args,i.index));else if(op==='ldloc')s.push(variable(locals,i.index));
    else if(op==='starg')pop(variable(args,i.index));else if(op==='stloc')pop(variable(locals,i.index));
    else if(op==='ldnull'||op==='ldstr')s.push('ref');else if(op==='ldc.i4')s.push('i4');else if(op==='ldc.i8')fail('Int64 operations are not enabled in this execution profile');else if(op==='ldc.r4'||op==='ldc.r8')s.push('f');
    else if(op==='dup'){const x=pop();s.push(x,x);}else if(op==='pop')pop();
    else if(arithmetic.has(op)){const r=pop(),l=pop();if(!['i4','f'].includes(l)||l!==r)fail('Arithmetic requires matching supported numeric stack types');if((op.includes('.un')||['and','or','xor','shl','shr'].includes(op))&&l!=='i4')fail('Integer-only operation');s.push(l);}
    else if(compare.has(op)||/^b(eq|ge|gt|le|lt|ne)(\.un)?$/.test(op)){const r=pop(),l=pop();if(l!==r||l==='void')fail('Comparison stack types differ');if(l==='ref'&&!['ceq','beq','bne.un','cgt.un'].includes(op))fail('Unsupported reference ordering');if(compare.has(op))s.push('i4');else branches=[i.operand];}
    else if(['neg','not'].includes(op)){const type=pop();if(!['i4','f'].includes(type)||op==='not'&&type!=='i4')fail('Invalid unary operand');s.push(type);}
    else if(op.startsWith('conv.')){const type=pop();if(!['i4','f'].includes(type))fail('Unsupported conversion operand');s.push(op==='conv.r4'||op==='conv.r8'?'f':'i4');}
    else if(['call','callvirt','newobj'].includes(op)){const ref=references.get(offset),sig=ref.signature;for(const t of [...sig.parameters].reverse())pop(category(t));if(sig.hasThis&&op!=='newobj')pop('ref');if(op==='callvirt'&&!sig.hasThis)fail('callvirt requires an instance method');if(op==='newobj'){if(ref.name!=='.ctor'||!sig.hasThis)fail('newobj requires an instance constructor');s.push('ref');}else if(sig.returnType!=='void')s.push(category(sig.returnType));}
    else if(['ldfld','stfld','ldsfld','stsfld'].includes(op)){const f=references.get(offset),staticOp=op.includes('sfld');if(!!(f.flags&16)!==staticOp)fail('Static/instance field opcode mismatch');if(op.startsWith('st'))pop(category(f.type));if(!staticOp)pop('ref');if(op.startsWith('ld'))s.push(category(f.type));}
    else if(op==='newarr'){pop('i4');s.push('ref');}else if(op==='ldlen'){pop('ref');s.push('i4');}
    else if(op.startsWith('ldelem')){pop('i4');pop('ref');s.push(op.endsWith('ref')?'ref':/\.r[48]$/.test(op)?'f':'i4');}
    else if(op.startsWith('stelem')){pop(op.endsWith('ref')?'ref':/\.r[48]$/.test(op)?'f':'i4');pop('i4');pop('ref');}
    else if(op==='br'){branches=[i.operand];terminal=true;}
    else if(op==='brtrue'||op==='brfalse'){const t=pop();if(!['i4','ref'].includes(t))fail('Invalid conditional branch operand');branches=[i.operand];}
    else if(op==='switch'){pop('i4');branches=i.operand;}
    else if(op==='ret'){if(m.signature.returnType!=='void')pop(category(m.signature.returnType));if(s.length)fail('Return leaves values on the evaluation stack');terminal=true;}
    else if(op==='throw'){pop('ref');terminal=true;}
    if(s.length>body.maxStack)fail('Declared maxstack exceeded');
    for(const b of branches){leaders.add(b);merge(b,s);}if(branches.length&&!terminal)leaders.add(i.end);
    if(!terminal)merge(i.end,s);
  }
  return {states,leaders,references};
}
