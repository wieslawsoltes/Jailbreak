import {ExecutionLimitError} from './exception-frame.js';
/** AOT continuation dispatch. IL bytes/opcodes are never read here. A budget is
 * owned by a debugger task and remains independent while other tasks execute. */
export function createBinaryContinuations({assemblies,types,D,resolve,dispatch,choose,findType,allocate,coerce,publicResult,instructionBudget,maxDepth}) {
  const contextKey={};
  const budget=co=>co.context(contextKey,()=>({remaining:instructionBudget,depth:0,cleanup:10000}));
  function tick(co,state,cost=1){
    const key=co.cancelling?'cleanup':'remaining';state[key]-=cost;
    if(state[key]<0)throw new ExecutionLimitError('Binary '+(co.cancelling?'cleanup':'instruction')+' budget exceeded');
  }
  function* initialize(co,state,type){
    if(type.state==='done')return;
    if(type.state==='failed')throw type.error;
    if(type.state==='busy'){
      if(type.initializer?.owner===state||!type.initializer)return;
      yield co.awaitValue(type.initializer.promise);return;
    }
    let resolveInit,rejectInit,complete=false,error;
    const promise=new Promise((resolve,reject)=>{resolveInit=resolve;rejectInit=reject;});promise.catch(()=>{});
    type.state='busy';type.initializer={owner:state,promise};
    try{
      if(type.base)yield* initialize(co,state,type.base);
      const m=type.context.descriptor.methods.find(m=>m.owner===type.record.name&&m.name==='.cctor');
      if(m)yield* invoke(co,state,type.context,m,null,[],false,true);
      complete=true;
    }catch(e){error=e;throw e;}
    finally{
      type.initializer=null;
      if(complete){type.state='done';resolveInit();}
      else {type.state='failed';type.error=error??new D.InvalidOperationException('Binary type initialization cancelled');rejectInit(type.error);}
    }
  }
  function* invoke(co,state,context,m,self,args,virtual=false,initializing=false){
    ({context,m}=dispatch(context,m,self,args,virtual));
    if(!initializing&&(m.static||m.name==='.ctor'))yield* initialize(co,state,findType(context.descriptor.name,m.owner));
    if(++state.depth>maxDepth){state.depth--;throw new ExecutionLimitError('Binary recursion budget exceeded');}
    let frame;
    try{
      frame=co.enter(m.owner+'.'+m.name);
      const fn=context.continuations?.[m.token];
      if(typeof fn!=='function')throw new D.NotSupportedException('Method was not compiled for cooperative debugging');
      return yield* fn(co,state,self,args.map((v,i)=>coerce(m.signature.parameters[i],v)));
    }finally{state.depth--;if(frame)co.leave(frame);}
  }
  function* call(co,state,context,token,self,args,virtual=false){
    const target=resolve(context,token,'method');
    if(target.adapter)return context.call(token,self,args,virtual);
    return yield* invoke(co,state,target.context,target.record,self,args,virtual);
  }
  function* construct(co,state,context,token,args){
    const target=resolve(context,token,'method');
    if(target.adapter)return context.construct(token,args);
    const type=findType(target.context.descriptor.name,target.record.owner);
    yield* initialize(co,state,type);
    const object=allocate(type,false);
    yield* invoke(co,state,target.context,target.record,object,args);return object;
  }
  function* field(co,state,context,token,self,value,write=false){
    const target=resolve(context,token,'field');
    if(target.record.static)yield* initialize(co,state,findType(target.context.descriptor.name,target.record.owner));
    return context.field(token,self,value,write,true);
  }
  function attach(co){
    for(const type of types.values()){
      if(!type.context.continuations)continue;
      const publicMethods=type.context.descriptor.methods.filter(m=>m.owner===type.record.name&&(m.flags&7)===6&&m.name[0]!=='.');
      const groups=new Map(publicMethods.map(m=>[m.name+'|'+m.static,m]));
      co.register(type.wrapper,[...groups.values()].map(m=>({name:m.name,static:m.static,fn:function*($co,...args){
        const selected=choose(type,m.name,args,m.static);
        return publicResult(selected,yield* invoke($co,budget($co),type.context,selected,m.static?null:this,args,!m.static));
      }})));
      co.registerConstructor(type.wrapper,function*($co,args,newTarget){
        if(newTarget!==type.wrapper)throw new D.NotSupportedException('Source inheritance from binary classes is not supported by continuation allocation');
        const m=choose(type,'.ctor',args,false);return yield* construct($co,budget($co),type.context,m.token,args);
      });
    }
  }
  return {tick,call,construct,field,attach,
    *entry(co,assembly,token,args=[],self=null){
      const context=assemblies.get(assembly),m=context?.records.get(token);
      if(!m?.signature)throw new D.ArgumentException('Unknown binary method token');
      return publicResult(m,yield* invoke(co,budget(co),context,m,self,args,!m.static));
    }
  };
}
