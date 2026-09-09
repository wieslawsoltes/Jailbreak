import { compileProject } from '../project-system/index.js';
import { compileBinaryProject, compileNugetProject } from './index.js';
const MAX_BINARY_BYTES=32*1024*1024;
function base64(bytes){if(!(bytes instanceof Uint8Array)||bytes.byteLength>MAX_BINARY_BYTES)throw new Error('Binary file exceeds 32 MiB or is not bytes');let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
function decode64(text){if(typeof text!=='string'||text.length>45*1024*1024)throw new Error('Invalid/oversized binary payload');const value=atob(text);if(value.length>MAX_BINARY_BYTES)throw new Error('Binary file exceeds 32 MiB');return Uint8Array.from(value,c=>c.charCodeAt(0));}
/** Optional symbols are data attached to a DLL, never additional source compilation units. */
export function encodeBinaryFile(name,bytes,{pdb,sources}={}){
  const kind=/\.nupkg$/i.test(name)?'nuget':/\.(dll|exe)$/i.test(name)?'dll':null;if(!kind)throw new Error('Expected managed DLL/EXE or nupkg');
  const record={format:'jailbreak-binary-v1',name,kind,base64:base64(bytes)};
  if(pdb!==undefined||sources!==undefined){if(kind!=='dll')throw new Error('Loose symbols attach to DLL/EXE records only');record.symbols={pdb:pdb===undefined?undefined:base64(pdb),sources:sources??{}};}
  const text=JSON.stringify(record);decodeBinaryRecord(text);return text;
}
export function decodeBinaryRecord(text,path='library.binary.json'){
  const record=JSON.parse(text);if(record.format!=='jailbreak-binary-v1'||!['dll','nuget'].includes(record.kind)||typeof record.name!=='string'||!record.name||record.name.length>8192)throw new Error('Invalid binary workspace record '+path);
  const bytes=decode64(record.base64),result={path:record.name,bytes,kind:record.kind,targetFramework:record.targetFramework};
  if(record.symbols!==undefined){
    const symbols=record.symbols;if(record.kind!=='dll'||!symbols||typeof symbols!=='object'||Array.isArray(symbols))throw new Error('Invalid DLL symbol attachment');
    if(symbols.pdb!==undefined)result.pdb=decode64(symbols.pdb);
    const sources=symbols.sources??{};if(!sources||typeof sources!=='object'||Array.isArray(sources))throw new Error('Invalid attached original sources');
    const entries=Object.entries(sources);let total=bytes.length+(result.pdb?.length??0);
    if(entries.length>1000)throw new Error('Too many attached original sources');
    for(const [name,value]of entries){if(!name||name.length>8192||typeof value!=='string'||value.length>4*1024*1024)throw new Error('Invalid attached original source');total+=new TextEncoder().encode(value).length;}
    if(total>MAX_BINARY_BYTES)throw new Error('Binary and symbol attachments exceed 32 MiB');result.sources=sources;
  }
  return result;
}
/** One source workbench entry point; imported binary records round-trip as local JSON text. */
export async function compileWorkspaceInputs(files,options={}){
  const source=files instanceof Map?Object.fromEntries(files):files,libraries=Object.entries(source).filter(([name])=>name.endsWith('.binary.json')).map(([path,text])=>decodeBinaryRecord(text,path));
  if(!libraries.length)return compileProject(source,options);
  const kinds=new Set(libraries.map(l=>l.kind));if(kinds.size!==1)throw new Error('Mixed loose DLL and nupkg workspace imports require an explicit linked package set; load one input kind per source workspace');
  return kinds.has('nuget')?compileNugetProject(source,libraries,options):compileBinaryProject(source,libraries,options);
}
