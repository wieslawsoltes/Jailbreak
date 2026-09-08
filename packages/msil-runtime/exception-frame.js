/** Per-call unwind continuations for emitted JS blocks; this module never decodes IL. */
export class ExecutionLimitError extends Error {}
const inside=(c,pc,handler=false)=>handler?
  c.handlerOffset<=pc&&pc<c.handlerOffset+c.handlerLength:
  c.tryOffset<=pc&&pc<c.tryOffset+c.tryLength;

export function createExceptionFrame(clauses,matches,{fatal=e=>e instanceof ExecutionLimitError}={}){
  const ordered=[...clauses].sort((a,b)=>a.tryLength-b.tryLength||a.id-b.id);
  const pending=[],caught=new Map();
  function finish(outcome){
    if(outcome.kind==='catch')caught.set(outcome.id,outcome.error);
    return outcome;
  }
  function advance(frame){
    const next=frame.todo.shift();
    if(next){frame.current=next;return {kind:'goto',target:next.handlerOffset};}
    if(pending.pop()!==frame)throw new Error('Invalid exception continuation stack');
    return finish(frame.outcome);
  }
  function transfer(from,outcome,exceptional){
    const to=outcome.target;
    // A cleanup may contain its own try/catch/finally. Preserve the enclosing
    // continuation while handling an exception locally within that cleanup.
    while(pending.length&&!inside(pending.at(-1).current,to,true))pending.pop();
    const todo=ordered.filter(c=>(c.kind==='finally'||exceptional&&c.kind==='fault')&&inside(c,from)&&!inside(c,to));
    if(!todo.length)return finish(outcome);
    const frame={todo,outcome,current:null};pending.push(frame);return advance(frame);
  }
  return {
    raise(error,from){
      if(fatal(error))return {kind:'throw',error};
      const handler=ordered.find(c=>c.kind==='catch'&&inside(c,from)&&matches(error,c.catchType));
      return transfer(from,handler?{kind:'catch',id:handler.id,target:handler.handlerOffset,error}:{kind:'throw',error},true);
    },
    leave(from,target){return transfer(from,{kind:'goto',target},false);},
    endFinally(from){
      const frame=pending.at(-1);
      if(!frame||!inside(frame.current,from,true))throw new Error('endfinally without an active unwind');
      return advance(frame);
    },
    rethrow(from){
      const handler=clauses.filter(c=>c.kind==='catch'&&inside(c,from,true)).sort((a,b)=>a.handlerLength-b.handlerLength)[0];
      if(!handler||!caught.has(handler.id))throw new Error('rethrow without an active catch');
      return caught.get(handler.id);
    }
  };
}
