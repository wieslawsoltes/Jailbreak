import {readAssembly} from '../managed-pe/structured.js';
import {bytesOf} from '../managed-pe/reader.js';
import {readPortablePdb,inflateBounded} from '../portable-pdb/index.js';
import {readNativePdb,isNativePdb} from '../native-pdb/index.js';
import {prepareDebugAssembly,debugSymbols} from '../portable-pdb/symbols.js';
import {parseSourceLink,sourceLinkFromPdb,resolveSourceLink} from './source-link.js';
import {checkedUrl,approvedOrigins,createDownloadSession} from './network.js';
export {parseSourceLink,sourceLinkFromPdb,resolveSourceLink} from './source-link.js';
export {checkedUrl,approvedOrigins} from './network.js';
function guidKey(raw){if(!/^[a-f0-9]{32}$/i.test(raw))throw new Error('Invalid CodeView GUID');const b=raw.match(/../g);return [...b.slice(0,4).reverse(),...b.slice(4,6).reverse(),...b.slice(6,8).reverse(),...b.slice(8)].join('').toLowerCase();}
export function symbolStoreKey(record){
  const file=String(record.path??'').replace(/\\/g,'/').split('/').at(-1);
  if(!file||file.length>512||!file.toLowerCase().endsWith('.pdb')||/[\x00-\x20:%?#]/.test(file)||file==='.'||file==='..')throw new Error('Invalid CodeView PDB filename');
  let index;
  if(record.format==='portable-pdb'){if(!/^[a-f0-9]{40}$/i.test(record.id))throw new Error('Invalid portable symbol identity');index=guidKey(record.id.slice(0,32))+'FFFFFFFF';}
  else if(record.format==='native-pdb'){if(!Number.isSafeInteger(record.age)||record.age<1||record.age>0xffffffff)throw new Error('Invalid native PDB age');index=guidKey(record.guid)+record.age.toString(16);}
  else throw new Error('Unsupported symbol-store identity');
  return [encodeURIComponent(file.toLowerCase()),index,encodeURIComponent(file.toLowerCase())].join('/');
}
export function planSymbolRestore(input,options={}){
  const assembly=readAssembly(input.bytes,{debug:true,path:input.path});
  const servers=options.symbolServers??[];if(!Array.isArray(servers)||servers.length>8)throw new RangeError('At most eight symbol servers may be approved');
  const bases=servers.map(s=>{const url=checkedUrl(s,options);if(url.search)throw new Error('Symbol server URL cannot contain a query');return url.href.replace(/\/$/,'')+'/';});
  const requests=[...new Set(bases.flatMap(base=>assembly.debugDirectory.codeView.map(record=>new URL(symbolStoreKey(record),base).href)))];
  return {assembly:assembly.name,path:input.path,embedded:!!assembly.debugDirectory.embedded,identities:assembly.debugDirectory.codeView.map(r=>({...r})),requests};
}
/** No network until explicit consent. All remote bytes re-enter the ordinary identity,
 * checksum, IL-boundary and source-validation pipeline before publication by a caller.
 */
export async function restoreSymbols(input,options={}){
  const owned={path:input.path,bytes:new Uint8Array(bytesOf(input.bytes)),sources:{...input.sources,...options.sources}};
  const maxPdbBytes=options.maxPdbBytes??16*1024*1024,plan=planSymbolRestore(owned,options),sourceOrigins=approvedOrigins(options.sourceOrigins,options);
  const symbolOrigins=new Set(plan.requests.map(s=>new URL(s).origin)),session=createDownloadSession(options);
  try{
    let pdb=input.pdb==null?null:new Uint8Array(bytesOf(input.pdb)),prepared;
    const prepare=()=>prepareDebugAssembly({...owned,pdb},{maxPdbBytes,maxSourceBytes:options.maxSourceBytes,maxTotalSourceBytes:options.maxBytes,sources:owned.sources});
    if(!pdb&&plan.embedded){const model=readAssembly(owned.bytes,{debug:true}),embedded=model.debugDirectory.embedded;pdb=await inflateBounded(embedded.bytes,embedded.uncompressedSize,maxPdbBytes);}
    if(pdb)prepared=await prepare();
    else for(const url of plan.requests){pdb=await session.get(url,symbolOrigins,maxPdbBytes);if(pdb){prepared=await prepare();break;}}
    session.check();if(!pdb||!prepared)throw new Error(plan.requests.length?'No matching PDB was found on the approved servers':'Provide a matching PDB or explicitly configure a symbol server');
    const parsed=(isNativePdb(pdb)?readNativePdb:readPortablePdb)(pdb,{maxBytes:maxPdbBytes}),verified=debugSymbols(prepared);
    const map=options.sourceMap===undefined?sourceLinkFromPdb(parsed):parseSourceLink(options.sourceMap);
    const restored={...verified.sources},missing=[],sourceRequests=[];
    for(const doc of parsed.documents){
      if(Object.hasOwn(owned.sources,doc.name)||Object.hasOwn(restored,doc.name)&&!options.refreshSources)continue;
      const url=resolveSourceLink(map,doc.name);if(!url){if(!Object.hasOwn(restored,doc.name))missing.push(doc.name);continue;}
      const checked=checkedUrl(url,options);if(!sourceOrigins.has(checked.origin))throw new Error('Approve Source Link origin before downloading source: '+checked.origin);
      sourceRequests.push({document:doc.name,url:checked.href});
    }
    // Preflight EVERY origin before issuing any source request. Source paths never become filesystem reads.
    for(const request of sourceRequests){const data=await session.get(request.url,sourceOrigins,options.maxSourceBytes??4*1024*1024);if(data)owned.sources[request.document]=data;else missing.push(request.document);}
    if(missing.length&&options.requireSources!==false)throw new Error('Original source is unavailable for '+missing.length+' document(s): '+missing[0]);
    const final=await prepare();session.check();const symbols=debugSymbols(final);
    return {path:owned.path,bytes:owned.bytes,pdb:new Uint8Array(pdb),sources:{...symbols.sources},report:{...session.report(),assembly:plan.assembly,format:symbols.format,identity:symbols.id,checksumVerified:symbols.checksumVerified,verifiedDocuments:Object.keys(symbols.sources).length,missingDocuments:missing}};
  }finally{session.close();}
}
