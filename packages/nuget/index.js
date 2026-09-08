import { readZip } from './zip.js';
import { parseXml } from '../compiler-core/xml.js';
import { compileDebugAssemblies } from '../msil-compiler/debug.js';
export { readZip, crc32 } from './zip.js';
const local=n=>n.tag?.split(':').at(-1),children=n=>n?.children?.filter(c=>c.kind==='element')??[],text=n=>n?.children?.filter(c=>c.kind==='text').map(c=>c.text).join('').trim()??'';
const one=(n,name)=>children(n).find(c=>local(c)===name);
export function normalizeFramework(value){return String(value??'').toLowerCase().replace(/^\.netstandard(?:,version=v)?/,'netstandard').replace(/^\.netcoreapp(?:,version=v)?/,'netcoreapp').replace(/^\.netframework(?:,version=v)?([\d.]+)$/,(_,v)=>'net'+v.replaceAll('.',''));}
function versionParts(v){const m=/^(\d+)\.(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(v);return m?m.slice(1).map(x=>Number(x??0)):null;}
function compare(a,b){const av=versionParts(a),bv=versionParts(b);if(!av||!bv)throw new Error('Prerelease/floating dependency versions require a NuGet resolver');for(let i=0;i<4;i++)if(av[i]!==bv[i])return av[i]<bv[i]?-1:1;return 0;}
export function satisfiesVersion(version,range){if(!range)return true;const exact=/^\[([^,]+)\]$/.exec(range);if(exact)return compare(version,exact[1])===0;const bounds=/^([[(])\s*([^,]*)\s*,\s*([^,]*)\s*([)\]])$/.exec(range);if(bounds){const [,l,lo,hi,h]=bounds;return (!lo||(l==='['?compare(version,lo)>=0:compare(version,lo)>0))&&(!hi||(h===']'?compare(version,hi)<=0:compare(version,hi)<0));}return compare(version,range)>=0;}
export async function inspectNuget(input,{path='package.nupkg',...options}={}){
  const zip=readZip(input,options),manifests=[...zip.entries.keys()].filter(n=>!n.includes('/')&&n.toLowerCase().endsWith('.nuspec'));if(manifests.length!==1)throw new Error('Package must contain exactly one root .nuspec');
  const raw=new TextDecoder('utf-8',{fatal:true}).decode(await zip.read(manifests[0])),parsed=parseXml(raw,manifests[0]);if(parsed.diagnostics.some(d=>d.severity==='error'))throw new Error('Invalid NuGet manifest: '+parsed.diagnostics[0].message);if(local(parsed.root)!=='package')throw new Error('Expected NuGet package manifest');const metadata=one(parsed.root,'metadata');if(!metadata)throw new Error('NuGet metadata missing');
  const id=text(one(metadata,'id')),version=text(one(metadata,'version'));if(!/^[A-Za-z0-9_.-]+$/.test(id)||!version)throw new Error('Invalid NuGet package identity');
  const frameworks=new Map();for(const entry of zip.entries.values()){const m=/^lib\/([^/]+)\/([^/]+\.dll)$/i.exec(entry.name);if(m){const tfm=normalizeFramework(m[1]);if(!frameworks.has(tfm))frameworks.set(tfm,[]);frameworks.get(tfm).push(entry.name);}}
  const deps=one(metadata,'dependencies'),dependencyGroups=[];for(const node of children(deps)){
    if(local(node)==='dependency')dependencyGroups.push({framework:'',dependencies:[{id:node.attributes.id,version:node.attributes.version??''}]});
    else if(local(node)==='group')dependencyGroups.push({framework:normalizeFramework(node.attributes.targetFramework),dependencies:children(node).filter(c=>local(c)==='dependency').map(c=>({id:c.attributes.id,version:c.attributes.version??''}))});
  }
  const licenseNode=one(metadata,'license'),license={type:licenseNode?.attributes.type??'unknown',value:text(licenseNode)||text(one(metadata,'licenseUrl'))};
  const report={path,id,version,authors:text(one(metadata,'authors')),description:text(one(metadata,'description')),license,frameworks:Object.fromEntries([...frameworks].map(([k,v])=>[k,v.sort()])),dependencyGroups,
    ignoredAssets:[...zip.entries.keys()].filter(n=>/^(?:ref|runtimes|analyzers|build|buildTransitive|tools|contentFiles)\//i.test(n)),signed:zip.entries.has('.signature.p7s'),entries:[...zip.entries.values()].map(({dataOffset,crc,...e})=>e),compressedBytes:zip.compressedBytes,expandedBytes:zip.expandedBytes};
  return {report,zip};
}
/** Convert a supplied package set. Exact lib/<tfm> selection; no hidden restore or nearest-TFM guessing. */
export async function convertNuget(input,options={}){return convertNugetPackages([{bytes:input,path:options.path??'package.nupkg',targetFramework:options.targetFramework}],options);}
export async function convertNugetPackages(inputs,options={}){
  const diagnostics=[],packages=[],assemblyInputs=[];const diag=(message,path,code='JB6303',severity='error')=>diagnostics.push({code,severity,message,file:path,line:1,column:1,offset:0});
  for(const input of inputs){try{const {report,zip}=await inspectNuget(input.bytes,{...options,path:input.path}),available=Object.keys(report.frameworks),target=normalizeFramework(input.targetFramework??options.targetFramework??(available.length===1?available[0]:''));
    report.selectedFramework=target;report.selectedFiles=report.frameworks[target]??[];packages.push(report);
    if(!target||!report.selectedFiles.length){diag(available.length?`Choose an exact implementation framework: ${available.join(', ')}`:'No executable lib/<tfm> DLLs; ref/, runtime-specific and native assets are not implementation substitutes',input.path);continue;}
    report.dependencies=report.dependencyGroups.filter(g=>!g.framework||g.framework===target).flatMap(g=>g.dependencies);
    for(const file of report.selectedFiles){const pdbPath=file.replace(/\.dll$/i,'.pdb');assemblyInputs.push({bytes:await zip.read(file),pdb:options.debug&&zip.entries.has(pdbPath)?await zip.read(pdbPath):undefined,path:report.id+'/'+file});}
    if(report.ignoredAssets.length)diag('Build tasks, analyzers, native/runtime-specific and ref assets are inventoried but not executed or converted',input.path,'JB6304','warning');
    if(report.signed)diag('Package signature is not verified; CRC checks detect corruption, not publisher authenticity',input.path,'JB6304','warning');
  }catch(e){diag(e.message,input.path,e.code??'JB6301');}}
  const identities=new Set();for(const pkg of packages){const id=pkg.id.toLowerCase();if(identities.has(id))diag('Multiple versions/duplicates of package '+pkg.id,pkg.path);identities.add(id);for(const dep of pkg.dependencies??[]){const found=packages.find(p=>p.id.toLowerCase()===dep.id?.toLowerCase());if(!found)diag(`Supply dependency ${dep.id} ${dep.version}; automatic NuGet restore is not implemented`,pkg.path);else try{if(!satisfiesVersion(found.version,dep.version))diag(`Dependency version mismatch for ${dep.id}`,pkg.path);}catch(e){diag(e.message,pkg.path);}}}
  const compiled=await compileDebugAssemblies(assemblyInputs,options);diagnostics.push(...compiled.diagnostics);const success=compiled.success&&!diagnostics.some(d=>d.severity==='error');return {...compiled,success,code:success?compiled.code:'',diagnostics,packages};
}
