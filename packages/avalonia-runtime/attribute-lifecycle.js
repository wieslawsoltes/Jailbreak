import { bind } from './binding.js';
import { eventNames } from './schema.js';
/** Attribute-owned subscriptions: exactly one disposable slot per property, not per reload. */
export function createAttributeRuntime(api,{resolve,findResource,keyOf,set}) {
  const stores=new WeakMap();
  function store(target){
    let slots=stores.get(target);
    if(!slots){stores.set(target,slots=new Map());target.track(()=>{for(const r of slots.values())r.stop();slots.clear();});}
    return slots;
  }
  function record(target,name,value,scope){
    let off=()=>{},active=false;
    const result={target,name,value,scope,
      stop(){active=false;const previous=off;off=()=>{};previous();},
      start(){
        if(active||target._disposed)return;active=true;
        try {
          api.dev?.binding(target,name,value?.kind?value:null);
          if(eventNames.includes(name)){
            const fn=scope.owner[value];if(typeof fn!=='function')throw new Error('JB3004: Event handler '+value+' was not found');
            off=target[name].add(api.dev?api.dev.handler(scope.owner,value):fn.bind(scope.owner));return;
          }
          let spec=value;
          if(spec?.kind==='templateBinding'){
            if(!scope.templatedParent)throw new Error('JB3014: TemplateBinding has no templated parent');
            spec={...spec,kind:'binding',RelativeSource:{mode:'TemplatedParent'},Mode:'OneWay',priority:50};
          }
          if(spec?.kind==='binding'){
            off=bind(target,name,spec,scope,(v,t)=>resolve(v,t,scope),{track:false});return;
          }
          if(spec?.kind==='resource'&&spec.dynamic){
            const key=keyOf(spec.key),subscriptions=[];
            off=()=>{for(const dispose of subscriptions.splice(0))dispose();};
            const update=()=>{const found=findResource(key,target);if(found.found)set(target,name,found.value);else target.ClearValue(name);};
            for(let p=target;p;p=p.parent)if(p.Resources)subscriptions.push(p.Resources.subscribe(k=>{if(k===key)update();}));
            subscriptions.push(api.applicationResources.subscribe(k=>{if(k===key)update();}));update();return;
          }
          set(target,name,resolve(spec,target,scope));
        }catch(error){result.stop();throw error;}
      }
    };return result;
  }
  function attr(target,name,value,scope){
    if(!target.track){set(target,name,resolve(value,target,scope));return;}
    const slots=store(target),r=record(target,name,value,scope);slots.get(name)?.stop();slots.set(name,r);
    if(eventNames.includes(name)||['binding','templateBinding','reference'].includes(value?.kind)||value?.dynamic)scope.pending.push(()=>r.start());else r.start();
  }
  function prepare(target,name,value,remove=false){
    const slots=store(target),old=slots.get(name),scope=old?.scope??target._xamlScope;
    if(!scope)throw new Error('Property target has no XAML scope');
    const next=remove?null:record(target,name,value,scope);
    return {
      apply(){old?.stop();if(next){slots.set(name,next);next.start();}else {slots.delete(name);if(!eventNames.includes(name))target.ClearValue(name);api.dev?.binding(target,name,null);}},
      suspend(){next?.stop();old?.stop();},
      rollback(){next?.stop();if(old){slots.set(name,old);old.start();}else {slots.delete(name);api.dev?.binding(target,name,null);}},
      finalize(){}
    };
  }
  function refresh(target){
    for(const r of stores.get(target)?.values()??[])if(r.value?.kind==='resource'&&r.value.dynamic){r.stop();r.start();}
    for(const c of target.visualChildren??[])refresh(c);
  }
  return {attr,prepareXamlAttribute:prepare,refreshXamlSubscriptions:refresh};
}
