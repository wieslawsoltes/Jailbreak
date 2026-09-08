import { verifyExceptionRegions } from './exception-regions.js';
import { BinaryError } from '../managed-pe/reader.js';
import { stackType } from '../compiler-core/managed-types.js';
import { decodeIL, byName } from './instruction-set.js';
export function argumentIndex(i){return /\.[0-3]$/.test(i.name)?Number(i.name.at(-1)):i.operand;}
export function baseOpcode(name){return name.endsWith('.s')?name.slice(0,-2):name;}
const binary=new Set('add sub mul div div.un rem rem.un and or xor shl shr shr.un'.split(' '));
const compares=new Set('ceq cgt cgt.un clt clt.un beq bge bgt ble blt bne.un bge.un bgt.un ble.un blt.un'.split(' '));
export function verifyMethod(assembly,method,{maxInstructions=100000}={}){
  const error=(message,i={offset:0},code='JB6103')=>{throw new BinaryError(message,i.offset,code);};
  if(!method.body)error('Method has no managed IL body');
  if(!Number.isInteger(method.body.maxStack)||method.body.maxStack<0||method.body.maxStack>65535)error('maxstack must be an unsigned 16-bit integer');
  
  if(method.body.locals.length&&!method.body.initLocals)error('Uninitialized local-variable analysis is not yet supported',undefined,'JB6104');
  if(method.signature.genericArity||method.signature.explicitThis||method.signature.callingConvention!==0)error('Generic, explicit-this or vararg methods are unsupported',undefined,'JB6104');
  if(method.static===method.signature.hasThis)error('Static flag disagrees with method signature');
  if(method.implFlags&0x1007||method.flags&0x2000)error('Native, runtime-supplied, internal-call and P/Invoke methods are unsupported',undefined,'JB6104');
  const supportedType=t=>{if(t?.kind==='array')return t.rank===1&&!t.sizes&&supportedType(t.element);return ['i4','i8','f','ref','void'].includes(stackType(t));};
  for(const t of [...method.signature.parameters,...method.body.locals])if(t==='void')error('Arguments and locals cannot be void');
  for(const t of [method.signature.returnType,...method.signature.parameters,...method.body.locals])if(!supportedType(t))error('Unsupported signature type '+JSON.stringify(t),undefined,'JB6104');
  if(method.instructions?.length>maxInstructions)error('Instruction budget exceeded');
  const instructions=method.instructions??decodeIL(method.body.code,{maxInstructions}),byOffset=new Map(instructions.map(i=>[i.offset,i]));if(!instructions.length)error('Empty method body');
  // Caller-supplied parsed models receive the same numeric instruction boundary
  // validation as byte/text frontends; no raw operand can reach JS interpolation.
  let expectedOffset=0;
  for(const i of instructions){
    if(!Number.isSafeInteger(i.offset)||i.offset!==expectedOffset||!Number.isSafeInteger(i.next)||i.next<=i.offset)error('Invalid/noncontiguous instruction offsets',i);
    expectedOffset=i.next;const definition=byName.get(i.name);
    if(!definition)error('Unknown instruction name',i);
    const kind=definition.operand,value=i.operand;
    if(kind==='switch'){if(!Array.isArray(value)||value.length>65536||value.some(n=>!Number.isSafeInteger(n)||!byOffset.has(n)))error('Invalid switch operand',i);}
    else if(kind.startsWith('branch')){if(!Number.isSafeInteger(value)||!byOffset.has(value))error('Invalid branch operand',i);}
    else if(['u8','i8','u16','i32','token'].includes(kind)){
      const [min,max]={u8:[0,255],i8:[-128,127],u16:[0,65535],i32:[-2147483648,2147483647],token:[0,4294967295]}[kind];
      if(!Number.isInteger(value)||value<min||value>max)error('Invalid integer instruction operand',i);
    }else if(kind==='i64'&&(typeof value!=='bigint'||value<-(1n<<63n)||value>=(1n<<63n)))error('Invalid Int64 instruction operand',i);
    else if(['f32','f64'].includes(kind)&&typeof value!=='number')error('Invalid floating instruction operand',i);
  }
  const regions=verifyExceptionRegions(method,instructions);
  const args=[...(method.static?[]:['ref']),...method.signature.parameters.map(stackType)],locals=method.body.locals.map(stackType),tokens=new Map([...assembly.methods,...assembly.members,...assembly.fields].map(m=>[m.token,m]));
  const states=new Map(),pending=[{offset:instructions[0].offset,stack:[]}],calls=new Set(),fieldRefs=new Set(),types=new Map();let peak=0;
  function target(offset,stack){if(stack.length>method.body.maxStack)error('Declared maxstack is too small',{offset});peak=Math.max(peak,stack.length);const old=states.get(offset);if(old){if(old.length!==stack.length||old.some((t,n)=>t!==stack[n]))error('Incompatible evaluation stacks at control-flow join',{offset});return;}if(!byOffset.has(offset))error('Control flow falls outside method',{offset});states.set(offset,[...stack]);pending.push({offset,stack:[...stack]});}
  // Use target for every edge, including method entry.
  pending.length=0;target(instructions[0].offset,[]);
  for(const c of regions.clauses)target(c.handlerOffset,c.kind==='catch'?['ref']:[]);
  for(let cursor=0;cursor<pending.length;cursor++){
    const {offset,stack}=pending[cursor],i=byOffset.get(offset),op=baseOpcode(i.name);let branch=false,terminal=false;
    const pop=expected=>{if(!stack.length)error('Evaluation stack underflow',i);const type=stack.pop();if(expected&&type!==expected)error(`Stack type mismatch: expected ${expected}, got ${type}`,i);return type;};
    const edge=(to,kind='branch',value=stack)=>{regions.checkEdge(offset,to,kind,value);target(to,value);};
    const push=type=>{if(type!=='void')stack.push(type);peak=Math.max(peak,stack.length);if(peak>method.body.maxStack)error('Declared maxstack is too small',i);};
    const member=()=>{const m=tokens.get(i.operand);if(!m)error('Invalid member token 0x'+i.operand.toString(16),i);return m;};
    if(/^ldarg(?:\.|$)/.test(op)){const n=argumentIndex(i);if(n<0||n>=args.length)error('Argument index outside signature',i);push(args[n]);}
    else if(op==='starg'){const n=argumentIndex(i);if(n<0||n>=args.length)error('Argument index outside signature',i);pop(args[n]);}
    else if(/^ldloc(?:\.|$)/.test(op)){const n=argumentIndex(i);if(n<0||n>=locals.length)error('Local index outside signature',i);push(locals[n]);}
    else if(/^stloc(?:\.|$)/.test(op)){const n=argumentIndex(i);if(n<0||n>=locals.length)error('Local index outside signature',i);pop(locals[n]);}
    else if(op.startsWith('ldc.i4'))push('i4');else if(op==='ldc.i8')push('i8');else if(op==='ldc.r4'||op==='ldc.r8')push('f');
    else if(op==='ldnull')push('ref');else if(op==='ldstr'){assembly.userStrings[i.operand]??=assembly.readUserString(i.operand);push('ref');}
    else if(op==='dup'){const type=pop();push(type);push(type);}else if(op==='pop')pop();
    else if(binary.has(op)){const b=pop(),a=pop();if(op.startsWith('sh')){if(!['i4','i8'].includes(a)||b!=='i4')error('Invalid shift operand types',i);}else if(a!==b||!['i4','i8','f'].includes(a)||(['and','or','xor','div.un','rem.un'].includes(op)&&a==='f'))error('Invalid numeric operand types',i);types.set(offset,a);push(a);}
    else if(/^(add|sub|mul)\.ovf(\.un)?$/.test(op)){const b=pop(),a=pop();if(a!==b||!['i4','i8'].includes(a))error('Checked arithmetic requires matching integer operands',i);types.set(offset,a);push(a);}
    else if(/^conv\.ovf\.[iu][1248](\.un)?$/.test(op)){const from=pop();if(!['i4','i8','f'].includes(from))error('Checked conversion requires numeric operands',i);types.set(offset,from);push(/\.[iu]8/.test(op)?'i8':'i4');}
    else if(op==='neg'||op==='not'){const type=pop();if(!['i4','i8','f'].includes(type)||(op==='not'&&type==='f'))error('Invalid unary operand',i);types.set(offset,type);push(type);}
    else if(compares.has(op)){const b=pop(),a=pop();if(a!==b||!['i4','i8','f','ref'].includes(a)||(a==='ref'&&!['ceq','beq','bne.un','cgt.un'].includes(op)))error('Invalid comparison operands',i);types.set(offset,a);if(op.startsWith('b')){edge(i.operand);branch=true;}else push('i4');}
    else if(op==='br'){edge(i.operand);terminal=true;}
    else if(op==='brfalse'||op==='brtrue'){const type=pop();if(!['i4','i8','ref'].includes(type))error('Invalid branch condition',i);edge(i.operand);branch=true;}
    else if(op==='switch'){pop('i4');for(const to of i.operand)edge(to);branch=true;}
    else if(['call','callvirt','newobj'].includes(op)){const m=member();if(!m.signature||m.kind==='field')error('Call token is not a method',i);if(m.signature.genericArity||m.signature.callingConvention!==0)error('Unsupported call signature',i,'JB6104');for(const p of [...m.signature.parameters].reverse())pop(stackType(p));if(op==='newobj'){if(m.name!=='.ctor'||!m.signature.hasThis)error('newobj requires an instance constructor',i);push('ref');}else {if(m.signature.hasThis)pop('ref');else if(op==='callvirt')error('callvirt requires instance method',i);push(stackType(m.signature.returnType));}calls.add(i.operand);}
    else if(['ldfld','stfld','ldsfld','stsfld'].includes(op)){const f=member();if(!f.type)error('Field token is not a field',i);if(f.static!==undefined&&f.static!==op.includes('sfld'))error('Field staticness mismatch',i);if(op.startsWith('st'))pop(stackType(f.type));if(!op.includes('sfld'))pop('ref');if(op.startsWith('ld'))push(stackType(f.type));fieldRefs.add(i.operand);}
    else if(op==='newarr'){pop('i4');const t=assembly.resolveType(i.operand);if(!t)error('Invalid array element token',i);types.set(offset,t);push('ref');}
    else if(op==='ldlen'){pop('ref');push('i4');}
    else if(/^ldelem\.(i1|u1|i2|u2|i4|u4|i8|r4|r8|ref)$/.test(op)){pop('i4');pop('ref');push(op.endsWith('ref')?'ref':op.endsWith('i8')?'i8':/r[48]$/.test(op)?'f':'i4');}
    else if(/^stelem\.(i1|i2|i4|i8|r4|r8|ref)$/.test(op)){pop(op.endsWith('ref')?'ref':op.endsWith('i8')?'i8':/r[48]$/.test(op)?'f':'i4');pop('i4');pop('ref');}
    else if(/^conv\.(i1|u1|i2|u2|i4|u4|i8|u8|r4|r8|r.un)$/.test(op)){const from=pop();if(!['i4','i8','f'].includes(from))error('Conversion requires numeric value',i);types.set(offset,from);push(/\.(i8|u8)$/.test(op)?'i8':op.includes('.r')?'f':'i4');}
    else if(op==='leave'){regions.checkEdge(offset,i.operand,'leave');target(i.operand,[]);terminal=true;}
    else if(op==='endfinally'||op==='rethrow'){regions.checkTerminal(offset,op,stack);terminal=true;}
    else if(op==='ret'){regions.checkTerminal(offset,op,stack);const ret=stackType(method.signature.returnType);if(ret!=='void')pop(ret);if(stack.length)error('Nonempty stack at return',i);terminal=true;}
    else if(op==='throw'){pop('ref');terminal=true;}
    else if(!['nop','break'].includes(op))error('Unsupported IL opcode '+i.name,i,'JB6104');
    if(!terminal)edge(i.next,'fallthrough');
  }
  // Unsupported opcodes in dead blocks are still errors; never hide unsupported native capabilities.
  for(const i of instructions)if(!states.has(i.offset))error('Unreachable IL requires an explicit reachability policy',i,'JB6104');
  return {instructions,states,types,regions,calls:[...calls],fields:[...fieldRefs],peak};
}
