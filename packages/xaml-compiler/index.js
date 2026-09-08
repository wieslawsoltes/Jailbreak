import { DiagnosticBag, escapeJs, splitTopLevel } from '../compiler-core/index.js';
import { parseXml } from '../compiler-core/xml.js';
import { controlDefinitions, structuralTypes, hasProperty, eventNames } from '../avalonia-runtime/schema.js';
const AVA = new Set(['https://github.com/avaloniaui','http://schemas.avaloniaui.net']);
const X = 'http://schemas.microsoft.com/winfx/2006/xaml';
export function parseMarkup(value) {
  if (typeof value !== 'string' || !value.startsWith('{')) return value;
  if (value.startsWith('{}')) return value.slice(2);
  if (!value.endsWith('}')) throw new Error('Unclosed markup extension');
  const body=value.slice(1,-1).trim(), match=/^(\S+?)(?:\s+([\s\S]*))?$/.exec(body);
  const name=match?.[1], args=splitTopLevel(match?.[2]??''); const options={}; const positional=[];
  for(const arg of args) {
    if(!arg)continue;
    const eq=arg.indexOf('=');
    if(eq>0 && /^[\w.]+$/.test(arg.slice(0,eq).trim()))options[arg.slice(0,eq).trim()]=unquote(arg.slice(eq+1).trim());
    else positional.push(unquote(arg));
  }
  function unquote(t){if((t[0]==="'"&&t.at(-1)==="'")||(t[0]==='"'&&t.at(-1)==='"'))t=t.slice(1,-1);return t.startsWith('{')?parseMarkup(t):t;}
  if(name==='Binding'||name==='CompiledBinding'||name==='ReflectionBinding')return {kind:'binding',path:options.Path??positional[0]??'',...options};
  if(name==='StaticResource'||name==='DynamicResource')return {kind:'resource',key:options.ResourceKey??positional[0],dynamic:name==='DynamicResource'};
  if(name==='x:Null')return null;
  if(name==='x:True')return true;
  if(name==='x:False')return false;
  if(name==='x:Static')return {kind:'static',member:positional[0]};
  if(name==='x:Type')return {kind:'type',name:positional[0]};
  if(name==='x:Reference')return {kind:'reference',name:options.Name??positional[0]};
  if(name==='TemplateBinding')return {kind:'templateBinding',path:positional[0]};
  throw new Error(`Unsupported markup extension '${name}'`);
}
export function compileXaml(text, options = {}) {
  const parsed=parseXml(text,options.path??'view.axaml'),bag=new DiagnosticBag();bag.merge(parsed.diagnostics);
  const source=parsed.source,names=[],customTypes=options.customTypes??[],dependencies=new Set();let className=null;
  function report(code,msg,node,key,severity='error'){bag.add(code,msg,source,node.attributeSpans?.[key]?.start??node.span.start,severity);}
  function lower(node, parentNs = {}) {
    if(node.kind==='text')return {kind:'text',text:node.text.trim().replace(/\s+/g,' '),span:node.span};
    const ns={...parentNs}; for(const [k,v] of Object.entries(node.attributes))if(k==='xmlns')ns['']=v;else if(k.startsWith('xmlns:'))ns[k.slice(6)]=v;
    const [prefix,local]=node.tag.includes(':')?node.tag.split(':'):['',node.tag]; const uri=ns[prefix];
    if(prefix==='d'||uri==='http://schemas.microsoft.com/expression/blend/2008')return null;
    if(prefix && !uri)report('JB1101',`Undeclared namespace prefix '${prefix}'`,node);
    let type=local;
    if(uri?.startsWith('clr-namespace:')||uri?.startsWith('using:'))type=uri.replace(/^(clr-namespace:|using:)/,'').split(';')[0]+'.'+local;
    else if(uri&&!AVA.has(uri)&&uri!==X&&!uri.includes('markup-compatibility'))report('JB1102',`Unsupported XAML namespace '${uri}'`,node);
    if(local.includes('.')) {
      const property=local.slice(local.lastIndexOf('.')+1),owner=local.slice(0,local.lastIndexOf('.'));
      const structuralProperties={Setter:['Value'],Style:['Setters'],DataTemplate:['Content'],ResourceDictionary:['MergedDictionaries']};
      if(Object.hasOwn(controlDefinitions,owner)?!hasProperty(owner,property):!(structuralProperties[owner]?.includes(property)||customTypes.includes(type.slice(0,type.lastIndexOf('.')))))report('JB1113',`Unsupported property element '${type}'`,node);
      return {kind:'property',property,children:node.children.map(c=>lower(c,ns)).filter(Boolean),span:node.span};
    }
    if(type.startsWith('System.')&&['String','Boolean','Int32','Double'].includes(local))type=local;
    const builtin=Object.hasOwn(controlDefinitions,type),structural=structuralTypes.includes(type);
    if(!builtin&&!structural&&!customTypes.includes(type))report('JB1103',`Unknown XAML type '${type}'`,node);
    dependencies.add(type);
    const attributes={}; let key=null;
    for(const [k,v] of Object.entries(node.attributes)) {
      if(k==='xmlns'||k.startsWith('xmlns:')||k.startsWith('d:')||k.startsWith('mc:'))continue;
      if(k==='x:Class'){className=v;continue;}
      if(k==='x:Name'||k==='Name'){if(names.includes(v))report('JB1104',`Duplicate name '${v}'`,node,k);names.push(v);attributes.Name=v;continue;}
      if(k==='x:Key'){key=v;continue;}
      if(k==='x:DataType'||k==='x:CompileBindings') { report('JB1110',`${k} is accepted as metadata; typed compiled-binding validation is not implemented`,node,k,'warning');continue; }
      if(k.startsWith('x:')){report('JB1105',`Unsupported XAML directive ${k}`,node,k);continue;}
      if(builtin&&!hasProperty(type,k))report('JB1106',`Unsupported property '${type}.${k}'`,node,k);
      try {
        const value=parseMarkup(v);attributes[k]=value;
        if(value?.kind==='binding') {
          if(value.Mode&&!['Default','OneWay','TwoWay','OneTime','OneWayToSource'].includes(value.Mode))report('JB1107',`Unknown binding mode ${value.Mode}`,node,k);
          for(const option of Object.keys(value))if(!['kind','path','Path','Mode','ElementName','Source','Converter','ConverterParameter','StringFormat','FallbackValue','TargetNullValue'].includes(option))report('JB1108',`Unsupported binding option '${option}'`,node,k);
        }
        if(value?.kind==='templateBinding')report('JB1109','TemplateBinding requires the deferred template pipeline (not implemented)',node,k);
      }catch(e){report('JB1107',e.message,node,k);}
    }
    if(['ControlTemplate','ControlTheme','TreeDataTemplate','StyleInclude','ResourceInclude','FluentTheme','SimpleTheme'].includes(type))report('JB1111',`${type} is not implemented in the browser compatibility profile`,node);
    if(type==='Style' && attributes.Selector && !/^[\w.#:\s,\-]+$/.test(attributes.Selector))report('JB1112',`Unsupported style selector '${attributes.Selector}'`,node);
    return {kind:structural?'object':'control',type,key,attributes,children:node.children.map(c=>lower(c,ns)).filter(Boolean),span:node.span};
  }
  const root=parsed.root?lower(parsed.root):null;
  const ir={version:1,path:source.path,className,root,names,dependencies:[...dependencies]};
  const code=bag.hasErrors?'':`JB.registerXaml(${escapeJs(className??source.path)}, ${escapeJs(ir)});`;
  return {ir,code,diagnostics:bag.items,success:!bag.hasErrors};
}
