import { escapeJs } from '../compiler-core/index.js';
import { stackType } from '../compiler-core/managed-types.js';
import { baseOpcode, argumentIndex } from './verification.js';
const j=escapeJs;
function literal(v){return typeof v==='bigint'?v+'n':typeof v==='number'&&!Number.isFinite(v)?Number.isNaN(v)?'NaN':v>0?'Infinity':'-Infinity':j(v);}
/** Ahead-of-time emission: one native JavaScript case per basic block, never an opcode interpreter. */
export function emitMethod(assembly,method,verified,{sites=[],cooperative=false}={}){
  const {instructions,types,regions}=verified,tokens=new Map([...assembly.methods,...assembly.members,...assembly.fields].map(m=>[m.token,m]));
  const leaders=new Set([instructions[0].offset]);
  for(const r of regions.scopes){leaders.add(r.start);leaders.add(r.end);}
  for(const i of instructions){const op=baseOpcode(i.name);if(op==='leave'){leaders.add(i.operand);leaders.add(i.next);}else if(op==='switch'){i.operand.forEach(x=>leaders.add(x));leaders.add(i.next);}else if(/^b(?:r|eq|ge|gt|le|lt|ne)/.test(op)&&op!=='break'){leaders.add(i.operand);leaders.add(i.next);}else if(['ret','throw','rethrow','endfinally'].includes(op))leaders.add(i.next);}
  const eh=regions.clauses.length>0;
  const lines=[cooperative?'function*($co,$budget,self,parameters){':'function(self,parameters){',eh?`const eh=C.exceptionFrame(${j(regions.clauses)});`:'',`const arg=${method.static?'parameters.slice()':'[self,...parameters]'}, local=[${method.body.locals.map(t=>stackType(t)==='ref'?'null':stackType(t)==='i8'?'0n':'0').join(',')}], s=[];let pc=${instructions[0].offset},a,b,v,argv;`,cooperative&&eh?'let settled=false;function* body(){':'',eh?'while(true){let action;try{switch(pc){':'while(true){switch(pc){'];
  const debugPoints=new Map(sites.map(s=>[s.point.ilOffset,s]));
  let currentBlock=null;
  for(let n=0;n<instructions.length;n++){
    const i=instructions[n],op=baseOpcode(i.name),type=types.get(i.offset);if(leaders.has(i.offset)){if(currentBlock!==null)lines.push(`pc=${i.offset};continue;`);lines.push(`case ${i.offset}: ${cooperative?'':'C.tick('+blockCost(n)+');'}`);currentBlock=i.offset;}
    const site=debugPoints.get(i.offset);
    if(cooperative){
      const critical=regions.clauses.some(c=>['finally','fault'].includes(c.kind)&&c.handlerOffset<=i.offset&&i.offset<c.handlerOffset+c.handlerLength);
      lines.push(`pc=${i.offset};`);
      if(site){
        const slots=[...method.signature.parameters.map((type,index)=>({name:method.parameterNames?.[index]||'arg'+index,type,ref:'arg['+(index+(method.static?0:1))+']'})),...site.locals.map(l=>({...l,type:method.body.locals[l.slot],ref:'local['+l.slot+']'}))];
        const locals=slots.map(l=>`[${j(l.name)}]:${l.ref}`),editable=slots.filter(l=>['int8','uint8','int16','uint16','int32','uint32','float32','float64','string'].includes(l.type));
        const setters=editable.map(l=>`[${j(l.name)}]:value=>{${l.ref}=C.coerce(${j(l.type)},value);}`),types=editable.map(l=>`[${j(l.name)}]:${j(({int8:'sbyte',uint8:'byte',int16:'short',uint16:'ushort',int32:'int',uint32:'int',float32:'float',float64:'double'})[l.type]??l.type)}`);
        lines.push(`/*@jb:${site.point.id}*/yield {kind:'checkpoint',point:${j(site.point)},critical:${critical},locals:()=>({this:self,${locals.join(',')}${locals.length?',':''}$ilOffset:pc,$evaluationStack:s.slice()}),setters:{${setters.join(',')}},types:{${types.join(',')}}};`);
      }else lines.push(`yield {kind:'safepoint',critical:${critical}};`);
      lines.push('C.tickSteps($co,$budget,1);');
    }else if(site){const locals=site.locals.map(l=>`[${j(l.name)}]:local[${l.slot}]`),args=method.signature.parameters.map((_,a)=>`[${j(method.parameterNames?.[a]||'arg'+a)}]:arg[${a+(method.static?0:1)}]`);lines.push(`/*@jb:${site.point.id}*/if(C.debugHit(${j(site.point)},()=>({this:self,${[...args,...locals].join(',')}}))){debugger;}`);}
    lines.push(`// IL_${i.offset.toString(16).padStart(4,'0')} ${i.name}`);
    const push=e=>lines.push(`s.push(${e});`),pop='s.pop()';
    if(/^ldarg(?:\.|$)/.test(op))push(`arg[${argumentIndex(i)}]`);
    else if(op==='starg')lines.push(`arg[${argumentIndex(i)}]=C.coerce(${j(method.signature.parameters[argumentIndex(i)-(method.static?0:1)]??'object')},${pop});`);
    else if(/^ldloc(?:\.|$)/.test(op))push(`local[${argumentIndex(i)}]`);
    else if(/^stloc(?:\.|$)/.test(op))lines.push(`local[${argumentIndex(i)}]=C.coerce(${j(method.body.locals[argumentIndex(i)])},${pop});`);
    else if(op.startsWith('ldc.i4'))push(op==='ldc.i4.m1'?'-1':/ldc.i4.[0-8]$/.test(op)?op.at(-1):String(i.operand));
    else if(op.startsWith('ldc.'))push(literal(i.operand));
    else if(op==='ldnull')push('null');else if(op==='ldstr')push(j(assembly.userStrings[i.operand]));
    else if(op==='dup')push('s[s.length-1]');else if(op==='pop')lines.push('s.pop();');
    else if(['add','sub','mul','div','div.un','rem','rem.un','and','or','xor','shl','shr','shr.un'].includes(op)){
      lines.push('b=s.pop();a=s.pop();');if(type==='i8')push(`C.long(${j(op)},a,b)`);else if(type==='i4'){const e={add:'C.D.iadd(a,b)',sub:'C.D.isub(a,b)',mul:'C.D.imul(a,b)',div:'C.D.idiv(a,b)',rem:'C.D.irem(a,b)','div.un':'C.D.idiv(a>>>0,b>>>0)','rem.un':'C.D.irem(a>>>0,b>>>0)',and:'a&b',or:'a|b',xor:'a^b',shl:'a<<b',shr:'a>>b','shr.un':'(a>>>b)|0'};push(e[op]);}else push(`a ${{add:'+',sub:'-',mul:'*',div:'/',rem:'%'}[op]} b`);
    }
    else if(/^(add|sub|mul)\.ovf(\.un)?$/.test(op)){lines.push('b=s.pop();a=s.pop();');push(`C.D.checkedBinary(${j(op)},a,b,${j(type)})`);}
    else if(/^conv\.ovf\.[iu][1248](\.un)?$/.test(op))push(`C.D.checkedConvert(${j(op)},s.pop(),${j(type)})`);
    else if(op==='neg'||op==='not')push(type==='i8'?`C.long(${j(op)},${pop})`:type==='i4'?op==='neg'?`C.D.isub(0,${pop})`:`~${pop}`:`-${pop}`);
    else if(['ceq','cgt','cgt.un','clt','clt.un','beq','bge','bgt','ble','blt','bne.un','bge.un','bgt.un','ble.un','blt.un'].includes(op)){
      lines.push('b=s.pop();a=s.pop();');const compare=op.replace('.un',''),operator={ceq:'===',cgt:'>',clt:'<',beq:'===',bge:'>=',bgt:'>',ble:'<=',blt:'<','bne':'!=='}[compare];let left='a',right='b';
      if(op.endsWith('.un')&&type==='i4'){left='(a>>>0)';right='(b>>>0)';}if(op.endsWith('.un')&&type==='i8'){left='BigInt.asUintN(64,a)';right='BigInt.asUintN(64,b)';}
      let cond=`${left} ${operator} ${right}`;if(type==='ref'&&op==='cgt.un')cond='a!==b';if(type==='f'&&op.endsWith('.un'))cond=`Number.isNaN(a)||Number.isNaN(b)||(${cond})`;
      if(op[0]==='b'){lines.push(`pc=(${cond})?${i.operand}:${i.next};continue;`);currentBlock=null;}else push(`(${cond})?1:0`);
    }
    else if(op==='leave'){lines.push(eh?`s.length=0;action=eh.leave(pc,${i.operand});break;`:`s.length=0;pc=${i.operand};continue;`);currentBlock=null;}
    else if(op==='endfinally'){lines.push('action=eh.endFinally(pc);break;');currentBlock=null;}
    else if(op==='rethrow'){lines.push('throw eh.rethrow(pc);');currentBlock=null;}
    else if(op==='br'){lines.push(`pc=${i.operand};continue;`);currentBlock=null;}
    else if(op==='brfalse'||op==='brtrue'){lines.push(`v=s.pop();pc=${op==='brfalse'?'!':''}(v!==0&&v!==0n&&v!==null)?${i.operand}:${i.next};continue;`);currentBlock=null;}
    else if(op==='switch'){lines.push(`v=s.pop();pc=(v>>>0)<${i.operand.length}?[${i.operand.join(',')}][v>>>0]:${i.next};continue;`);currentBlock=null;}
    else if(['call','callvirt','newobj'].includes(op)){const m=tokens.get(i.operand),argc=m.signature.parameters.length;lines.push(`argv=s.splice(s.length-${argc},${argc});`);const expression=cooperative?(op==='newobj'?`(yield* C.constructSteps($co,$budget,${i.operand},argv))`:`(yield* C.callSteps($co,$budget,${i.operand},${m.signature.hasThis?'s.pop()':'null'},argv,${op==='callvirt'}))`):(op==='newobj'?`C.construct(${i.operand},argv)`:`C.call(${i.operand},${m.signature.hasThis?'s.pop()':'null'},argv,${op==='callvirt'})`);if(op==='newobj'||m.signature.returnType!=='void')push(expression);else lines.push(expression+';');}
    else if(['ldfld','ldsfld'].includes(op))push(cooperative?`(yield* C.fieldSteps($co,$budget,${i.operand},${op==='ldfld'?'s.pop()':'null'}))`:`C.field(${i.operand},${op==='ldfld'?'s.pop()':'null'})`);
    else if(['stfld','stsfld'].includes(op))lines.push(cooperative?`v=s.pop();yield* C.fieldSteps($co,$budget,${i.operand},${op==='stfld'?'s.pop()':'null'},v,true);`:`v=s.pop();C.field(${i.operand},${op==='stfld'?'s.pop()':'null'},v,true);`);
    else if(op==='newarr'){const primitive={Int32:'i4',UInt32:'i4',Int64:'i8',UInt64:'i8',Byte:'i4',SByte:'i4',Int16:'i4',UInt16:'i4',Boolean:'i4',Char:'i4',Single:'f',Double:'f'};push(`C.array(${j(type.assembly&&['System.Runtime','mscorlib','System.Private.CoreLib','netstandard'].includes(type.assembly)?primitive[type.name.split('.').at(-1)]??'ref':'ref')},s.pop()${cooperative?',$budget,$co':''})`);}
    else if(op==='ldlen')push('C.D.length(s.pop())|0');
    else if(op.startsWith('ldelem.')){lines.push('b=s.pop();a=s.pop();');const value='C.D.getIndex(a,b)',convert={'ldelem.i1':`(${value})<<24>>24`,'ldelem.u1':`(${value})&255`,'ldelem.i2':`(${value})<<16>>16`,'ldelem.u2':`(${value})&65535`,'ldelem.i4':`(${value})|0`,'ldelem.u4':`(${value})|0`,'ldelem.r4':`Math.fround(${value})`};push(convert[op]??value);}
    else if(op.startsWith('stelem.')){lines.push('v=s.pop();b=s.pop();a=s.pop();');const conv={'stelem.i1':'v<<24>>24','stelem.i2':'v<<16>>16','stelem.i4':'v|0','stelem.r4':'Math.fround(v)'};lines.push(`C.D.setIndex(a,b,${conv[op]??'v'});`);}
    else if(op.startsWith('conv.'))push(`C.convert(${j(op.slice(5))},s.pop(),${j(type)})`);
    else if(op==='ret'){lines.push(method.signature.returnType==='void'?'return;':`return C.coerce(${j(method.signature.returnType)},s.pop());`);currentBlock=null;}
    else if(op==='throw'){lines.push('throw s.pop()??new C.D.NullReferenceException();');currentBlock=null;}
    else if(!['nop','break'].includes(op))throw new Error('Emitter has no implementation for '+op);
  }
  lines.push('default:throw new Error("Invalid emitted block");',eh?' }}catch(error){action=eh.raise(error,pc);} if(action.kind==="throw")throw action.error;if(action.kind==="cancel")return;pc=action.target;s.length=0;if(action.kind==="catch")s.push(action.error);}}':'}}}');
  if(cooperative&&eh)lines.push('try{const value=yield* body();settled=true;return value;}catch(error){settled=true;throw error;}finally{if(!settled){const action=eh.cancel(pc);if(action.kind==="goto"){pc=action.target;s.length=0;yield* body();}}}}');
  return lines.join('\n');
  function blockCost(start){let end=start+1;while(end<instructions.length&&!leaders.has(instructions[end].offset))end++;return end-start;}
}
