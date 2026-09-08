import { compileProject } from '../project-system/index.js';
import { compileAssemblies } from '../msil-compiler/verified.js';
import {compileBinaryInputs} from '../msil-compiler/debug.js';
import { convertNugetPackages } from '../nuget/index.js';
/** Link binary library registrations before emitted source classes and XAML code-behind. */
export function linkBinaryCompilation(files,binary,options={}){
  const externalTypes=(binary.assemblies??[]).flatMap(a=>a.descriptor.types.filter(t=>t.name!=='<Module>').map(t=>t.name));
  const source=compileProject(files,{...options,externalTypes}),diagnostics=[...binary.diagnostics,...source.diagnostics];
  if(new Set(externalTypes).size!==externalTypes.length)diagnostics.push({code:'JB6401',severity:'error',message:'Multiple binary assemblies export the same full type name; the source bridge requires an unambiguous type registry',file:'workspace',line:1,column:1,offset:0});
  const success=binary.success&&source.success&&!diagnostics.some(d=>d.severity==='error');
  const prefix=`(function(MS){\n${binary.code}\n})(JB.binary);\nJB.binary.exportTo(JB);\n`;
  const debug=options.debug?{...source.debug,sites:[...(source.debug?.sites??[]),...(binary.debug?.sites??[])],sources:binary.debug?.sources??{}}:undefined;
  return {...source,success,debug,code:success?prefix+source.code:'',diagnostics,binaries:binary.assemblies,packages:binary.packages??[],manifest:{...source.manifest,binaryAssemblies:binary.assemblies.map(a=>({name:a.name,version:a.descriptor.version}))}};
}
export function compileBinaryProject(files,assemblies,options={}){if(options.debug)return compileBinaryInputs(assemblies,options).then(binary=>linkBinaryCompilation(files,binary,options));return linkBinaryCompilation(files,compileAssemblies(assemblies,options),options);}
export async function compileNugetProject(files,packages,options={}){return linkBinaryCompilation(files,await convertNugetPackages(packages,options),options);}
