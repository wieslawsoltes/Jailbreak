import {createCooperativeDebugger} from './cooperative-debugger.js';
import {beginTemplateTransaction} from '../avalonia-runtime/template-transaction.js';
import {eventNames} from '../avalonia-runtime/schema.js';
import { prepareStructure } from './structure-runtime.js';
import { readWatch, snapshot } from './watch.js';
import { liveProperties } from './live-properties.js';
/** Per-application developer session. Nothing here is enabled for release execution. */
export function createDevelopmentSession(JB,{debug={},report=()=>{},nativeBreaks=true,breakpoints=[],watches=[],breakOnThrow=false}={}){
  const origins=new WeakMap(),bindings=new WeakMap(),boundMethods=new WeakMap();let points=new Map(),counts=new Map(),lastLocals=null,selected=null,picking=false,breakNext=false,disposed=false,revision=0,reloading=false;
  const originalMethod=JB.method,originalAdd=JB.eventAdd,originalRemove=JB.eventRemove;
  JB.method=(object,name)=>{let cache=boundMethods.get(object);if(!cache){cache=new Map();boundMethods.set(object,cache);}if(!cache.has(name))cache.set(name,co.rememberBound((...args)=>object[name](...args),object,name));return cache.get(name);};
  const emit=(kind,payload)=>{if(!disposed){try{report(kind,payload);}catch{/* Tool clients must not change application execution. */}}};
  let inputRoot=null,inputInert=false;
  function cooperativeReport(kind,payload){
    if(['debug-paused','debug-resumed','debug-completed'].includes(kind)){
      const paused=co.state().some(t=>t.status==='paused'),element=JB.root?.element;
      if(paused&&element&&!inputRoot){inputRoot=element;inputInert=element.inert;element.inert=true;}
      if(!paused&&inputRoot){inputRoot.inert=inputInert;inputRoot=null;}
    }
    emit(kind,payload);
  }
  const co=createCooperativeDebugger({point:id=>points.get(id),breakpoint:(p,locals)=>hitPoint(p,locals,false),breakOnThrow:()=>breakOnThrow,report:cooperativeReport});
  JB.eventAdd=(object,name,handler)=>originalAdd(object,name,co.eventFunction(handler));
  JB.eventRemove=(object,name,handler)=>originalRemove(object,name,co.eventFunction(handler));
  function configure(settings={}){if(settings.debug){debug=settings.debug;points=new Map((debug.sites??[]).map(p=>[p.id,p]));}if(settings.breakpoints)breakpoints=settings.breakpoints.slice(0,1000);if(settings.watches)watches=settings.watches.slice(0,50);if('nativeBreaks'in settings)nativeBreaks=!!settings.nativeBreaks;if('breakOnThrow'in settings)breakOnThrow=!!settings.breakOnThrow;counts.clear();}
  configure({debug});
  const registry=()=>{const result=[],seen=new Set();function visit(c,parent=null){if(!c||c._disposed||seen.has(c)||result.length>=5000)return;seen.add(c);result.push({c,parent});for(const child of c.visualChildren??[])visit(child,c.uid);}visit(JB.root);return result;};
  const resolve=id=>registry().find(e=>e.c.uid===id)?.c;
  function condition(text,locals){if(!text)return true;
    const m=/^(.*?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/.exec(text);
    if(!m)return !!readWatch(locals,text);
    const l=readWatch(locals,m[1].trim()),r=JSON.parse(m[3]);
    if(r!==null&&typeof r==='object')throw new Error('Conditions compare scalar values only');
    if(m[2]==='=='||m[2]==='===')return l===r;if(m[2]==='!='||m[2]==='!==')return l!==r;
    if(typeof l!=='number'||typeof r!=='number')throw new Error('Ordered conditions require numbers');
    return m[2]==='>'?l>r:m[2]==='<'?l<r:m[2]==='>='?l>=r:l<=r;
  }
  function hit(id,getLocals){
    return co.active?false:hitPoint(points.get(id),getLocals);
  }
  function hitPoint(point,getLocals,native=true){
    if(disposed||reloading||!point)return false;
    const matching=breakpoints.filter(b=>b.enabled!==false&&(b.language==='javascript'?b.line===point.generatedLine:b.file===point.file&&Number(b.line)===point.line));
    if(!breakNext&&!matching.length)return false;
    let locals;try{locals=getLocals();}catch(error){locals={'[unavailable]':error.message};}let stop=breakNext;breakNext=false;
    for(const b of matching){const key=JSON.stringify(b),count=(counts.get(key)??0)+1;counts.set(key,count);if(b.hitCount&&count<Number(b.hitCount))continue;
      try{if(!condition(b.condition,locals))continue;if(b.log){emit('debug-log',{point,hitCount:count,locals:snapshot(locals)});continue;}stop=true;}
      catch(error){emit('debug-condition-error',{point,message:error.message});}
    }
    if(stop){lastLocals=locals;emit('debug-hit',{point,locals:snapshot(locals),watches:watchResults(),stack:new Error().stack,nativePause:native&&nativeBreaks});}
    return native?stop&&nativeBreaks:stop;
  }
  function watchResults(){return watches.map(path=>{try{return {path,value:snapshot(readWatch(lastLocals??{this:JB.root},path))};}catch(error){return {path,error:error.message};}});}
  function tree(){return registry().map(({c,parent})=>({id:c.uid,parent,type:c.constructor.$fullName??c.type,name:c.Name??'',source:origins.get(c)??null,template:!!c.TemplatedParent,selected:c===selected}));}
  function inspect(id){const c=resolve(id);if(!c)throw new Error('Visual was disposed or is not part of the application');
    const values={};for(const name of new Set([...c._metadata.keys(),...c._values.keys()])){
      const value=c.GetValue(name);values[name]={value:snapshot(value,{depth:1}),local:c._values.get(name)?.has(1000)??false,binding:bindings.get(c)?.[name]??null};
    }
    return {id:c.uid,type:c.constructor.$fullName??c.type,source:origins.get(c)??null,template:!!c.TemplatedParent,properties:values};
  }
  let overlay=null,resizeObserver=null,drag=null;
  function resizeHandle(){
    const handle=document.createElement('button');handle.type='button';handle.setAttribute('aria-label','Resize selected visual');handle.style.cssText='position:absolute;right:-6px;bottom:-6px;width:12px;height:12px;padding:0;pointer-events:auto;cursor:nwse-resize;border:1px solid #fff;background:#7666eb;touch-action:none';
    handle.addEventListener('pointerdown',event=>{if(!selected?.element)return;event.preventDefault();event.stopPropagation();const r=selected.element.getBoundingClientRect();drag={id:selected.uid,x:event.clientX,y:event.clientY,width:r.width,height:r.height};handle.setPointerCapture(event.pointerId);});
    handle.addEventListener('pointermove',event=>{if(!drag)return;const width=Math.max(1,Math.round(drag.width+event.clientX-drag.x)),height=Math.max(1,Math.round(event.shiftKey?width*drag.height/drag.width:drag.height+event.clientY-drag.y));Object.assign(overlay.style,{width:width+'px',height:height+'px'});});
    handle.addEventListener('pointerup',event=>{if(!drag)return;const value={id:drag.id,width:parseFloat(overlay.style.width),height:parseFloat(overlay.style.height)};drag=null;handle.releasePointerCapture(event.pointerId);highlight();emit('resize',value);});
    handle.addEventListener('pointercancel',()=>{drag=null;highlight();});
    handle.addEventListener('keydown',event=>{if(!selected?.element||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const r=selected.element.getBoundingClientRect(),delta=event.shiftKey?10:1;emit('resize',{id:selected.uid,width:Math.max(1,Math.round(r.width+({ArrowLeft:-delta,ArrowRight:delta}[event.key]??0))),height:Math.max(1,Math.round(r.height+({ArrowUp:-delta,ArrowDown:delta}[event.key]??0)))});});
    overlay.append(handle);
  }
  function highlight(){if(!overlay||!selected?.element)return;const r=selected.element.getBoundingClientRect();Object.assign(overlay.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
  function select(id){selected=resolve(id);if(!selected)throw new Error('Visual selection is no longer available');
    if(globalThis.document){if(!overlay){overlay=document.createElement('div');overlay.setAttribute('role','group');overlay.setAttribute('aria-label','Design selection');overlay.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #7666eb;box-sizing:border-box;background:#7666eb0d';document.body.append(overlay);resizeHandle();}
      resizeObserver?.disconnect();if(globalThis.ResizeObserver){resizeObserver=new ResizeObserver(highlight);resizeObserver.observe(selected.element);}highlight();}
    const result=inspect(id);emit('selected',result);return result;
  }
  function pointer(event){if(!picking)return;const path=event.composedPath?.()??[];const item=registry().filter(({c})=>path.includes(c.element)).sort((a,b)=>path.indexOf(a.c.element)-path.indexOf(b.c.element))[0];if(item){event.preventDefault();event.stopImmediatePropagation();if(event.type==='click')select(item.c.uid);}}
  globalThis.document?.addEventListener('pointerdown',pointer,true);globalThis.document?.addEventListener('click',pointer,true);globalThis.addEventListener?.('scroll',highlight,true);
  function applyReload(plan,methods){
    if(co.busy)throw new Error('Finish or cancel active debug invocations before hot reload');
    if(!plan.compatible||plan.revision!==revision+1)throw new Error('Stale or incompatible hot reload');
    const all=registry().map(e=>e.c),changes=[],descriptors=[],environmentChanges=[];
    const targets=p=>{
      const matches=all.filter(c=>{const o=origins.get(c);return o?.file===p.file&&o.offset===p.offset;});
      if(!matches.length)throw new Error('Reload target is not live: '+p.file+':'+p.offset);return matches;
    };
    for(const p of plan.patches){
      if(!liveProperties.has(p.property)&&!eventNames.includes(p.property))throw new Error('Non-live property in reload');
      for(const c of targets(p)){
        if(c.GetValue(p.property)?.uid)throw new Error('Restart required: property owns a live visual');
        changes.push({c,p});
      }
    }
    for(const p of plan.environments??[])for(const c of targets(p))environmentChanges.push({c,p});
    environmentChanges.sort((a,b)=>(a.p.property==='Resources'?0:1)-(b.p.property==='Resources'?0:1));
    for(const m of methods){const Type=JB.types.get(m.type),target=m.static?Type:Type?.prototype,d=target&&Object.getOwnPropertyDescriptor(target,m.name);if(!d||!d.configurable||typeof d.value!=='function')throw new Error('Reload method shape no longer matches');descriptors.push({target,name:m.name,descriptor:d,fn:m.fn});}
    const values=new Map(all.map(c=>[c,new Map([...c._values].map(([k,v])=>[k,new Map(v)]))]));
    reloading=true;let structure,templates;const attributes=[],environments=[];
    try{
      templates=beginTemplateTransaction(all);
      structure=prepareStructure(JB,plan.structures,all,c=>origins.get(c));
      for(const {c,p}of environmentChanges){const t=JB.prepareXamlEnvironment(c,p.property,p.node);environments.push(t);t.apply();}
      structure.apply();
      for(const {c,p}of changes){const t=JB.prepareXamlAttribute(c,p.property,p.value,p.remove);attributes.push(t);t.apply();}
      for(const m of descriptors)Object.defineProperty(m.target,m.name,{...m.descriptor,value:m.fn});
      for(const c of all)c.invalidate('*');JB.flushLayout();
    }catch(error){
      const attempt=fn=>{try{fn();}catch(e){emit('reload-warning',{message:'Rollback: '+e.message});}};
      for(const t of attributes)attempt(()=>t.suspend());
      for(const t of [...environments].reverse())attempt(()=>t.rollback());
      if(structure)attempt(()=>structure.rollback());
      for(const t of attributes)attempt(()=>t.rollback());
      for(const [c,value]of values){c._values=value;c.invalidate('*');}
      for(const m of descriptors)Object.defineProperty(m.target,m.name,m.descriptor);
      templates?.rollback();for(const t of environments)attempt(()=>t.finalize());
      attempt(()=>JB.flushLayout());structure?.settle();reloading=false;emit('reload-error',{message:error.message,revision});throw error;
    }
    for(const m of methods)if(m.generator)co.register(JB.types.get(m.type),[{...m,fn:m.generator}]);
    for(const doc of plan.documents)JB.documents.set(doc.className??doc.path,doc);
    for(const c of all){const origin=origins.get(c),location=plan.locations?.find(l=>l.file===origin?.file&&l.offset===origin.offset);if(location)origins.set(c,location.next);}
    for(const c of all)if(c._xamlLoaded){const updated=plan.documents.find(d=>d.path===c._xamlLoaded.path);if(updated)c._xamlLoaded=updated;}
    configure({debug:plan.debug});revision=plan.revision;
    const warn=message=>emit('reload-warning',{message,revision});
    templates.finalize(warn);for(const t of environments)t.finalize();structure.finalize(warn);reloading=false;
    if(selected?._disposed){selected=null;overlay?.remove();overlay=null;resizeObserver?.disconnect();}
    emit('reloaded',{revision,properties:changes.length,methods:methods.length,environments:environmentChanges.length,added:structure.added,removed:structure.removed,panels:structure.groups});emit('tree',tree());highlight();return {revision};
  }
  const api={co,handler:(object,name)=>co.eventFunction(JB.method(object,name)),configure,hit,inspect,tree,select,applyReload,watchResults,
    read(fn){try{return fn();}catch{return '[unavailable]';}},
    throwing(error,point){emit('debug-exception',{point,error:snapshot(error),message:error?.message??String(error),stack:error?.stack});if(!co.active&&breakOnThrow&&nativeBreaks){debugger;}return error;},
    get revision(){return revision;},
    register(control,source){if(control?.uid){origins.set(control,{...source});if(!co.active&&source.language==='xaml'&&hitPoint(source,()=>({this:control}))) {debugger;}}return control;},
    created(value,source){if(value?.uid){origins.set(value,{...source});emit('constructed',{id:value.uid,source});}return value;},
    binding(control,name,spec){let map=bindings.get(control);if(!map){map={};bindings.set(control,map);}map[name]=snapshot(spec);},
    breakNext(){breakNext=true;},
    pick(value){picking=!!value;if(!picking){overlay?.remove();overlay=null;}return picking;},
    refresh(){emit('tree',tree());if(selected&&!selected._disposed)emit('selected',inspect(selected.uid));},
    dispose(){co.dispose();if(inputRoot){inputRoot.inert=inputInert;inputRoot=null;}disposed=true;lastLocals=null;selected=null;breakpoints=[];watches=[];points.clear();overlay?.remove();resizeObserver?.disconnect();globalThis.document?.removeEventListener('pointerdown',pointer,true);globalThis.document?.removeEventListener('click',pointer,true);globalThis.removeEventListener?.('scroll',highlight,true);if(JB.dev===api){JB.method=originalMethod;JB.eventAdd=originalAdd;JB.eventRemove=originalRemove;delete JB.dev;}}
  };
  return api;
}
