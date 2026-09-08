/** Shared .NET helpers are injected from the same runtime used by the C# frontend. */
export function createILRuntime(DN, {instructionBudget=1000000,maxDepth=256}={}) {
  const assemblies=new Map(),types=new Map(),methods=new Map(),fields=new Map(),objects=new WeakMap();let ticks=instructionBudget,depth=0;
  const requireValue=value=>{if(value==null)throw new DN.ArgumentNullException('NullReferenceException');return value;};
  function enter(){if(!depth)ticks=instructionBudget;if(depth>=maxDepth)throw new Error('IL call depth budget exceeded');depth++;}
  function leave(){depth--;}
  function tick(){if(--ticks<0)throw new Error('IL execution budget exceeded');}
  const defaultValue=type=>type==='void'?undefined:type==='int64'||type==='uint64'?0n:/^(?:bool|char|u?int\d+|nativeu?int|float\d+)$/.test(type)?0:null;
  function ensure(key){const t=types.get(key);if(!t)throw new Error('Unlinked type '+key);if(t.state===3)throw t.error;if(t.state)return;t.state=1;
    try {if(t.cctor)invoke(t.cctor,[]);t.state=2;}catch(error){t.state=3;t.error=error;throw error;}
  }
  function invoke(key,args,virtual=false){let m=methods.get(key);if(!m)throw new Error('Unlinked method '+key);ensure(m.ownerKey);
    if(m.signature.hasThis){requireValue(args[0]);if(virtual&&m.flags&64){let actual=objects.get(args[0]);while(actual){const candidate=actual.methods.find(x=>x.slot===m.slot&&(x.flags&64));if(candidate){m=candidate;break;}actual=types.get(actual.baseKey);}}}
    return m.fn(args);
  }
  function allocate(key){ensure(key);const t=types.get(key),object=Object.create(t.facade.prototype);objects.set(object,t);const chain=[];for(let c=t;c;c=types.get(c.baseKey)){if(chain.includes(c))throw new Error('Cyclic base types');chain.push(c);}for(const c of chain)for(const field of c.fields)if(!(field.flags&16))object[field.key]=defaultValue(field.type);return object;}
  function construct(method,args){const m=methods.get(method);if(!m||m.name!=='.ctor')throw new Error('Invalid constructor');const object=allocate(m.ownerKey);invoke(method,[object,...args]);return object;}
  function external(id,args){const [type,name,sig]=id.split('::');
    if(type==='System.Object'&&name==='.ctor')return;
    if(type==='System.String'&&name==='Concat')return DN.StringApi.Concat(...args);
    if(type==='System.String'&&name==='get_Length')return DN.length(requireValue(args[0]));
    if(type==='System.Console'&&name==='WriteLine')return DN.Console.WriteLine(...args);
    if(type==='System.Math'){if(name==='Abs'&&sig==='int32'&&args[0]===-2147483648)throw new DN.ArgumentException('Integer absolute value overflow');return DN.MathApi[name](...args);}
    if(type==='System.Exception'&&name==='.ctor')return new DN.Exception(args[0]??'');
    throw new Error('Missing IL library adapter '+id);
  }
  function getField(key,object){const field=fields.get(key);if(!field)throw new Error('Unlinked field '+key);ensure(field.ownerKey);return field.flags&16?field.value:requireValue(object)[key];}
  function setField(key,object,value){const field=fields.get(key);if(!field)throw new Error('Unlinked field '+key);ensure(field.ownerKey);if(field.flags&16)field.value=value;else requireValue(object)[key]=value;return value;}
  function install(program,implementations){
    // Validate the complete registration before publishing anything.
    for(const a of program.assemblies)if(assemblies.has(a.name))throw new Error('Duplicate assembly '+a.name);
    for(const t of program.types)if(types.has(t.key))throw new Error('Duplicate IL type '+t.key);
    for(const m of program.methods)if(typeof implementations[m.key]!=='function')throw new Error('Missing compiled method '+m.key);
    for(const a of program.assemblies)assemblies.set(a.name,a);
    for(const source of program.types){const t={...source,state:0,methods:[],fields:[],facade:null};types.set(t.key,t);}
    for(const source of program.fields){const f={...source,value:defaultValue(source.type)};fields.set(f.key,f);types.get(f.ownerKey).fields.push(f);}
    for(const source of program.methods){const m={...source,fn:implementations[source.key]};methods.set(m.key,m);types.get(m.ownerKey).methods.push(m);if(m.name==='.cctor')types.get(m.ownerKey).cctor=m.key;}
    for(const t of types.values())if(!t.facade){const facade=function(...args){const candidates=t.methods.filter(m=>m.name==='.ctor'&&m.signature.parameters.length===args.length);if(candidates.length!==1)throw new Error('Constructor overload requires an exact supported arity');return construct(candidates[0].key,args);};t.facade=facade;Object.defineProperty(facade,'name',{value:t.name.split('.').at(-1)});}
    for(const source of program.types){const t=types.get(source.key);if(t.baseKey&&types.has(t.baseKey))Object.setPrototypeOf(t.facade.prototype,types.get(t.baseKey).facade.prototype);
      const groups=new Map();for(const m of t.methods){if(m.name.startsWith('.'))continue;const group=(m.signature.hasThis?'i':'s')+m.name;if(!groups.has(group))groups.set(group,[]);groups.get(group).push(m);}
      for(const list of groups.values()){const first=list[0],target=first.signature.hasThis?t.facade.prototype:t.facade;
        Object.defineProperty(target,first.name,{configurable:true,value:function(...args){const matches=list.filter(m=>m.signature.parameters.length===args.length);if(matches.length!==1)throw new Error('Ambiguous managed method; invoke by signature key');return invoke(matches[0].key,first.signature.hasThis?[this,...args]:args,true);}});
        if(first.name.startsWith('get_')&&first.signature.parameters.length===0){const name=first.name.slice(4),prior=Object.getOwnPropertyDescriptor(target,name)||{};Object.defineProperty(target,name,{...prior,configurable:true,get:function(){return invoke(first.key,first.signature.hasThis?[this]:[],true);}});}
        if(first.name.startsWith('set_')&&first.signature.parameters.length===1){const name=first.name.slice(4),prior=Object.getOwnPropertyDescriptor(target,name)||{};Object.defineProperty(target,name,{...prior,configurable:true,set:function(value){invoke(first.key,first.signature.hasThis?[this,value]:[value],true);}});}
      }
    }
    return program.assemblies.map(a=>a.name);
  }
  return {install,enter,leave,tick,invoke,construct,external,getField,setField,defaultValue,
    unsigned(op,a,b){a>>>=0;b>>>=0;if(!b)throw new DN.DivideByZeroException();return op==='div.un'?Math.trunc(a/b)>>>0:(a%b)>>>0;},
    arrayLength(a){requireValue(a);if(!Array.isArray(a))throw new DN.ArgumentException('Expected managed array');return a.length;},
    arrayGet(a,i){requireValue(a);if(!Array.isArray(a))throw new DN.ArgumentException('Expected managed array');return DN.getIndex(a,i);},
    arraySet(a,i,v){requireValue(a);if(!Array.isArray(a))throw new DN.ArgumentException('Expected managed array');return DN.setIndex(a,i,v);},
    type:(assembly,name)=>types.get(assembly+'|'+name)?.facade,
    get assemblies(){return [...assemblies.keys()];},
    exportTypes(JB,assembly){for(const t of types.values())if(t.assembly===assembly&&t.name!=='<Module>')JB.defineType(t.name,t.facade);},
    dispose(){assemblies.clear();types.clear();methods.clear();fields.clear();}
  };
}
