import { Control } from './controls.js';
import { ResourceDictionary } from './properties.js';
import { bind } from './binding.js';
import { eventNames } from './schema.js';

/** Hydrates compiler IR; never parses or evaluates source text at runtime. */
export function createXamlRuntime(api, types, documents) {
  const applicationResources = new ResourceDictionary();
  // Explicit host adapter for selected, unchanged upstream ControlCatalog pages.
  applicationResources.set('ScrollPage', {kind:'presetTheme', name:'ScrollPage'});
  const resolveType = name => types.get(name) ?? types.get(name.split(':').at(-1)) ?? api[name] ?? api[name.split('.').at(-1)];
  function resource(key, target) {
    for (let current=target; current; current=current.parent) if (current.Resources?.has(key)) return current.Resources.get(key);
    if (applicationResources.has(key)) return applicationResources.get(key);
    throw new Error(`JB3001: Resource '${key}' was not found`);
  }
  function resolve(value, target, scope) {
    if (!value || typeof value !== 'object') return value;
    if (value.kind === 'resource') return resource(value.key, target);
    if (value.kind === 'reference') {
      if (!scope.names.has(value.name)) throw new Error(`JB3002: Name '${value.name}' was not found`);
      return scope.names.get(value.name);
    }
    if (value.kind === 'type') { const type=resolveType(value.name); if(!type)throw new Error(`Unknown type '${value.name}'`); return type; }
    if (value.kind === 'static') {
      const dot=value.member.lastIndexOf('.'),type=resolveType(value.member.slice(0,dot)),member=value.member.slice(dot+1);
      if (!type || !(member in type)) throw new Error(`JB3003: Static member '${value.member}' was not found`);
      return type[member];
    }
    return value;
  }
  function set(target, name, value) {
    if (name==='Child') name='Content';
    if (target instanceof Control) target.SetValue(name, value);
    else target[name]=value;
  }
  function attr(target,name,value,scope) {
    if (eventNames.includes(name)) {
      scope.pending.push(()=>{const handler=scope.owner[value];if(typeof handler!=='function')throw new Error(`JB3004: Event handler '${value}' was not found`);target.track(target[name].add(handler.bind(scope.owner)));});return;
    }
    if (value?.kind === 'binding') {scope.pending.push(()=>bind(target,name,value,scope,(v,t)=>resolve(v,t,scope)));return;}
    if (value?.kind === 'reference') {scope.pending.push(()=>set(target,name,resolve(value,target,scope)));return;}
    if (value?.kind === 'resource' && value.dynamic) {
      scope.pending.push(()=>{const update=()=>set(target,name,resolve(value,target,scope));update();for(let p=target;p;p=p.parent)if(p.Resources)target.track(p.Resources.subscribe(k=>{if(k===value.key)update();}));target.track(applicationResources.subscribe(k=>{if(k===value.key)update();}));});return;
    }
    set(target,name,resolve(value,target,scope));
  }
  function object(node, parent, scope) {
    const a=node.attributes??{}, text=node.children.filter(n=>n.kind==='text').map(n=>n.text).join(' ');
    if (node.type==='DataTemplate') {
      const body=node.children.find(n=>n.kind==='control');if(!body)throw new Error('A DataTemplate must have a control root');
      return {build(data,owner){const childScope={names:new Map(),owner:scope.owner,pending:[]};const child=build(body,owner,childScope);child.DataContext=data;finish(childScope);return child;}};
    }
    if (node.type==='Style') {
      const setters={};for(const child of node.children){if(child.type!=='Setter')continue;const value=child.attributes.Value??child.children.find(x=>x.kind==='property'&&x.property==='Value')?.children[0];setters[child.attributes.Property]=value?.type?build(value,parent,scope):resolve(value,parent,scope);}
      return {selector:a.Selector??'*', setters};
    }
    if (node.type==='Styles') return node.children.filter(n=>n.kind!=='text').map(n=>build(n,parent,scope));
    if (node.type==='ResourceDictionary') {const dictionary=new ResourceDictionary();for(const child of node.children){if(child.key==null)throw new Error('A resource needs x:Key');dictionary.Add(child.key,build(child,parent,scope));}return dictionary;}
    if (node.type==='SolidColorBrush') return new api.SolidColorBrush(resolve(a.Color??text,parent,scope));
    if (node.type==='Color') return api.Color.Parse(text||a.Value);
    if (node.type==='String'||node.type==='FontFamily') return text;
    if (node.type==='Int32'||node.type==='Double') return Number(text);
    if (node.type==='Boolean') return text.toLowerCase()==='true';
    if (node.type==='Thickness') return api.Thickness.Parse(text);
    if (node.type==='CornerRadius') return api.CornerRadius.Parse(text);
    if (node.type==='RowDefinition') return a.Height??'*';
    if (node.type==='ColumnDefinition') return a.Width??'*';
    if (node.type==='RowDefinitions'||node.type==='ColumnDefinitions') return node.children.filter(n=>n.kind!=='text').map(n=>build(n,parent,scope)).join(',');
    throw new Error(`JB3005: Runtime object '${node.type}' is not implemented`);
  }
  function property(target,node,scope) {
    const p=node.property, children=node.children.filter(n=>n.kind!=='text');
    if(p==='Resources') {
      for(const child of children) {
        if(child.type==='ResourceDictionary'){for(const [k,v]of build(child,target,scope))target.Resources.Add(k,v);}
        else {if(child.key==null)throw new Error('A resource needs x:Key');target.Resources.Add(child.key,build(child,target,scope));}
      }
    } else if(p==='Styles') {
      for(const child of children){const style=build(child,target,scope);target.Styles.push(...(Array.isArray(style)?style:[style]));}
    } else if(p==='Children'||p==='Items') {for(const child of children)target.Children.Add(build(child,target,scope));}
    else if(p==='RowDefinitions'||p==='ColumnDefinitions'){const value=children.map(n=>build(n,target,scope)).join(',');set(target,p,value);}
    else if(p==='Inlines'){set(target,'Text',node.children.map(n=>n.kind==='text'?n.text:n.attributes?.Text??n.children?.filter(c=>c.kind==='text').map(c=>c.text).join('')??'').join(''));}
    else {
      if(children.length>1)throw new Error(`Property '${p}' requires a single value`);
      const value=children.length?build(children[0],target,scope):node.children.map(n=>n.text??'').join(' ');
      set(target,p,value);
    }
  }
  function build(node,parent,scope,existing=null) {
    if(node.kind==='text')return node.text;
    if(node.kind==='object')return object(node,parent,scope);
    const Type=resolveType(node.type);if(typeof Type!=='function')throw new Error(`JB3006: Runtime type '${node.type}' was not registered`);
    const target=existing??new Type();if(target instanceof Control)target.parent=parent;
    const name=node.attributes.Name;
    if(name){scope.names.set(name,target);scope.owner[name]=target;}
    if(target instanceof Control)target._nameScope=scope.names;
    for(const child of node.children)if(child.kind==='property'&&['Resources','Styles'].includes(child.property))property(target,child,scope);
    for(const [name,value]of Object.entries(node.attributes))attr(target,name,value,scope);
    for(const child of node.children)if(child.kind==='property'&&!['Resources','Styles'].includes(child.property))property(target,child,scope);
    const children=node.children.filter(n=>n.kind!=='property');
    if(children.every(n=>n.kind==='text')&&children.length) {
      set(target,['TextBlock','Run'].includes(target.type)?'Text':'Content',children.map(n=>n.text).join(' '));
    } else for(const child of children){const value=build(child,target,scope);if(target instanceof Control)target.Children.Add(value);else throw new Error(`Object ${node.type} has no content collection`);}
    return target;
  }
  function finish(scope){for(let i=0;i<scope.pending.length;i++)scope.pending[i]();}
  function loadXaml(instance,id=null) {
    id??=instance.constructor.$fullName??instance.$type;
    const ir=documents.get(id);if(!ir)throw new Error(`JB3007: XAML '${id}' was not registered`);
    if(instance._xamlLoaded===ir)return instance;instance._xamlLoaded=ir;
    const scope={names:new Map(),owner:instance,pending:[]};build(ir.root,null,scope,instance);finish(scope);return instance;
  }
  function createFromXaml(id) {
    const ir=documents.get(id);if(!ir)throw new Error(`XAML '${id}' was not registered`);
    const Type=resolveType(ir.className??ir.root.type);const instance=new Type();
    if(instance._xamlLoaded!==ir)loadXaml(instance,id);return instance;
  }
  return {loadXaml,createFromXaml,applicationResources,resolveType};
}
