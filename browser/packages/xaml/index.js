import {parseXml, elements, diagnostic, failure} from '../core/index.js';
import {schema, commonProperties, events, nonvisualTypes, propertyElements} from '../core/schema.js';

function splitArguments(text) {
  const parts=[]; let start=0, quote='',depth=0;
  for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c===quote&&text[i-1]!=='\\')quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='{')depth++;if(c==='}')depth--;if(c===','&&depth===0){parts.push(text.slice(start,i).trim());start=i+1;}}
  parts.push(text.slice(start).trim());return parts;
}
const unquote=s => /^(['"])[\s\S]*\1$/.test(s) ? s.slice(1,-1) : s;
/** Parse only documented markup extensions. No expression evaluation. */
export function parseValue(value) {
  if(value.startsWith('{}'))return value.slice(2);
  if(!value.startsWith('{'))return value;
  if(!value.endsWith('}'))throw new Error('Unterminated markup extension');
  const body=value.slice(1,-1).trim(),m=/^(\S+)(?:\s+([\s\S]*))?$/.exec(body);
  if(!m)throw new Error('Empty markup extension');
  let [,kind,args='']=m;
  if(kind==='x:Null')return null;
  if(kind==='x:True')return true;
  if(kind==='x:False')return false;
  if(kind==='Binding'){
    const result={kind:'binding',path:'',mode:'Default'};
    for(const [index,part] of splitArguments(args).entries()){
      const eq=part.indexOf('=');if(eq<0){if(index!==0)throw new Error(`Invalid binding argument ${part}`);result.path=part;continue;}
      const key=part.slice(0,eq).trim(),val=unquote(part.slice(eq+1).trim());
      const fields={Path:'path',Mode:'mode',ElementName:'element',StringFormat:'format',FallbackValue:'fallback',TargetNullValue:'targetNull',UpdateSourceTrigger:'trigger'};
      if(!fields[key])throw new Error(`Unsupported binding argument ${key}`);result[fields[key]]=val;
    }
    if(!['Default','OneWay','TwoWay','OneTime'].includes(result.mode))throw new Error(`Unsupported binding mode ${result.mode}`);
    if(result.trigger&&result.trigger!=='PropertyChanged')throw new Error('Only PropertyChanged UpdateSourceTrigger is supported');
    if(result.path.startsWith('#')){const at=result.path.indexOf('.');result.element=result.path.slice(1,at<0?undefined:at);result.path=at<0?'':result.path.slice(at+1);}
    if(result.path && !/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(result.path))throw new Error(`Unsupported binding path ${result.path}`);
    return result;
  }
  if(kind==='StaticResource'||kind==='DynamicResource') {
    if(!args||/[{},]/.test(args))throw new Error(`Unsupported ${kind} key`);
    return {kind:'resource',key:args.replace(/^ResourceKey\s*=\s*/,''),dynamic:kind==='DynamicResource'};
  }
  throw new Error(`Unsupported markup extension ${kind}`);
}

export function compileXaml(source,{file='view.axaml',knownTypes=[],strict=true}={}) {
  const diagnostics=[],names=new Set(),types=new Set([...Object.keys(schema),...knownTypes]);
  const report=(code,message,node,severity='error')=>diagnostics.push(diagnostic(code,message,file,severity,node));
  try{
    const xml=parseXml(source,{file});
    const walk=(node,namespaces={},inTemplate=false)=>{
      namespaces={...namespaces};for(const[k,v]of Object.entries(node.attrs))if(k==='xmlns'||k.startsWith('xmlns:'))namespaces[k==='xmlns'?'':k.slice(6)]=v;
      const colon=node.tag.indexOf(':'),prefix=colon<0?'':node.tag.slice(0,colon),type=colon<0?node.tag:node.tag.slice(colon+1);
      if(prefix&&!namespaces[prefix])report('JB1100',`Undeclared XML namespace prefix ${prefix}`,node);
      const uri=namespaces[prefix]||'', custom=uri.startsWith('using:')||uri.startsWith('clr-namespace:');
      const qualified=custom?uri.replace(/^(using:|clr-namespace:)/,'').split(';')[0]+'.'+type:type;
      if(!types.has(type)&&!types.has(qualified)&&!type.includes('.'))report('JB1101',`Unsupported control or object type ${node.tag}`,node);
      const ir={type:types.has(qualified)?qualified:type,props:{},children:[],properties:{},loc:{line:node.line,column:node.column}};
      for(const[key,value]of Object.entries(node.attrs)){
        if(key==='xmlns'||key.startsWith('xmlns:')||key==='x:Class')continue;
        if(key==='x:DataType'){report('JB1109','x:DataType is metadata only; compiled-binding type checking is not implemented',node,strict?'error':'warning');continue;}
        if(key==='x:CompileBindings'){if(value.toLowerCase()==='true')report('JB1109','Compiled bindings are not implemented; use runtime Binding explicitly',node);continue;}
        if(key==='x:Name'||key==='Name'){
          if(!/^[A-Za-z_]\w*$/.test(value))report('JB1102',`Invalid name ${value}`,node);
          if(!inTemplate&&names.has(value))report('JB1102',`Duplicate name ${value}`,node);if(!inTemplate)names.add(value);ir.props.Name=value;continue;
        }
        if(key==='x:Key'){ir.key=value;continue;}
        const supported=commonProperties.has(key)||events.has(key)||schema[type]?.has(key)||knownTypes.includes(qualified)||knownTypes.includes(type);
        if(!supported)report('JB1103',`Unsupported property ${node.tag}.${key}`,node.attrLocations[key],strict?'error':'warning');
        try{ir.props[key]=parseValue(value);}catch(e){report('JB1104',e.message,node.attrLocations[key]);}
      }
      if(type==='Style'&&ir.props.Selector&&!/^(?:[A-Za-z_]\w*)?(?:\.[A-Za-z_]\w*)?(?::(?:pointerover|pressed|disabled|focus|checked))?$/.test(ir.props.Selector))report('JB1105',`Unsupported style selector ${ir.props.Selector}; templates/combinators require a new lowering pass`,node);
      if(type==='Setter'&&ir.props.Property&&!commonProperties.has(ir.props.Property)&&!Object.values(schema).some(s=>s.has(ir.props.Property)))report('JB1103',`Unsupported setter property ${ir.props.Property}`,node);
      let text='';for(const child of node.children){if(child.kind==='text'){text+=child.value;continue;}
        if(child.tag.includes('.')){
          const prop=child.tag.slice(child.tag.lastIndexOf('.')+1);
          if(!propertyElements.has(prop))report('JB1106',`Unsupported property element ${child.tag}`,child);
          if(ir.properties[prop])report('JB1107',`Duplicate property element ${child.tag}`,child);
          ir.properties[prop]=elements(child).map(c=>walk(c,namespaces,inTemplate||['ItemTemplate','ContentTemplate'].includes(prop)));
        }else ir.children.push(walk(child,namespaces,inTemplate||type==='DataTemplate'));
      }
      const normalized=text.trim().replace(/\s+/g,' ');if(normalized)ir.text=normalized;
      return ir;
    };
    const ir=walk(xml),className=xml.attrs['x:Class']||null;
    return {ok:!diagnostics.some(x=>x.severity==='error'),ir,className,names:[...names],diagnostics,
      code:`export const definition = ${JSON.stringify(ir,null,2)};\nexport function create(runtime, owner) { return runtime.build(definition, owner); }\n`};
  }catch(e){return {ok:false,diagnostics:[...diagnostics,failure(e,file)],code:'',ir:null,names:[]};}
}
export function inventoryXaml(source,options={}) {
  const result=compileXaml(source,{...options,strict:true});const counts={};
  function visit(n){if(!n)return;counts[n.type]=(counts[n.type]||0)+1;for(const c of n.children)visit(c);for(const children of Object.values(n.properties))children.forEach(visit);}
  visit(result.ir);return {parsed:!!result.ir,compiled:result.ok,controls:counts,diagnostics:result.diagnostics};
}
