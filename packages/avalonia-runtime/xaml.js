import { Control } from './controls.js';
import { ResourceDictionary } from './properties.js';
import { createAttributeRuntime } from './attribute-lifecycle.js';
import { eventNames } from './schema.js';
/** Hydrate linked IR. Each deferred template creates its own namescope and subscriptions. */
export function createXamlRuntime(api, types, documents) {
  const applicationResources=new ResourceDictionary();applicationResources.set('ScrollPage',{kind:'presetTheme',name:'ScrollPage'});
  applicationResources.subscribe(()=>api.root?.invalidate('resources'));
  const resolveType=name=>typeof name==='function'?name:types.get(name)??api[name]??api[String(name).split('.').at(-1)];
  const keyOf=key=>key?.kind==='type'?resolveType(key.name):key;
  function findResource(key,target){key=keyOf(key);for(let current=target;current;current=current.parent??current._resourceParent)if(current.Resources?.has(key))return {found:true,value:current.Resources.get(key)};return {found:applicationResources.has(key),value:applicationResources.get(key)};}
  function resource(key,target){const found=findResource(key,target);if(!found.found)throw new Error(`JB3001: Resource '${String(keyOf(key))}' was not found`);return found.value;}
  function resolve(value,target,scope){
    if(!value||typeof value!=='object')return value;
    if(value.kind==='resource')return resource(value.key,target);
    if(value.kind==='reference'){if(!scope.names.has(value.name))throw new Error(`JB3002: Name '${value.name}' was not found`);return scope.names.get(value.name);}
    if(value.kind==='type'){const type=resolveType(value.name);if(!type)throw new Error('Unknown type '+value.name);return type;}
    if(value.kind==='static'){const dot=value.member.lastIndexOf('.'),type=resolveType(value.member.slice(0,dot)),member=value.member.slice(dot+1);if(!type||!(member in type))throw new Error('Unknown static member '+value.member);return type[member];}
    return value;
  }
  function set(target,name,value){if(name==='Child')name='Content';if(target instanceof Control)target.SetValue(name,value);else target[name]=value;}
  const {attr,prepareXamlAttribute,refreshXamlSubscriptions}=createAttributeRuntime(api,{resolve,findResource,keyOf,set});
  const visualBody=node=>node.children.flatMap(n=>n.kind==='property'&&n.property==='Content'?n.children:[n]).find(n=>n.kind==='control');
  function newScope(scope,extra={}){return {names:new Map(),owner:scope.owner,pending:[],created:[],exportNames:false,templatedParent:null,...extra};}
  function finish(scope){for(let i=0;i<scope.pending.length;i++)scope.pending[i]();scope.pending=[];}
  function safely(scope,fn){try{return fn();}catch(error){for(const child of scope.created??[])child.Dispose();throw error;}}
  function dictionary(node,parent,scope,existing=null){
    const result=existing??new ResourceDictionary(),host={Resources:result,parent};
    for(const child of node.children.filter(n=>n.kind!=='text')){
      if(child.kind==='property'&&child.property==='MergedDictionaries'){
        for(const merge of child.children.filter(c=>c.kind!=='text'))result.MergedDictionaries.Add(build(merge,host,scope));
      }else{
        if(child.key==null)throw new Error('A resource needs x:Key');const key=keyOf(child.key);if(key==null)throw new Error('Resource type key was not registered');
        result.defer(key,()=>{const childScope=newScope(scope);return safely(childScope,()=>{const value=build(child,host,childScope);finish(childScope);return value;});});
      }
    }
    return result;
  }
  function setters(node,parent,scope){
    const result={};for(const child of node.children.flatMap(c=>c.kind==='property'&&c.property==='Setters'?c.children:[c])){
      if(child.kind==='text')continue;if(child.type!=='Setter')throw new Error('JB3015: Only Setter children are supported here');
      const name=child.attributes.Property;if(typeof name!=='string'||!name)throw new Error('Setter requires Property');
      const valueNode=child.children.find(c=>c.kind==='property'&&c.property==='Value')?.children.find(c=>c.kind!=='text')??child.children.find(c=>c.kind!=='text'&&c.kind!=='property');
      result[name]=valueNode?build(valueNode,parent,scope):child.attributes.Value?.dynamic?findResource(child.attributes.Value.key,parent).value:resolve(child.attributes.Value,parent,scope);
    }return result;
  }
  function setterPlan(node,parent,scope){
    const values=setters(node,parent,scope),dynamic=node.children.flatMap(c=>c.kind==='property'&&c.property==='Setters'?c.children:[c]).filter(c=>c.attributes?.Value?.kind==='resource'&&c.attributes.Value.dynamic);
    return {setters:values,resolveSetters:target=>{
      const result={...values};for(const c of dynamic){const found=findResource(c.attributes.Value.key,target);if(found.found)result[c.attributes.Property]=found.value;else delete result[c.attributes.Property];}return result;
    }};
  }
  function object(node,parent,scope){
    const a=node.attributes??{},text=node.children.filter(n=>n.kind==='text').map(n=>n.text).join(' ');
    if(node.type==='DataTemplate'||node.type==='ControlTemplate'){
      const body=visualBody(node);if(!body)throw new Error('Template requires a visual root');
      if(node.type==='ControlTemplate')return {kind:'controlTemplate',build(owner){if(a.TargetType){const expected=resolveType(a.TargetType.name??a.TargetType);if(!expected||!(owner instanceof expected))throw new Error('JB3013: ControlTemplate TargetType mismatch');}const childScope=newScope(scope,{templatedParent:owner});return safely(childScope,()=>{const root=build(body,owner,childScope);finish(childScope);return {root,names:childScope.names};});}};
      return {kind:'dataTemplate',build(data,owner){const childScope=newScope(scope);return safely(childScope,()=>{const child=build(body,owner,childScope);child.DataContext=data;finish(childScope);return child;});}};
    }
    if(node.type==='ControlTheme'){
      const targetType=resolveType(a.TargetType?.name??a.TargetType);if(typeof targetType!=='function')throw new Error('ControlTheme TargetType is not registered');
      return {kind:'controlTheme',targetType,basedOn:resolve(a.BasedOn,parent,scope),...setterPlan(node,parent,scope)};
    }
    if(node.type==='Style')return {selector:a.Selector??'*',...setterPlan(node,parent,scope)};
    if(node.type==='Styles')return node.children.filter(n=>n.kind!=='text').flatMap(n=>build(n,parent,scope));
    if(node.type==='ResourceDictionary')return dictionary(node,parent,scope);
    if(node.type==='StyleInclude'||node.type==='ResourceInclude'){
      const included=documents.get(node.includePath)??[...documents.values()].find(d=>d.path===node.includePath);
      if(!included)throw new Error('JB3016: Include was not linked: '+String(a.Source));
      return build(included.root,parent,scope);
    }
    if(node.type==='SolidColorBrush')return new api.SolidColorBrush(resolve(a.Color??text,parent,scope));
    if(node.type==='Color')return api.Color.Parse(text||a.Value);
    if(node.type==='String'||node.type==='FontFamily')return text;
    if(node.type==='Int32'||node.type==='Double')return Number(text);
    if(node.type==='Boolean')return text.toLowerCase()==='true';
    if(node.type==='Thickness')return api.Thickness.Parse(text);
    if(node.type==='CornerRadius')return api.CornerRadius.Parse(text);
    if(node.type==='RowDefinition')return a.Height??'*';if(node.type==='ColumnDefinition')return a.Width??'*';
    if(node.type==='RowDefinitions'||node.type==='ColumnDefinitions')return node.children.filter(n=>n.kind!=='text').map(n=>build(n,parent,scope)).join(',');
    throw new Error('JB3005: Runtime object '+node.type+' is not implemented');
  }
  function property(target,node,scope){
    const p=node.property,children=node.children.filter(n=>n.kind!=='text');
    if(p==='Resources'){
      if(children.length===1&&children[0].type==='ResourceDictionary')dictionary(children[0],target,scope,target.Resources);
      else dictionary({children},target,scope,target.Resources);
    }else if(p==='Styles'){for(const child of children){const style=build(child,target,scope);target.Styles.push(...(Array.isArray(style)?style:[style]));}}
    else if(p==='Children'||p==='Items'){for(const child of children)target.Children.Add(build(child,target,scope));}
    else if(p==='RowDefinitions'||p==='ColumnDefinitions')set(target,p,children.map(n=>build(n,target,scope)).join(','));
    else if(p==='Inlines')set(target,'Text',node.children.map(n=>n.kind==='text'?n.text:n.attributes?.Text??n.children?.filter(c=>c.kind==='text').map(c=>c.text).join('')??'').join(''));
    else {if(children.length>1)throw new Error('Property '+p+' requires a single value');set(target,p,children.length?build(children[0],target,scope):node.children.map(n=>n.text??'').join(' '));}
  }
  function build(node,parent,scope,existing=null){
    if(node.kind==='text')return node.text;if(node.kind==='object')return object(node,parent,scope);
    const Type=resolveType(node.type);if(typeof Type!=='function')throw new Error('JB3006: Type '+node.type+' is not registered');
    const target=existing??new Type();if(target instanceof Control){if(!existing)scope.created.push(target);target.parent=parent instanceof Control?parent:null;target._resourceParent=parent;target._nameScope=scope.names;target._xamlScope=scope;if(scope.templatedParent)target.TemplatedParent=scope.templatedParent;}
    if(node.source)api.dev?.register(target,node.source);
    const name=node.attributes.Name;if(name){scope.names.set(name,target);if(scope.exportNames)scope.owner[name]=target;}
    for(const child of node.children)if(child.kind==='property'&&['Resources','Styles'].includes(child.property))property(target,child,scope);
    for(const [name,value]of Object.entries(node.attributes))attr(target,name,value,scope);
    for(const child of node.children)if(child.kind==='property'&&!['Resources','Styles'].includes(child.property))property(target,child,scope);
    const children=node.children.filter(n=>n.kind!=='property');
    if(children.every(n=>n.kind==='text')&&children.length)set(target,['TextBlock','Run'].includes(target.type)?'Text':'Content',children.map(n=>n.text).join(' '));
    else for(const child of children){const value=build(child,target,scope);if(target instanceof Control){
      if(['Button','ToggleButton','ContentControl','ContentPresenter','UserControl','Window','ScrollViewer','TabItem','Expander','GroupBox','ContentPage','Border'].includes(target.type)&&children.length===1)set(target,'Content',value);
      else target.Children.Add(value);
    }else throw new Error('Object has no content collection');}
    if(target instanceof Control)scope.pending.push(()=>{
      if(!target.Theme){const found=findResource(Type,target);if(found.found&&found.value?.kind==='controlTheme')target.SetValue('Theme',found.value,80);}
    });
    return target;
  }
  function loadXaml(instance,id=null){
    id??=instance.constructor.$fullName??instance.$type;const ir=documents.get(id);if(!ir)throw new Error('JB3007: XAML '+id+' was not registered');
    if(instance._xamlLoaded===ir)return instance;const scope={names:new Map(),owner:instance,pending:[],created:[],exportNames:true,templatedParent:null};
    safely(scope,()=>{build(ir.root,null,scope,instance);finish(scope);});instance._xamlLoaded=ir;return instance;
  }
  function createFromXaml(id){const ir=documents.get(id);if(!ir)throw new Error('XAML '+id+' was not registered');const Type=resolveType(ir.className??ir.root.type);const instance=new Type();if(instance._xamlLoaded!==ir)loadXaml(instance,id);return instance;}
  // Stage a builtin subtree without exporting names or mounting DOM nodes.
  function prepareXamlFragment(node,parent,owner){
    const liveNames=parent._nameScope,scope={names:new Map(liveNames),owner,pending:[],created:[],exportNames:false,templatedParent:null};
    const root=safely(scope,()=>build(node,parent,scope));
    const added=new Map([...scope.names].filter(([key,value])=>liveNames.get(key)!==value));
    return {root,created:scope.created,names:added,scope:liveNames,activate(){finish(scope);},attach(){
      scope.names=liveNames;
      for(const c of scope.created)c._nameScope=liveNames;
      for(const [key,value]of added){liveNames.set(key,value);Object.defineProperty(owner,key,{value,writable:true,enumerable:true,configurable:true});}
    }};
  }
  function prepareXamlEnvironment(target,propertyName,node){
    const scope=target._xamlScope;if(!scope)throw new Error('Environment target has no source scope');
    const staging=newScope(scope,{names:scope.names});
    if(propertyName==='Resources'){
      const children=node?.children??[],body=children.length===1&&children[0].type==='ResourceDictionary'?children[0]:{children};
      const next=dictionary(body,target,staging),saved=target.Resources.snapshot();
      // Materialize before replacing live values: malformed and cyclic resources fail in preflight.
      try{for(const key of next.keys())next.get(key);finish(staging);}catch(e){next.Dispose();throw e;}
      return {apply(){target.Resources.replaceContents(next.snapshot());},rollback(){target.Resources.replaceContents(saved);},finalize(){next.Dispose();}};
    }
    if(propertyName==='Styles'){
      const before=target.Styles,next=(node?.children??[]).filter(n=>n.kind!=='text').flatMap(n=>build(n,target,staging));finish(staging);
      return {apply(){target.Styles=next;},rollback(){target.Styles=before;},finalize(){}};
    }
    const value=node?.children.find(n=>n.kind!=='text');
    const next=value?build(value,target,staging):null;finish(staging);
    return {apply(){target.SetValue(propertyName,next);},rollback(){},finalize(){}};
  }
  return {loadXaml,createFromXaml,applicationResources,resolveType,prepareXamlFragment,prepareXamlAttribute,refreshXamlSubscriptions,prepareXamlEnvironment};
}
