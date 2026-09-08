import { BinaryError } from '../managed-pe/bytes.js';
export const typeKey=(assembly,name)=>assembly+'|'+name;
export const methodSlot=m=>m.name+'('+m.signature.parameters.join(',')+')';
export function category(type) {
  if(type==='void')return 'void';
  if(/^(bool|char|u?int(8|16|32)|nativeu?int)$/.test(type))return 'i4';
  if(/^u?int64$/.test(type))return 'i8';
  if(/^float(32|64)$/.test(type))return 'f';
  if(type==='string'||type==='object'||type.endsWith('[]')||/^\[[^\]]+\][^<>&*]+$/.test(type))return 'ref';
  throw new BinaryError('Unsupported executable signature type '+type,0,'JB6103');
}
const coreAssemblies=new Set(['System.Runtime','System.Private.CoreLib','mscorlib','netstandard','System.Console']);
export function linkAssemblies(assemblies) {
  const types=new Map(),methods=new Map(),fields=new Map(),assemblyMap=new Map();
  for(const a of assemblies){if(assemblyMap.has(a.name))throw new BinaryError('Duplicate assembly identity '+a.name);assemblyMap.set(a.name,a);
    for(const [feature,count]of Object.entries(a.features||{}))if(count)throw new BinaryError(`Unsupported executable assembly feature ${feature} (${count})`,0,'JB6104');
    for(const t of a.types){const key=typeKey(a.name,t.name);if(types.has(key))throw new BinaryError('Duplicate type '+key);if(t.flags&0x20)throw new BinaryError('Interface declarations are not yet supported');types.set(key,{...t,key,assembly:a.name,baseKey:t.base?typeKey(t.base.assembly,t.base.name):null});}
    for(const f of a.fields){category(f.type);if(f.flags&64)throw new BinaryError('Literal fields need constant-table lowering');const key=a.name+'|'+f.token;fields.set(key,{...f,key,ownerKey:typeKey(a.name,f.owner)});}
    for(const m of a.methods){if(m.signature.genericArity)throw new BinaryError('Generic methods need specialization');if(m.implFlags||m.flags&0x2000||!m.body)throw new BinaryError(`Method ${m.owner}.${m.name} has no supported managed IL body`,0,'JB6104');
      for(const type of [m.signature.returnType,...m.signature.parameters,...m.body.locals])category(type);
      const key=a.name+'|'+m.token;methods.set(key,{...m,key,assembly:a.name,ownerKey:typeKey(a.name,m.owner),slot:methodSlot(m)});
    }
  }
  for(const a of assemblies)for(const ref of a.references){const supplied=assemblyMap.get(ref.name);if(supplied&&supplied.version!==ref.version)throw new BinaryError(`Assembly version mismatch: ${ref.name} requires ${ref.version}, supplied ${supplied.version}`);}
  for(const t of types.values()){const seen=new Set();let c=t;while(c){if(seen.has(c.key))throw new BinaryError('Inheritance cycle '+t.key);seen.add(c.key);if(c.baseKey&&!types.has(c.baseKey)&&!(c.base?.name==='System.Object'&&coreAssemblies.has(c.base.assembly)))throw new BinaryError('Unsupported or missing base type '+c.baseKey);c=types.get(c.baseKey);}}
  function resolveType(a,token){const t=a.types.find(t=>t.token===token)||a.referencedTypes?.[token];if(!t)throw new BinaryError('Unresolved type token '+token.toString(16));return t;}
  function resolve(a,token,kind='method'){
    const own=(kind==='method'?methods:fields).get(a.name+'|'+token);if(own)return own;
    const ref=a.members.find(m=>m.token===token);if(!ref||ref.kind!==kind)throw new BinaryError('Invalid '+kind+' reference token '+token.toString(16));
    const ownerKey=typeKey(ref.owner.assembly,ref.owner.name),collection=kind==='method'?methods:fields;
    const found=[...collection.values()].find(m=>m.ownerKey===ownerKey&&m.name===ref.name&&(kind==='field'?m.type===ref.signature:methodSlot(m)===methodSlot(ref)&&m.signature.returnType===ref.signature.returnType&&m.signature.hasThis===ref.signature.hasThis));
    if(found)return found;
    if(kind==='method'&&coreAssemblies.has(ref.owner.assembly)){
      const {parameters:p,returnType:r,hasThis}=ref.signature,type=ref.owner.name,name=ref.name;
      let allowed=type==='System.Object'&&name==='.ctor'&&hasThis&&!p.length&&r==='void';
      allowed ||= type==='System.String'&&name==='Concat'&&!hasThis&&p.length>=2&&p.length<=4&&p.every(t=>t==='string')&&r==='string';
      allowed ||= type==='System.String'&&name==='get_Length'&&hasThis&&!p.length&&r==='int32';
      allowed ||= type==='System.Math'&&!hasThis&&(['Abs','Min','Max'].includes(name)?p.length===(name==='Abs'?1:2)&&['int32','float64'].includes(r)&&p.every(t=>t===r):['Sqrt','Floor','Ceiling','Sin','Cos'].includes(name)&&p.length===1&&p[0]==='float64'&&r==='float64');
      allowed ||= type==='System.Console'&&name==='WriteLine'&&!hasThis&&p.length===1&&['string','int32','float64'].includes(p[0])&&r==='void';
      allowed ||= type==='System.Exception'&&name==='.ctor'&&hasThis&&p.length===1&&p[0]==='string'&&r==='void';
      if(allowed)return {...ref,external:type+'::'+name+'::'+p.join(','),ownerKey};
    }
    throw new BinaryError(`Unresolved executable ${kind}: [${ref.owner.assembly}]${ref.owner.name}::${ref.name}`,0,'JB6105');
  }
  return {types,methods,fields,resolve,resolveType};
}
