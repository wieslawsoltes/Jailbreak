import { compileProject } from '../project-system/index.js';
import { compileBinaryProject, compileNugetProject } from './index.js';
export function encodeBinaryFile(name,bytes){if(bytes.byteLength>32*1024*1024)throw new Error('Binary file exceeds 32 MiB');const kind=/\.nupkg$/i.test(name)?'nuget':/\.(dll|exe)$/i.test(name)?'dll':null;if(!kind)throw new Error('Expected managed DLL/EXE or nupkg');let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return JSON.stringify({format:'jailbreak-binary-v1',name,kind,base64:btoa(binary)});}
export function decodeBinaryRecord(text,path='library.binary.json'){
  const record=JSON.parse(text);if(record.format!=='jailbreak-binary-v1'||!['dll','nuget'].includes(record.kind)||typeof record.base64!=='string'||record.base64.length>45*1024*1024)throw new Error('Invalid/oversized binary workspace record '+path);
  const value=atob(record.base64),bytes=Uint8Array.from(value,c=>c.charCodeAt(0));return {path:record.name??path,bytes,kind:record.kind,targetFramework:record.targetFramework};
}
/** One source workbench entry point; imported binary records round-trip as local JSON text. */
export async function compileWorkspaceInputs(files,options={}){
  const source=files instanceof Map?Object.fromEntries(files):files,libraries=Object.entries(source).filter(([name])=>name.endsWith('.binary.json')).map(([path,text])=>decodeBinaryRecord(text,path));
  if(!libraries.length)return compileProject(source,options);
  const kinds=new Set(libraries.map(l=>l.kind));if(kinds.size!==1)throw new Error('Mixed loose DLL and nupkg workspace imports require an explicit linked package set; load one input kind per source workspace');
  return kinds.has('nuget')?compileNugetProject(source,libraries,options):compileBinaryProject(source,libraries,options);
}
