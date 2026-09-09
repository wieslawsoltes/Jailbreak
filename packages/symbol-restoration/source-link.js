/** Source Link document-to-URL mapping. Parsing never authorizes I/O. */
export const SOURCE_LINK_KIND='cc110556-a091-4d38-9fec-25ab9a351a6a';
const norm=path=>path.replace(/\\/g,'/').toLowerCase();
function text(value){if(typeof value==='string')return value;return new TextDecoder('utf-8',{fatal:true}).decode(value);}
export function parseSourceLink(input){
  if(input==null)return [];
  let value=input;
  if(typeof value==='string'||ArrayBuffer.isView(value)){const source=text(value);if(source.length>1024*1024)throw new RangeError('Source Link map exceeds one MiB');value=JSON.parse(source);}
  if(!value||typeof value!=='object'||Array.isArray(value)||!value.documents||typeof value.documents!=='object'||Array.isArray(value.documents))throw new Error('Source Link must contain a documents object');
  const entries=Object.entries(value.documents);if(entries.length>2000)throw new RangeError('Source Link entry budget exceeded');
  const seen=new Set();
  return entries.map(([path,url])=>{
    if(!path||path.length>8192||/[\x00-\x1f]/.test(path)||typeof url!=='string'||url.length>8192)throw new Error('Invalid Source Link path or URL');
    const count=(s,c)=>s.split(c).length-1,wild=count(path,'*');
    if(wild>1||wild&&!path.endsWith('*')||count(url,'*')!==wild)throw new Error('Source Link needs one terminal path wildcard and one matching URL wildcard');
    const key=norm(path);if(seen.has(key))throw new Error('Ambiguous case-insensitive Source Link mapping');seen.add(key);
    const probe=new URL(url.replace('*','source.cs'));if(!['https:','http:'].includes(probe.protocol)||probe.username||probe.password||probe.hash)throw new Error('Source Link requires a plain HTTP(S) URL without credentials or fragment');
    return {path,key,url,wild:!!wild,prefix:wild?key.slice(0,-1):key,length:path.length-wild};
  }).sort((a,b)=>Number(a.wild)-Number(b.wild)||b.length-a.length);
}
export function sourceLinkFromPdb(pdb){
  const records=(pdb.custom??[]).filter(r=>r.table===0&&r.row===1&&r.kind===SOURCE_LINK_KIND);
  if(records.length>1)throw new Error('Duplicate Source Link metadata');
  return records.length?parseSourceLink(records[0].bytes):[];
}
export function resolveSourceLink(entries,document){
  if(typeof document!=='string'||!document||document.length>8192)throw new Error('Invalid source document');
  const original=document.replace(/\\/g,'/'),key=norm(document);
  const mapping=entries.find(m=>m.wild?norm(original.slice(0,m.length))===m.prefix:key===m.key);
  if(!mapping)return null;if(!mapping.wild)return mapping.url;
  const suffix=original.slice(mapping.length),parts=suffix.split('/');
  if(!suffix||parts.some(p=>!p||p==='.'||p==='..'||/[\x00-\x1f]/.test(p)))throw new Error('Unsafe relative Source Link path');
  const relative=parts.map(p=>encodeURIComponent(p).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())).join('/');
  return mapping.url.replace('*',relative);
}
