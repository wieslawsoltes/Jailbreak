/** Bounded, preimage-checked source edit history, independent of design transactions. */
export class SourceHistory{
  constructor({maxBytes=8*1024*1024,maxEntries=100,groupMs=500}={}){this.maxBytes=maxBytes;this.maxEntries=maxEntries;this.groupMs=groupMs;this.files=new Map();this.tick=0;}
  state(path){return this.files.get(path)??{undo:[],redo:[],tick:0};}
  record(path,before,after,{start=0,end=start,inputType='',now=Date.now()}={}){
    if(before===after)return;let state=this.state(path),last=state.undo.at(-1);if(last&&last.after!==before)state={undo:[],redo:[]};
    const join=last&&inputType==='insertText'&&last.kind===inputType&&now-last.time<this.groupMs&&last.after===before;
    const entry=join?{...last,after,time:now}:{before,after,start,end,time:now,kind:inputType};if(join)state.undo.pop();state.undo.push(entry);state.redo=[];state.tick=++this.tick;this.files.set(path,state);this.trim();
  }
  trim(){let bytes=0;for(const s of this.files.values()){while(s.undo.length>this.maxEntries)s.undo.shift();bytes+=[...s.undo,...s.redo].reduce((n,e)=>n+2*(e.before.length+e.after.length),0);}
    while(bytes>this.maxBytes){const candidates=[...this.files.values()].filter(s=>s.undo.length||s.redo.length).sort((a,b)=>a.tick-b.tick),s=candidates[0];if(!s)break;const e=s.undo.length?s.undo.shift():s.redo.shift();bytes-=2*(e.before.length+e.after.length);}
  }
  apply(path,current,direction){const s=this.state(path),from=direction==='undo'?s.undo:s.redo,to=direction==='undo'?s.redo:s.undo,e=from.at(-1);if(!e)return null;const before=direction==='undo'?e.after:e.before;if(current!==before)throw new Error('Source changed outside this edit history; no stale undo was applied.');from.pop();to.push(e);return {text:direction==='undo'?e.before:e.after,start:e.start,end:e.end};}
  forget(path){this.files.delete(path);}clear(){this.files.clear();}
}
