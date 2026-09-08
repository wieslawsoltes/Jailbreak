import {prepareDebugAssembly} from '../portable-pdb/symbols.js';
import {compileAssemblies} from './verified.js';
const failure=error=>({success:false,code:'',assemblies:[],diagnostics:[{code:error.code??'JB6500',severity:'error',message:error.message,file:error.file??'symbols',line:1,column:1,offset:error.offset??0}],stats:{assemblies:0,methods:0,milliseconds:0}});
/** Async symbol preparation precedes the same synchronous, whole-assembly IL verifier. */
export async function compileDebugAssemblies(inputs,options={}){
  if(!options.debug)return compileAssemblies(inputs,options);
  try{const prepared=[];
    for(const input of inputs)prepared.push(input.assembly?input:{assembly:await prepareDebugAssembly(input,{...options,sources:input.sources??options.sources??{}}),path:input.path});
    return compileAssemblies(prepared,options);
  }catch(error){return failure(error);}
}
/** Paths identify supplied records only; this API performs no network or filesystem reads. */
export async function compileBinaryInputs(inputs,options={}){
  const sources={...options.sources},assemblies=[],pdbs=new Map();
  const key=path=>String(path).replace(/\\/g,'/').replace(/\.(?:dll|exe|pdb)$/i,'').toLowerCase();
  try{
    for(const input of inputs){
      if(/\.(dll|exe)$/i.test(input.path))assemblies.push(input);
      else if(/\.pdb$/i.test(input.path)){const k=key(input.path);if(pdbs.has(k))throw new Error('Duplicate symbol file '+input.path);pdbs.set(k,input.bytes);}
      else if(/\.cs$/i.test(input.path)){if(Object.hasOwn(sources,input.path))throw new Error('Duplicate source file '+input.path);sources[input.path]=input.text??input.bytes;}
      else throw new Error('Expected DLL/EXE, adjacent PDB or checksum-verified C# source');
    }
    for(const k of pdbs.keys())if(!assemblies.some(a=>key(a.path)===k))throw new Error('Symbol file has no adjacent assembly: '+k);
    return await compileDebugAssemblies(assemblies.map(a=>({...a,pdb:a.pdb??pdbs.get(key(a.path)),sources})),options);
  }catch(error){return failure(error);}
}
