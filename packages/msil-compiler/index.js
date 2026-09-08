import { readAssembly, binaryDiagnostic, BinaryError } from '../managed-pe/index.js';
import { escapeJs } from '../compiler-core/index.js';
import { decodeIL } from './opcodes.js';
import { linkAssemblies, category } from './linker.js';
import { verifyMethod } from './verify.js';
export { readAssembly } from '../managed-pe/index.js';
export { decodeIL } from './opcodes.js';
export { verifyMethod } from './verify.js';
const q=escapeJs;
const numericLiteral=n=>Number.isNaN(n)?'NaN':n===Infinity?'Infinity':n===-Infinity?'-Infinity':Object.is(n,-0)?'-0':String(n);

/** Ahead-of-time stack-slot/basic-block backend: emitted functions contain no IL decoder. */
function emitMethod(a,m,ins,verified) {
  const {states,leaders,references}=verified,lines=[];let max=0;
  const slot=n=>'s'+n;
  const branchCompare=(op,a,b,type)=>{
    const unsigned=op.endsWith('.un');op=op.replace(/\.un$/,'');
    const operator={beq:'===',bne:'!==',bge:'>=',bgt:'>',ble:'<=',blt:'<',ceq:'===',cgt:'>',clt:'<'}[op];
    if(unsigned&&type==='i4'){a=`(${a}>>>0)`;b=`(${b}>>>0)`;}
    const compare=`(${a}${operator}${b})`;
    return unsigned&&type==='f'?`(Number.isNaN(${a})||Number.isNaN(${b})||${compare})`:compare;
  };
  for(const i of ins){if(!states.has(i.offset))continue;const before=states.get(i.offset),d=before.length,op=i.op,v=slot(d-1),a1=slot(d-2),a2=v;max=Math.max(max,d+2);
    if(leaders.has(i.offset))lines.push(`case ${i.offset}:`);
    let code='';
    if(op==='ldarg'||op==='ldloc')code=`${slot(d)}=${op==='ldarg'?'a':'l'}[${i.index}];`;
    else if(op==='starg'||op==='stloc')code=`${op==='starg'?'a':'l'}[${i.index}]=${v};`;
    else if(op==='ldnull')code=`${slot(d)}=null;`;
    else if(op==='ldstr')code=`${slot(d)}=${q(a.userStrings[i.operand])};`;
    else if(op.startsWith('ldc.'))code=`${slot(d)}=${numericLiteral(i.operand)};`;
    else if(op==='dup')code=`${slot(d)}=${v};`;
    else if(['add','sub','mul','div','rem'].includes(op)){const f={add:'iadd',sub:'isub',mul:'imul',div:'idiv',rem:'irem'}[op],js={add:'+',sub:'-',mul:'*',div:'/',rem:'%'}[op];code=`${a1}=${before[d-1]==='i4'?`JB.${f}(${a1},${a2})`:`(${a1}${js}${a2})`};`;}
    else if(op==='div.un'||op==='rem.un')code=`${a1}=IL.unsigned(${q(op)},${a1},${a2});`;
    else if(['and','or','xor','shl','shr','shr.un'].includes(op))code=`${a1}=(${a1}${{and:'&',or:'|',xor:'^',shl:'<<',shr:'>>','shr.un':'>>>'}[op]}${a2});`;
    else if(op==='neg'||op==='not')code=`${v}=${op==='not'?'~'+v:before[d-1]==='i4'?`(-${v})|0`:'-'+v};`;
    else if(op.startsWith('conv.')){const expression={'conv.i1':`(${v}<<24)>>24`,'conv.i2':`(${v}<<16)>>16`,'conv.i4':`JB.toInt(${v})`,'conv.u4':`${v}>>>0`,'conv.i':`JB.toInt(${v})`,'conv.u':`${v}>>>0`,'conv.r4':`Math.fround(${v})`,'conv.r8':`Number(${v})`}[op];code=`${v}=${expression};`;}
    else if(['ceq','cgt','cgt.un','clt','clt.un'].includes(op))code=`${a1}=Number(${branchCompare(op,a1,a2,before[d-1])});`;
    else if(['call','callvirt','newobj'].includes(op)){const ref=references.get(i.offset),n=ref.signature.parameters.length+(ref.signature.hasThis&&op!=='newobj'?1:0),args=Array.from({length:n},(_,k)=>slot(d-n+k)).join(',');
      const expr=ref.external?`IL.external(${q(ref.external)},[${args}])`:op==='newobj'?`IL.construct(${q(ref.key)},[${args}])`:`IL.invoke(${q(ref.key)},[${args}],${op==='callvirt'})`;
      code=(op==='newobj'||ref.signature.returnType!=='void'?slot(d-n)+'=':'')+expr+';';
    }
    else if(['ldfld','stfld','ldsfld','stsfld'].includes(op)){const f=references.get(i.offset),stat=op.includes('sfld'),store=op.startsWith('st');code=store?`IL.setField(${q(f.key)},${stat?'null':a1},${v});`:`${slot(stat?d:d-1)}=IL.getField(${q(f.key)},${stat?'null':v});`;}
    else if(op==='newarr'){const t=references.get(i.offset),primitive={'System.Int32':'int32','System.UInt32':'uint32','System.Double':'float64','System.Single':'float32','System.String':'string','System.Object':'object'}[t.name];if(!primitive&&!/^[^<>&*]+$/.test(t.name))throw new BinaryError('Unsupported array element type '+t.name,i.offset);code=`${v}=JB.newArray(${v},${primitive&&category(primitive)!=='ref'?'0':'null'});`;}
    else if(op==='ldlen')code=`${v}=IL.arrayLength(${v});`;
    else if(op.startsWith('ldelem'))code=`${a1}=IL.arrayGet(${a1},${a2});`;
    else if(op.startsWith('stelem'))code=`IL.arraySet(${slot(d-3)},${a1},${op==='stelem.r4'?`Math.fround(${v})`:v});`;
    else if(op==='br')code=`pc=${i.operand};continue;`;
    else if(op==='brtrue'||op==='brfalse')code=`pc=(${v}!==null&&${v}!==0)?${op==='brtrue'?i.operand:i.end}:${op==='brtrue'?i.end:i.operand};continue;`;
    else if(/^b(eq|ge|gt|le|lt|ne)/.test(op))code=`pc=${branchCompare(op,a1,a2,before[d-1])}?${i.operand}:${i.end};continue;`;
    else if(op==='switch')code=`pc=(${v}>=0&&${v}<${i.operand.length})?${q(i.operand)}[${v}]:${i.end};continue;`;
    else if(op==='ret')code=m.signature.returnType==='void'?'return;':`return ${m.signature.returnType==='float32'?`Math.fround(${v})`:v};`;
    else if(op==='throw')code=`throw ${v}??new JB.ArgumentNullException('NullReferenceException');`;
    lines.push(`// IL_${i.offset.toString(16).padStart(4,'0')} ${op}\n${code}`);
  }
  return `function(a){IL.enter();try{const l=[${m.body.locals.map(t=>category(t)==='ref'?'null':'0').join(',')}];let pc=0${Array.from({length:max},(_,i)=>',s'+i).join('')};for(;;){IL.tick();switch(pc){${lines.join('\n')}default:throw new Error('Invalid compiled control flow');}}}finally{IL.leave();}}`;
}
export function compileAssemblies(inputs,options={}) {
  const diagnostics=[],assemblies=[];
  try{
    for(const input of inputs){const model=input?.format==='jailbreak-cli-v1'?input:readAssembly(input.bytes??input,{...options,path:input.path??options.path});assemblies.push(model);}
    const link=linkAssemblies(assemblies),implementations=[],disassembly=[];
    for(const assembly of assemblies)for(const raw of assembly.methods){const m=link.methods.get(assembly.name+'|'+raw.token);
      try{const ins=m.body.instructions??decodeIL(m.body),verified=verifyMethod(assembly,m,ins,link);implementations.push(q(m.key)+':'+emitMethod(assembly,m,ins,verified));disassembly.push({assembly:assembly.name,type:m.owner,method:m.name,token:m.token,signature:m.signature,blocks:verified.leaders.size,instructions:ins});}
      catch(error){const d=binaryDiagnostic(error,assembly.path);d.method=`${m.owner}::${m.name}`;d.token=m.token;d.ilOffset=error.offset||0;diagnostics.push(d);}
    }
    if(diagnostics.length)return {success:false,code:'',diagnostics,disassembly};
    const program={assemblies:assemblies.map(a=>({name:a.name,version:a.version})),types:[...link.types.values()],fields:[...link.fields.values()],methods:[...link.methods.values()].map(({body,...m})=>m)};
    const code=`(function(IL){\nIL.install(${q(program)},{\n${implementations.join(',\n')}\n});\n})(JB.IL);\n`;
    return {success:true,code,diagnostics,disassembly,program,stats:{assemblies:assemblies.length,methods:implementations.length,instructions:disassembly.reduce((n,m)=>n+m.instructions.length,0)}};
  }catch(error){return {success:false,code:'',diagnostics:[...diagnostics,binaryDiagnostic(error,options.path)],disassembly:[]};}
}
export function compileAssembly(bytes,options={}) {return compileAssemblies([{bytes,path:options.path??'assembly.dll'}],options);}
