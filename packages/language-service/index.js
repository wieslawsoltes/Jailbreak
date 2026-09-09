import {parseCSharp} from '../csharp-compiler/parser.js';
import {parseXml} from '../compiler-core/xml.js';
import {SourceFile} from '../compiler-core/index.js';
import {controlDefinitions,commonProperties,eventNames} from '../avalonia-runtime/schema.js';
const keywords=new Set(('abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while async await var partial get set value').split(' '));
const enumValues={Orientation:['Horizontal','Vertical'],HorizontalAlignment:['Left','Center','Right','Stretch'],VerticalAlignment:['Top','Center','Bottom','Stretch'],HorizontalContentAlignment:['Left','Center','Right','Stretch'],VerticalContentAlignment:['Top','Center','Bottom','Stretch'],TextWrapping:['NoWrap','Wrap'],Dock:['Left','Top','Right','Bottom']};
const nativeTypes=new Set([...Object.keys(controlDefinitions),'string','int','double','float','bool','object','char','List','ObservableCollection','Dictionary','Task','EventArgs','RoutedEventArgs']);
const localTag=name=>name.split(':').at(-1),contains=(n,at)=>n&&n.start<=at&&at<=(n.end??n.start);
const flat=e=>e?.kind==='identifier'?e.name:e?.kind==='member'&&!e.optional&&flat(e.object)?flat(e.object)+'.'+e.name:null;
const typeName=t=>t?.rank?(t.name+'[]'):t?.name;
const short=name=>String(name??'').split('.').at(-1);
function xmlValue(unit,node,name){const span=node.attributeSpans?.[name];if(!span)return null;const raw=unit.text.slice(span.start,span.end),m=/=\s*(["'])/.exec(raw);return m?{start:span.start+m.index+m[0].length,end:span.end-1}:null;}
/** Source-only index. It reads existing parser ASTs/schema, never runtime application objects. */
export class LanguageWorkspace {
  constructor({maxFiles=500,maxCharacters=8_000_000,maxDocument=500_000}={}){this.limits={maxFiles,maxCharacters,maxDocument};this.cache=new Map();this.units=new Map();this.symbols=new Map();this.types=new Map();this.occurrences=[];this.scopes=[];this.members=new Map();}
  update(input){
    const entries=Object.entries(input).filter(([p,t])=>/\.(cs|a?xaml)$/i.test(p)&&typeof t==='string');
    if(entries.length>this.limits.maxFiles||entries.reduce((n,[p,t])=>n+t.length,0)>this.limits.maxCharacters)throw new Error('Language-service workspace budget exceeded');
    this.units.clear();this.symbols.clear();this.types.clear();this.occurrences=[];this.scopes=[];this.members.clear();
    for(const [file,text]of entries){
      if(text.length>this.limits.maxDocument)continue;
      let cached=this.cache.get(file);if(cached?.text!==text){const parsed=/\.cs$/i.test(file)?parseCSharp(text,file):parseXml(text,file);cached={text,parsed};this.cache.set(file,cached);}
      this.units.set(file,{file,text,parsed:cached.parsed,source:new SourceFile(file,text),tokens:cached.parsed.tokens??[]});
    }
    for(const key of this.cache.keys())if(!this.units.has(key))this.cache.delete(key);
    const token=(u,name,start,end,last=false)=>{const ts=u.tokens.filter(t=>t.kind==='id'&&t.value===name&&t.start>=start&&t.end<=end);return last?ts.at(-1):ts[0];};
    this.token=token;
    const define=(u,name,kind,position,extra={},id=null)=>{
      if(!position)return null;if(this.symbols.size>100000)throw new Error('Language-service symbol budget exceeded');
      id??=u.file+':'+position.start;let s=this.symbols.get(id);
      const d={file:u.file,start:position.start,end:position.end,...u.source.location(position.start)};
      if(s)s.definitions.push(d);else{ s={id,name,kind,definitions:[d],...extra};this.symbols.set(id,s); }
      this.occurrences.push({...d,symbol:id,declaration:true});return s;
    };this.define=define;
    for(const u of this.units.values())for(const t of u.parsed.ast?.declarations??[]){
      const name=token(u,t.name,t.start,t.bases[0]?.start??t.end);
      define(u,t.name,t.kind,name,{type:t.fullName},'T:'+t.fullName);if(!this.types.has(t.fullName))this.types.set(t.fullName,[]);this.types.get(t.fullName).push({node:t,unit:u});
      if(!this.members.has(t.fullName))this.members.set(t.fullName,new Map());const members=this.members.get(t.fullName);
      for(const m of t.members??[]){if(m.kind==='constructor')continue;
        const at=token(u,m.name,m.type?.end??t.start,m.body?.start??m.end??t.end),id='M:'+t.fullName+':'+m.name;
        const s=define(u,m.name,m.kind,at,{type:typeName(m.type),owner:t.fullName,static:m.mods?.includes('static'),parameters:m.parameters?.map(p=>({name:p.name,type:typeName(p.type)}))},id);
        if(s){members.set(m.name,id);if(m.parameters&&s.parameters&&JSON.stringify(s.parameters)!==JSON.stringify(m.parameters.map(p=>({name:p.name,type:typeName(p.type)}))))s.overloaded=true;}
      }
    }
    // XAML names are actual generated C# fields, not unrelated word matches.
    for(const u of this.units.values())if(u.parsed.root){const owner=u.parsed.root.attributes['x:Class'];u.owner=owner;
      const walk=n=>{if(n.kind!=='element')return;const name=n.attributes['x:Name']??n.attributes.Name;
        if(name&&owner){const at=xmlValue(u,n,n.attributes['x:Name']?'x:Name':'Name');if(!this.members.has(owner))this.members.set(owner,new Map());const id='M:'+owner+':'+name;
          define(u,name,'named-control',at,{type:localTag(n.tag),owner},id);this.members.get(owner).set(name,id);}
        for(const c of n.children)walk(c);};walk(u.parsed.root);
    }
    const occurrence=(u,at,s)=>{if(at)this.occurrences.push({file:u.file,start:at.start,end:at.end,...u.source.location(at.start),symbol:s?.id??null,declaration:false});};
    this.occurrence=occurrence;
    const scope=(u,node,parent,owner,callable)=>{const s={file:u.file,start:node.start??parent?.start??0,end:node.end??parent?.end??u.text.length,parent,owner,callable:callable??parent?.callable,symbols:new Map()};this.scopes.push(s);return s;};
    const declareLocal=(u,s,name,kind,at,type)=>{const symbol=define(u,name,kind,at,{type,scope:s,owner:s.owner});if(symbol)s.symbols.set(name,symbol.id);return symbol;};
    const visit=(u,n,s)=>{
      if(!n||typeof n!=='object')return;
      if(n.kind==='block'){const inner=scope(u,n,s,s.owner);for(const statement of n.statements)visit(u,statement,inner);return;}
      if(n.kind==='local'){visit(u,n.type,s);let from=n.type.end;for(const v of n.variables){const at=token(u,v.name,from,v.init?.start??n.end);visit(u,v.init,s);declareLocal(u,s,v.name,'local',at,n.type.name==='var'?this.infer(u,v.init,s):typeName(n.type));from=v.init?.end??at?.end??from;}return;}
      if(n.kind==='for'){const inner=scope(u,n,s,s.owner);visit(u,n.init,inner);visit(u,n.test,inner);visit(u,n.update,inner);visit(u,n.body,inner);return;}
      if(n.kind==='foreach'){visit(u,n.iterable,s);const inner=scope(u,n,s,s.owner);declareLocal(u,inner,n.name,'local',token(u,n.name,n.type.end,n.iterable.start),typeName(n.type));visit(u,n.body,inner);return;}
      if(n.kind==='lambda'){const inner=scope(u,n,s,s.owner);for(const p of n.parameters)declareLocal(u,inner,p.name,'parameter',token(u,p.name,p.type?.end??n.start,n.body.start),typeName(p.type));visit(u,n.body,inner);return;}
      if(n.kind==='try'){visit(u,n.body,s);for(const c of n.catches){const inner=scope(u,c.body,s,s.owner);declareLocal(u,inner,c.name,'local',token(u,c.name,c.type?.end??n.start,c.body.start),typeName(c.type));visit(u,c.body,inner);}visit(u,n.finalizer,s);return;}
      if(n.kind==='identifier'){occurrence(u,n,this.resolveName(u,n.name,s,n.start));return;}
      if(n.kind==='member'){visit(u,n.object,s);const owner=this.infer(u,n.object,s);occurrence(u,token(u,n.name,n.object.end,n.end,true),this.member(owner,n.name,u,s.owner));return;}
      if(n.kind==='type'){const type=this.resolveType(n.name,u,s.owner);occurrence(u,token(u,short(n.name),n.start,n.args?.[0]?.start??n.end,true),this.symbols.get('T:'+type));for(const a of n.args??[])visit(u,a,s);return;}
      for(const v of Object.values(n))if(Array.isArray(v))v.forEach(x=>visit(u,x,s));else if(v&&typeof v==='object')visit(u,v,s);
    };
    for(const u of this.units.values())for(const t of u.parsed.ast?.declarations??[]){
      const outer=scope(u,t,null,t.fullName,null);for(const base of t.bases)visit(u,base,outer);
      for(const m of t.members??[]){const inner=scope(u,m,outer,t.fullName,m);
        for(const p of m.parameters??[]){visit(u,p.type,inner);declareLocal(u,inner,p.name,'parameter',token(u,p.name,p.type.end,p.value?.start??m.body?.start??m.end),typeName(p.type));visit(u,p.value,inner);}
        visit(u,m.type,inner);visit(u,m.initializer,inner);visit(u,m.init,inner);visit(u,m.body,inner);visit(u,m.get,inner);visit(u,m.set,inner);
      }
    }
    for(const u of this.units.values())if(u.parsed.root){
      const walk=n=>{if(n.kind!=='element')return;for(const [key,value]of Object.entries(n.attributes)){
        if(key==='x:Class')occurrence(u,xmlValue(u,n,key),this.symbols.get('T:'+value));
        else if(eventNames.includes(key)&&!value.startsWith('{'))occurrence(u,xmlValue(u,n,key),this.member(u.owner,value,u,u.owner));
      }for(const c of n.children)walk(c);};walk(u.parsed.root);
    }
    return this;
  }
  resolveType(name,u,owner){
    if(!name)return null;if(this.types.has(name)||nativeTypes.has(name))return name;
    const space=owner?.includes('.')?owner.slice(0,owner.lastIndexOf('.')):'';
    if(this.types.has(space+'.'+name))return space+'.'+name;
    for(const use of u?.parsed.ast?.usings??[]){if(use.alias===name)return use.name;if(this.types.has(use.name+'.'+name))return use.name+'.'+name;}
    const matches=[...this.types.keys()].filter(t=>short(t)===name);return matches.length===1?matches[0]:nativeTypes.has(short(name))?short(name):null;
  }
  member(type,name,u,owner,seen=new Set()){
    type=this.resolveType(type,u,owner);if(!type||seen.has(type))return null;seen.add(type);
    const id=this.members.get(type)?.get(name);if(id)return this.symbols.get(id);
    for(const record of this.types.get(type)??[])for(const base of record.node.bases){const found=this.member(base.name,name,record.unit,owner,seen);if(found)return found;}
    return null;
  }
  resolveName(u,name,s,at){
    for(let scope=s;scope;scope=scope.parent){const id=scope.symbols.get(name),symbol=this.symbols.get(id);if(symbol&&symbol.definitions[0].start<=at)return symbol;}
    return this.member(s?.owner,name,u,s?.owner)??this.symbols.get('T:'+this.resolveType(name,u,s?.owner))??null;
  }
  infer(u,e,s){
    if(!e)return null;
    if(e.kind==='identifier'){if(e.name==='this')return s?.owner;if(e.name==='base')return this.types.get(s?.owner)?.[0]?.node.bases[0]?.name;return this.resolveName(u,e.name,s,e.start)?.type??this.resolveType(e.name,u,s?.owner);}
    if(e.kind==='new'||e.kind==='cast')return typeName(e.type);
    if(e.kind==='group'||e.kind==='nullForgiving')return this.infer(u,e.expression,s);
    if(e.kind==='literal')return e.numericType??({string:'string',boolean:'bool',number:'double'}[typeof e.value]);
    if(e.kind==='member')return this.member(this.infer(u,e.object,s),e.name,u,s?.owner)?.type;
    if(e.kind==='call')return this.infer(u,e.callee,s);
    if(e.kind==='binary')return this.infer(u,e.left,s)??this.infer(u,e.right,s);
    return null;
  }
  scope(file,at){return this.scopes.filter(s=>s.file===file&&contains(s,at)).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];}
  at(file,at){return this.occurrences.filter(p=>p.file===file&&p.start<=at&&at<=p.end).sort((a,b)=>(a.end-a.start)-(b.end-b.start)||Number(b.declaration)-Number(a.declaration))[0];}
  definition(file,at){return this.symbols.get(this.at(file,at)?.symbol)?.definitions??[];}
  references(file,at){const id=this.at(file,at)?.symbol;return id?this.occurrences.filter(o=>o.symbol===id):[];}
  describe(file,at){const symbol=this.symbols.get(this.at(file,at)?.symbol);return symbol?{name:symbol.name,kind:symbol.kind,type:symbol.type,parameters:symbol.parameters,definitions:symbol.definitions}:null;}
  completionMembers(type,u,owner,seen=new Set()){
    type=this.resolveType(type,u,owner);if(!type||seen.has(type))return [];seen.add(type);
    const result=[...(this.members.get(type)?.values()??[])].map(id=>this.symbols.get(id));
    for(const record of this.types.get(type)??[])for(const b of record.node.bases)result.push(...this.completionMembers(b.name,record.unit,type,seen));
    if(Object.hasOwn(controlDefinitions,type)){const def=controlDefinitions[type];for(const name of new Set([...commonProperties,...String(def).split(' ').filter(Boolean),...eventNames]))result.push({name,kind:eventNames.includes(name)?'event':'property',type:'runtime member'});}
    return result;
  }
  complete(file,at){
    const u=this.units.get(file);if(!u)return {items:[],reason:'Document is outside the language-service profile'};
    if(!Number.isSafeInteger(at)||at<0||at>u.text.length)throw new Error('Invalid language-service position');
    if(!/\.cs$/i.test(file))return completeXaml(u.text,at);
    if(u.tokens.some(t=>['string','interpolated','char'].includes(t.kind)&&t.start<at&&at<t.end))return {items:[],reason:'String literal'};
    const previous=u.tokens.filter(t=>t.end<=at&&t.kind!=='eof').at(-1),gap=u.text.slice(previous?.end??0,at);
    if(/\/\/[^\n]*$/.test(gap)||gap.lastIndexOf('/*')>gap.lastIndexOf('*/'))return {items:[],reason:'Comment'};
    const prefix=/[A-Za-z_][\w]*$/.exec(u.text.slice(0,at))?.[0]??'',start=at-prefix.length,end=at+(/^\w*/.exec(u.text.slice(at))?.[0].length??0);
    const before=u.text.slice(0,start),receiver=/([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)\?*\.$/.exec(before)?.[1];
    let model=this,unit=u;
    if(!u.parsed.ast&&receiver){const fixed=u.text.slice(0,start)+'__completion'+u.text.slice(end);model=new LanguageWorkspace(this.limits).update(Object.fromEntries([...this.units].map(([f,u])=>[f,f===file?fixed:u.text])));unit=model.units.get(file);}
    const scope=model.scope(file,start);let symbols=[];
    if(receiver){const names=receiver.split('.');let type=names[0]==='this'?scope?.owner:model.resolveName(unit,names[0],scope,start)?.type??model.resolveType(names[0],unit,scope?.owner);for(const name of names.slice(1))type=model.member(type,name,unit,scope?.owner)?.type;symbols=model.completionMembers(type,unit,scope?.owner);}
    else{for(let s=scope;s;s=s.parent)for(const id of s.symbols.values()){const sym=model.symbols.get(id);if(sym.definitions[0].start<=at)symbols.push(sym);}symbols.push(...model.completionMembers(scope?.owner,unit,scope?.owner),...[...model.types.keys()].map(n=>({name:n,kind:'class',type:n})),...[...nativeTypes].map(n=>({name:n,kind:'type'})),...['new','return','if','else','var','await','foreach'].map(name=>({name,kind:'keyword'})));}
    const seen=new Set();const items=symbols.filter(s=>s&&!s.name.includes('.')||s?.kind==='class').filter(s=>s&&!seen.has(s.name)&&s.name.toLowerCase().startsWith(prefix.toLowerCase())&&seen.add(s.name)).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,100).map(s=>({label:s.name,kind:s.kind,detail:[s.type,s.parameters?'('+s.parameters.map(p=>p.type+' '+p.name).join(', ')+')':''].filter(Boolean).join(' '),start,end,insertText:s.name,cursor:s.name.length}));
    return {items,reason:unit.parsed.ast?'':'Only schema completion is available until the source parses'};
  }
  rename(file,at,newName){
    const u=this.units.get(file),symbol=this.symbols.get(this.at(file,at)?.symbol);
    if(!u?.parsed.ast||!['local','parameter'].includes(symbol?.kind))throw new Error('Safe rename currently supports parsed C# locals and parameters only');
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(newName)||keywords.has(newName))throw new Error('Use a non-keyword C# identifier');
    const callable=symbol.scope.callable;
    if(u.tokens.some(t=>t.kind==='interpolated'&&contains(callable,t.start)))throw new Error('Rename inside interpolated expressions requires the extended source binder');
    if(u.tokens.some(t=>t.kind==='id'&&t.value===newName&&contains(callable,t.start)&&this.at(file,t.start)?.symbol!==symbol.id))throw new Error('New name collides with another identifier in the containing member');
    const refs=this.references(file,at);if(refs.some(r=>r.file!==file))throw new Error('Local reference escaped its source document');
    const edits=[...new Map(refs.map(r=>[r.start,{start:r.start,end:r.end,text:newName}])).values()].sort((a,b)=>a.start-b.start);
    let after=u.text;for(const e of [...edits].reverse())after=after.slice(0,e.start)+e.text+after.slice(e.end);
    const checked=new LanguageWorkspace(this.limits).update(Object.fromEntries([...this.units].map(([f,x])=>[f,f===file?after:x.text])));
    if(!checked.units.get(file).parsed.ast)throw new Error('Rename would invalidate the source syntax');
    const map=offset=>offset+edits.filter(e=>e.end<=offset).reduce((n,e)=>n+e.text.length-(e.end-e.start),0);
    for(const old of this.occurrences.filter(r=>r.file===file)){
      const next=checked.at(file,map(old.start)),def=this.symbols.get(old.symbol)?.definitions[0],actual=checked.symbols.get(next?.symbol)?.definitions[0];
      if(!!def!==!!actual||def&&(def.file!==actual.file||(def.file===file?map(def.start):def.start)!==actual.start))throw new Error('Rename changes binding outside the selected symbol');
    }
    return {file,before:u.text,after,selection:map(symbol.definitions[0].start),edits,label:`Rename ${symbol.name} → ${newName}`};
  }
}
/** Lightweight lexical XML completion works while the start tag is incomplete. */
export function completeXaml(text,at){
  let open=-1,quote=null;for(let i=0;i<at;i++){if(!quote&&text.startsWith('<!--',i)){const end=text.indexOf('-->',i+4);if(end<0||end>=at)return {items:[]};i=end+2;continue;}const c=text[i];if(quote){if(c===quote)quote=null;}else if(open>=0&&(c==='"'||c==="'"))quote=c;else if(c==='<')open=i;else if(c==='>')open=-1;}
  if(open<0)return {items:[]};const part=text.slice(open+1,at),prefix=/[A-Za-z_:][\w.:]*$/.exec(part)?.[0]??'',start=at-prefix.length,end=at+(/^[\w.:]*/.exec(text.slice(at))?.[0].length??0);
  if(quote){const m=/([\w.]+)\s*=\s*["'][^"']*$/.exec(part);const values=enumValues[m?.[1]]??(/^Is|^Can|^Has/.test(m?.[1]??'')?['True','False']:[]);return {items:values.filter(v=>v.toLowerCase().startsWith(prefix.toLowerCase())).map(label=>({label,kind:'value',detail:m[1],start,end,insertText:label,cursor:label.length}))};}
  const tag=/^\/?([\w:]+)/.exec(part)?.[1],tagPosition=/^\/?[\w:]*$/.test(part);
  const def=controlDefinitions[localTag(tag??'')];const values=tagPosition?Object.keys(controlDefinitions):def?[...new Set([...commonProperties,...String(def).split(' ').filter(Boolean),...eventNames,'x:Name','Grid.Row','Grid.Column','Grid.RowSpan','Grid.ColumnSpan'])]:[];
  const used=new Set([...part.matchAll(/([\w.:]+)\s*=/g)].map(m=>m[1]));
  return {items:values.filter(v=>v.toLowerCase().startsWith(prefix.toLowerCase())&&!used.has(v)).sort().slice(0,100).map(label=>({label,kind:tagPosition?'control':eventNames.includes(label)?'event':'property',detail:tagPosition?'Avalonia runtime control':tag,start,end,insertText:tagPosition?label:label+'=""',cursor:tagPosition?label.length:label.length+2}))};
}
