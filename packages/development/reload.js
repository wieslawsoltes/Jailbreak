import { eventNames, controlDefinitions } from '../avalonia-runtime/schema.js';
import { identifier, escapeJs } from '../compiler-core/index.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export { liveProperties } from './live-properties.js';
import { liveProperties } from './live-properties.js';
const literal=v=>v===null||['string','number','boolean'].includes(typeof v);
export function planReload(previous,next){
  const reasons=[],patches=[],locations=[];
  if(!previous?.success||!next?.success)return {compatible:false,reasons:['Both builds must succeed'],patches:[]};
  if(!previous.debug||!next.debug)return {compatible:false,reasons:['Enable development tools before starting the preview'],patches:[]};
  if(!same(previous.manifest,next.manifest))reasons.push('Entry, assets, project profile or binary manifest changed');
  if(!same(previous.buildProfiles,next.buildProfiles))reasons.push('Project evaluation changed');
  if(!same(previous.debug.typeShapes,next.debug.typeShapes))reasons.push('C# type shape, constructor, initializer or property changed');
  if(!same(previous.binaries,next.binaries)||!same(previous.packages,next.packages))reasons.push('Binary library/package change requires restart');
  const oldDocs=new Map(previous.xaml.map(d=>[d.path,d]));
  if(previous.xaml.length!==next.xaml.length)reasons.push('XAML document set changed');
  function walk(a,b,file){
    if(!a||!b||a.kind!==b.kind||a.type!==b.type||a.property!==b.property||!same(a.key,b.key)||a.children?.length!==b.children?.length){reasons.push('XAML structure changed in '+file);return;}
    if(a.kind==='text'&&a.text!==b.text)reasons.push('Text-node change requires restart; use a Text/Content attribute for live edits');
    if(a.source&&b.source)locations.push({file,offset:a.span.start,next:b.source});
    const keys=new Set([...Object.keys(a.attributes??{}),...Object.keys(b.attributes??{})]);
    for(const key of keys){const before=a.attributes?.[key],after=b.attributes?.[key];if(same(before,after))continue;
      if(a.kind!=='control'||!Object.hasOwn(controlDefinitions,a.type)||!liveProperties.has(key)||eventNames.includes(key)||before!==undefined&&!literal(before)||after!==undefined&&!literal(after))reasons.push('Non-live property '+file+':'+a.type+'.'+key);
      else patches.push({file,offset:a.span.start,property:key,value:after,remove:after===undefined});
    }
    for(let i=0;i<(a.children?.length??0);i++)walk(a.children[i],b.children[i],file);
  }
  for(const doc of next.xaml){const old=oldDocs.get(doc.path);if(!old||old.className!==doc.className)reasons.push('XAML identity changed');else walk(old.root,doc.root,doc.path);}
  for(const method of next.debug.methods??[])if(method.code.includes('super.'))reasons.push('Base-dispatch method updates require restart');
  return {compatible:!reasons.length,reasons:[...new Set(reasons)],patches,locations,documents:next.xaml,debug:next.debug};
}
export function reloadScript(plan,previous,next,revision){
  if(!plan.compatible)throw new Error('Cannot emit incompatible reload');
  const aliases=next.types.filter(t=>t.kind!=='interface').map(t=>`const ${identifier(t.name)}=JB.types.get(${escapeJs(t.name)});`).join('\n');
  const methods=(next.debug.methods??[]).map(m=>`{type:${escapeJs(m.type)},name:${escapeJs(m.name)},static:${m.static},fn:({${m.code}})[${escapeJs(m.name)}]}`).join(',\n');
  return `(function(JB){\n${aliases}\nJB.dev.applyReload(${escapeJs({...plan,debug:{sites:plan.debug.sites},revision})},[${methods}]);\n})(globalThis.Jailbreak);`;
}
