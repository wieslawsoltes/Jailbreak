import { resolveExceptionType } from '../dotnet-runtime/exceptions.js';
import { parseIL } from './text.js';
export { parseIL } from './text.js';
import { readAssembly } from '../managed-pe/structured.js';
import { escapeJs } from '../compiler-core/index.js';
import { verifyMethod } from './verification.js';
import { emitMethod } from './emitter.js';
import { stackType, typeName } from '../compiler-core/managed-types.js';
import { disassemble } from './instruction-set.js';
import { methodKey, resolveAdapter } from '../msil-runtime/adapters.js';
export { readAssembly } from '../managed-pe/structured.js';
export { decodeIL, disassemble } from './instruction-set.js';
export { verifyMethod } from './verification.js';
export function compileAssembly(input,options={}){return compileAssemblies([{bytes:input,path:options.path??'assembly.dll'}],options);}
/** Strict whole-assembly conversion; failure returns no executable output, not stubbed methods. */
export function compileAssemblies(inputs,options={}){
  const diagnostics=[],assemblies=[],compiled=[];const start=performance.now();
  const diagnostic=(e,path,method=null)=>({code:e.code??'JB6100',severity:'error',message:e.message,file:path,line:1,column:1,offset:method?(method.body?.codeOffset??0)+(Number(e.offset)||0):Number(e.offset)||0,...(method?{method:method.owner+'::'+method.name,token:method.token,ilOffset:Number(e.offset)||0}:{})});
  if(!inputs.length)diagnostics.push(diagnostic(new Error('At least one managed assembly is required'),'workspace'));
  for(const input of inputs){try{assemblies.push(input.assembly??readAssembly(input.bytes,{...options,path:input.path}));}catch(e){diagnostics.push(diagnostic(e,input.path));}}
  const names=new Set();for(const a of assemblies){if(names.has(a.name))diagnostics.push(diagnostic(new Error('Duplicate assembly identity '+a.name),a.path));names.add(a.name);}
  for(const a of assemblies){
    const fail=message=>diagnostics.push(diagnostic(Object.assign(new Error(message),{code:'JB6104'}),a.path));
    if(!(a.cliFlags&1)||(a.cliFlags&16)||a.nativeHeader)fail('Mixed/native/ReadyToRun images cannot be compiled as pure MSIL');
    for(const [feature,present]of Object.entries(a.features??{}))if(present)fail('Unsupported assembly feature: '+feature);
    const typeNames=new Set();for(const t of a.types){if(typeNames.has(t.name))fail('Duplicate type '+t.name);typeNames.add(t.name);}
    const signatures=new Set();for(const m of a.methods){const key=methodKey(m);if(signatures.has(key))fail('Duplicate method signature '+key);signatures.add(key);}
    for(const f of a.fields)if(!['i4','i8','f','ref'].includes(stackType(f.type)))fail('Unsupported field type '+typeName(f.type));
    for(const t of a.types)if(t.base&&!(t.base.name==='System.Object'&&['System.Runtime','System.Private.CoreLib','mscorlib','netstandard'].includes(t.base.assembly))&&!assemblies.some(x=>x.name===t.base.assembly&&x.types.some(y=>y.name===t.base.name)))fail(`Unsupported/unresolved base type ${t.base.name}`);
    const methods=[];
    for(const m of a.methods){try{const verified=verifyMethod(a,m,options);for(const c of verified.regions.clauses)if(c.kind==='catch'&&!resolveExceptionType(c.catchType)&&!(c.catchType.name==='System.Object'&&['System.Runtime','mscorlib','System.Private.CoreLib','netstandard'].includes(c.catchType.assembly)))throw new Error('Unsupported catch type '+c.catchType.name);for(const token of verified.calls){const ref=[...a.methods,...a.members].find(x=>x.token===token);if(!resolveAdapter(ref)&&!assemblies.some(x=>x.name===ref.assembly&&x.methods.some(y=>methodKey(y)===methodKey(ref))))throw new Error(`No linked method or runtime adapter for [${ref.assembly}]${methodKey(ref)}`);}for(const token of verified.fields){const ref=[...a.fields,...a.members].find(x=>x.token===token);if(!assemblies.some(x=>x.name===ref.assembly&&x.fields.some(f=>f.owner===ref.owner&&f.name===ref.name&&typeName(f.type)===typeName(ref.type))))throw new Error(`Unresolved field [${ref.assembly}]${ref.owner}::${ref.name}`);}methods.push({method:m,code:emitMethod(a,m,verified),instructions:verified.instructions,peak:verified.peak,exceptionClauses:verified.regions.clauses});}catch(e){const d=diagnostic(e,a.path,m);if(a.source){const at=m.instructions?.find(i=>i.offset===(Number(e.offset)||0))?.sourceOffset??m.body?.offset??0;Object.assign(d,a.source.location(at));}diagnostics.push(d);}}
    const descriptor={format:'msil-js-v1',name:a.name,version:a.version,types:a.types,fields:a.fields,members:a.members,methods:a.methods.map(({body,...m})=>{const {instructions,...rest}=m;return rest;}),references:a.references};
    const code=`MS.register(${escapeJs(descriptor)}, C => ({\n${methods.map(m=>`${m.method.token}: ${m.code}`).join(',\n')}\n}));`;
    compiled.push({name:a.name,descriptor,code,methods:methods.map(x=>({token:x.method.token,name:x.method.name,owner:x.method.owner,signature:x.method.signature,static:x.method.static,public:(x.method.flags&7)===6,disassembly:disassemble({...x.method,instructions:x.instructions}),maxStack:x.peak,exceptionClauses:x.exceptionClauses})),references:a.references,resources:a.resources??[],tables:a.tables??{}});
  }
  const success=diagnostics.length===0&&assemblies.length>0;return {success,diagnostics,code:success?compiled.map(c=>c.code).join('\n'):'',assemblies:compiled.map(({code,...rest})=>rest),stats:{milliseconds:performance.now()-start,assemblies:assemblies.length,methods:compiled.reduce((n,a)=>n+a.methods.length,0)}};
}

export function compileIL(text,options={}){try{return compileAssemblies([{assembly:parseIL(text,options),path:options.path??'source.il'}],options);}catch(e){return {success:false,code:'',assemblies:[],diagnostics:[{code:e.code??'JB6201',severity:'error',message:e.message,file:options.path??'source.il',line:1,column:1,offset:e.offset??0,...e.location}],stats:{assemblies:0,methods:0,milliseconds:0}};}}
