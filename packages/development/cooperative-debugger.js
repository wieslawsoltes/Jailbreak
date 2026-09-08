import {snapshot,readWatch} from './watch.js';
/** Runs compiled generator continuations, not an AST/IL interpreter. Native APIs are step-over regions. */
export function createCooperativeDebugger({point,breakpoint=()=>false,breakOnThrow=()=>false,report=()=>{},quantum=1000,maxSteps=1000000,maxFrames=512,maxTasks=32}={}){
  const methods=new WeakMap(),bound=new WeakMap(),handlers=new WeakMap(),tasks=new Map();
  let current=null,nextTask=1,nextFrame=1,disposed=false;
  if(!Number.isSafeInteger(quantum)||quantum<1||!Number.isSafeInteger(maxSteps)||maxSteps<1||!Number.isSafeInteger(maxFrames)||maxFrames<1||!Number.isSafeInteger(maxTasks)||maxTasks<1)throw new RangeError('Debugger budgets must be positive integers');
  const emit=(event,payload)=>{if(!disposed)try{report(event,payload);}catch{}};
  function find(object,name,arity,method=object?.[name]){
    if(object==null)return null;
    for(let p=object;p;p=Object.getPrototypeOf(p)){
      const map=methods.get(p),entry=map?.get(name)??map?.get(name+'$'+arity);
      if(entry&&(entry.name===name?method:object[entry.name])===entry.original)return entry;
    }return null;
  }
  function register(Type,entries){
    for(const entry of entries){
      if(typeof entry.fn!=='function')throw new Error('Missing compiled continuation');
      const target=entry.static?Type:Type.prototype;let map=methods.get(target);if(!map)methods.set(target,map=new Map());
      map.set(entry.name,{...entry,original:target[entry.name]});
    }
  }
  const read=frame=>{try{return frame?.locals?.()??{};}catch(e){return {'[unavailable]':e.message};}};
  function frameView(frame){return {id:frame.id,method:frame.method,point:frame.point,locals:snapshot(read(frame)),editable:Object.keys(frame.setters??{})};}
  function paused(task){
    return {taskId:task.id,parentTaskId:task.parent,point:task.point,reason:task.reason,frames:task.frames.slice().reverse().map(frameView)};
  }
  function finish(task,error,value){
    tasks.delete(task.id);task.status=error?'failed':task.cancelling?'cancelled':'completed';
    if(task.outToParent){const parent=tasks.get(task.parent);if(parent)parent.step={mode:'into',depth:0};}
    emit('debug-completed',{taskId:task.id,status:task.status,value:snapshot(value),error:error?{message:error.message,stack:error.stack}:null});
    const {resolve,reject}=task;task.epoch++;task.frames=[];task.iterator=null;task.resolve=null;task.reject=null;task.point=null;
    if(error)reject(error);else resolve(value);
  }
  function drive(task,input,action='next'){
    if(!tasks.has(task.id)||task.status==='paused')return;
    const previous=current;current=task;task.status='running';
    try{
      for(let slice=0;slice<quantum;slice++){
        const item=task.iterator[action](input);input=undefined;action='next';
        if(item.done){finish(task,task.terminalError,item.value);return;}
        if(!task.cancelling&&++task.steps>maxSteps){task.cancelling=true;task.terminalError=new Error('Cooperative execution budget exhausted');action='return';continue;}
        if(task.cancelling&&++task.cleanup>10000)throw new Error('Debug cancellation cleanup budget exhausted');
        const value=item.value;
        if(value?.kind==='await'){
          task.status='awaiting';const epoch=++task.epoch;Promise.resolve(value.value).then(v=>{if(task.epoch===epoch)drive(task,v);},e=>{if(task.epoch===epoch)drive(task,e,'throw');});return;
        }
        if(value?.kind!=='checkpoint'&&value?.kind!=='exception')throw new Error('Invalid compiled continuation yield');
        const frame=task.frames.at(-1);if(frame){frame.locals=value.locals??frame.locals;frame.setters=value.setters??{};frame.types=value.types??{};frame.point=value.point??point(value.id);}
        task.point=value.point??point(value.id);
        const stop=task.cancelling?false:value.kind==='exception'?breakOnThrow():breakpoint(task.point,()=>read(frame));
        const step=task.step,depth=task.frames.length;
        const stepping=step&&(step.mode==='into'||step.mode==='over'&&depth<=step.depth||step.mode==='out'&&depth<step.depth);
        if(!task.cancelling&&(stop||stepping)){
          task.status='paused';task.reason=value.kind==='exception'?'exception':stop?'breakpoint':'step';task.step=null;
          emit('debug-paused',paused(task));return;
        }
      }
      task.status='scheduled';const epoch=++task.epoch;setTimeout(()=>{if(task.epoch===epoch)drive(task);},0);
    }catch(error){finish(task,error);}
    finally{current=previous;}
  }
  function launch(iterator,options={}){
    if(disposed&&!current?.cancelling)throw new Error('Debugger session is disposed');
    if(tasks.size>=maxTasks)throw new Error('Too many concurrent debug invocations');
    let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
    const task={id:nextTask++,iterator,frames:[],status:'scheduled',steps:0,cleanup:0,epoch:0,resolve,reject,parent:current?.id??null,step:options.breakOnEntry?{mode:'into',depth:0}:null};
    tasks.set(task.id,task);emit('debug-started',{taskId:task.id,parentTaskId:task.parent});drive(task);
    return {taskId:task.id,promise};
  }
  function* invoke(object,name,args,optional=false,method=object?.[name]){
    if(object==null){if(optional)return undefined;throw new TypeError('Cannot call a method on null');}
    const entry=find(object,name,args.length,method);
    if(entry){
      if(entry.async){const stepping=current?.step?.mode==='into';if(stepping)current.step=null;return launch(entry.fn.call(object,api,...args),{breakOnEntry:stepping}).promise;}
      return yield* entry.fn.call(object,api,...args);
    }
    return Reflect.apply(method,object,args);
  }
  function* call(fn,args){const binding=bound.get(fn);if(binding)return yield* invoke(binding.object,binding.name,args);return fn(...args);}
  function start(object,name,args=[],options={}){
    const entry=find(object,name,args.length);if(!entry)throw new Error('Method has no compiled continuation: '+name);
    return launch(entry.fn.call(object,api,...args),options);
  }
  function eventFunction(fn){
    const binding=bound.get(fn);if(!binding)return fn;
    let handler=handlers.get(fn);
    if(!handler){handler=(...args)=>{
      if(!find(binding.object,binding.name,args.length))return fn(...args);
      const task=start(binding.object,binding.name,args);task.promise.catch(()=>{});return task.promise;
    };handlers.set(fn,handler);}return handler;
  }
  function command(taskId,action){
    const task=tasks.get(Number(taskId));if(!task)throw new Error('Debug invocation no longer exists');
    if(action==='cancel'){
      if(task.cancelling)return;
      task.epoch++;task.cancelling=true;task.status='running';task.step=null;drive(task,undefined,'return');return;
    }
    if(!['continue','into','over','out'].includes(action))throw new Error('Unknown debugger action');
    if(task.status!=='paused')throw new Error('Debug invocation is not paused');
    task.step=action==='continue'?null:{mode:action,depth:task.frames.length};
    if(action==='out'&&task.frames.length===1)task.outToParent=true;
    task.status='scheduled';emit('debug-resumed',{taskId:task.id});drive(task);
  }
  function frame(taskId,frameId){const task=tasks.get(Number(taskId));if(task?.status!=='paused')throw new Error('The invocation must be paused');const f=task.frames.find(f=>f.id===Number(frameId));if(!f)throw new Error('Stale call frame');return {task,frame:f};}
  function inspectFrame(taskId,frameId,paths=[]){
    const {frame:f}=frame(taskId,frameId);return {...frameView(f),taskId:Number(taskId),watches:paths.slice(0,50).map(path=>{try{return {path,value:snapshot(readWatch(read(f),path))};}catch(e){return {path,error:e.message};}})};
  }
  function setLocal(taskId,frameId,name,value){
    const {task,frame:f}=frame(taskId,frameId),old=Object.getOwnPropertyDescriptor(read(f),name)?.value;
    if(!Object.hasOwn(f.setters??{},name))throw new Error('Local is read-only or not in scope');
    if(!['string','boolean','number'].includes(typeof value)||typeof value!==typeof old||typeof value==='number'&&!Number.isFinite(value))throw new Error('Local updates require a scalar of the existing type');
    const ranges={byte:[0,255],sbyte:[-128,127],short:[-32768,32767],ushort:[0,65535],int:[-2147483648,2147483647],uint:[0,4294967295]};
    if(f.types?.[name]==='char'&&value.length!==1)throw new Error('A char local requires one UTF-16 character');
    const range=ranges[f.types?.[name]];
    if(range&&(!Number.isInteger(value)||value<range[0]||value>range[1]))throw new Error('Local value is outside its managed integer type');
    f.setters[name](value);emit('debug-paused',paused(task));
  }
  const api={register,invoke,call,start,eventFunction,command,inspectFrame,setLocal,
    read(fn){try{return fn();}catch{return '[unavailable]';}},
    reference(object,name,optional=false){if(optional&&object==null)return null;if(object==null)throw new TypeError('Cannot call a method on null');return {object,name,method:object[name]};},
    *applyReference(ref,args){if(!ref)return undefined;return yield* invoke(ref.object,ref.name,yield* args,false,ref.method);},
    rememberBound(fn,object,name){bound.set(fn,{object,name});return fn;},
    checkpoint(id,locals,setters={},types={}){return {kind:'checkpoint',id,locals,setters,types};},
    awaitValue(value){return {kind:'await',value};},
    *throwing(error,location){yield {kind:'exception',point:location};return error;},
    enter(method){if(!current)throw new Error('Continuation needs an active invocation');if(current.frames.length>=maxFrames)throw new Error('Debug frame limit exceeded');const frame={id:nextFrame++,method};current.frames.push(frame);return frame;},
    leave(frame){if(current?.frames.at(-1)!==frame)throw new Error('Debug call stack is inconsistent');current.frames.pop();},
    get active(){return current!==null;},get busy(){return tasks.size!==0;},
    state(){return [...tasks.values()].map(t=>({taskId:t.id,status:t.status,point:t.point,frames:t.frames.length}));},
    dispose(){for(const t of [...tasks.values()])if(tasks.has(t.id))command(t.id,'cancel');disposed=true;}
  };
  return api;
}
