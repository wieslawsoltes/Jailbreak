/** Exact, bounded workspace transactions shared by source edits, designer edits and refactors.
 * Source records are ordinary UTF-16 strings; null denotes an absent file, not empty text.
 */
const own=(o,k)=>Object.hasOwn(o,k), value=(o,k)=>own(o,k)?o[k]:null;
export function sourcePath(path){
  if(typeof path!=='string'||!path||path.length>1024||path.startsWith('/')||/[\\\x00-\x1f:]/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..'||['.git','__proto__','constructor','prototype'].includes(p)))throw new Error('Invalid relative source path');
  return path;
}
export function snapshotFiles(files,{maxFiles=2000,maxChars=16000000}={}){
  if(!files||typeof files!=='object'||Array.isArray(files))throw new TypeError('Expected a source file map');
  const out=Object.create(null),entries=Object.entries(Object.getOwnPropertyDescriptors(files));let chars=0;
  if(entries.length>maxFiles)throw new Error('Workspace file budget exceeded');
  for(const [path,d]of entries){sourcePath(path);if(!own(d,'value')||typeof d.value!=='string')throw new Error('Sources must be data properties containing text');if((chars+=d.value.length)>maxChars||d.value.length>4000000)throw new Error('Workspace source budget exceeded');out[path]=d.value;}
  return out;
}
export function workspaceChanges(before,after){
  const paths=new Set([...Object.keys(before),...Object.keys(after)]),changes=[];
  for(const path of [...paths].sort())if(value(before,path)!==value(after,path))changes.push({path,before:value(before,path),after:value(after,path)});
  return changes;
}
export function sourceTransaction(changes,label='Edit workspace'){
  if(!Array.isArray(changes)||changes.length>2000||typeof label!=='string'||label.length>240)throw new Error('Invalid source transaction');
  const seen=new Set();let size=0;
  const items=changes.map(c=>{
    sourcePath(c.path);if(seen.has(c.path))throw new Error('Duplicate transaction path');seen.add(c.path);
    for(const text of [c.before,c.after]){if(text!==null&&typeof text!=='string')throw new Error('Transaction preimages must be text or null');if(text!==null){size+=text.length;if(text.length>4000000)throw new Error('Transaction source budget exceeded');}}
    return Object.freeze({path:c.path,before:c.before,after:c.after});
  }).filter(c=>c.before!==c.after);
  if(size>32000000)throw new Error('Source transaction budget exceeded');
  return Object.freeze({label,changes:Object.freeze(items)});
}
/** All preimages, path collisions, source budgets and descriptors are checked before any write. */
export function applySourceTransaction(files,transaction,direction='forward'){
  if(!['forward','reverse'].includes(direction))throw new Error('Invalid transaction direction');
  const tx=sourceTransaction(transaction.changes,transaction.label),old=snapshotFiles(files),next={...old},reverse=direction==='reverse';
  for(const c of tx.changes){const expected=reverse?c.after:c.before,desired=reverse?c.before:c.after;if(value(old,c.path)!==expected)throw new Error('Source changed since transaction was prepared: '+c.path);if(desired===null)delete next[c.path];else next[c.path]=desired;}
  snapshotFiles(next);
  const identities=new Set();for(const p of Object.keys(next)){const key=p.toLowerCase();if(identities.has(key))throw new Error('Case-insensitive source path collision');identities.add(key);}
  const descriptors=new Map();for(const c of tx.changes){const d=Object.getOwnPropertyDescriptor(files,c.path);if(d&&(!d.configurable||!d.writable)||!d&&!Object.isExtensible(files))throw new Error('Workspace source map is not writable');descriptors.set(c.path,d);}
  try{for(const c of tx.changes){const text=reverse?c.before:c.after;if(text===null)delete files[c.path];else Object.defineProperty(files,c.path,{value:text,enumerable:true,writable:true,configurable:true});}}
  catch(error){for(const [p,d]of descriptors){if(d)Object.defineProperty(files,p,d);else delete files[p];}throw error;}
  return tx;
}
export class WorkspaceJournal{
  constructor({maxHistoryBytes=16*1024*1024,maxEntries=100,maxCheckpoints=8,maxCheckpointChars=16000000}={}){
    if(!Number.isSafeInteger(maxHistoryBytes)||maxHistoryBytes<0||!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>10000||!Number.isInteger(maxCheckpoints)||maxCheckpoints<1||maxCheckpoints>100||!Number.isSafeInteger(maxCheckpointChars)||maxCheckpointChars<1)throw new Error('Invalid journal limits');
    this.limits={maxHistoryBytes,maxEntries,maxCheckpoints,maxCheckpointChars};this.listeners=new Set();this.sequence=0;this.reset({});
  }
  reset(files,label='Opened workspace'){this.current=snapshotFiles(files);this.undoStack=[];this.redoStack=[];this.checkpoints=[];this.checkpoint(files,label);this.emit();}
  subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
  emit(){for(const fn of this.listeners)try{fn(this.state());}catch{/* A UI listener cannot roll back a completed edit. */}}
  state(){return {undo:this.undoStack.at(-1)?.label??null,redo:this.redoStack.at(-1)?.label??null,checkpoints:this.checkpoints.map(({id,label,time})=>({id,label,time})),revision:this.sequence};}
  observe(files,label='Edit source',{group='',time=Date.now()}={}){
    const next=snapshotFiles(files),changes=workspaceChanges(this.current,next);if(!changes.length)return null;
    const tx=sourceTransaction(changes,label),last=this.undoStack.at(-1);
    if(group==='insertText'&&last?.group===group&&time>=last.time&&time-last.time<500&&changes.length===1&&last.changes.length===1&&changes[0].path===last.changes[0].path&&changes[0].before===last.changes[0].after){this.undoStack.pop();this.push(sourceTransaction([{...changes[0],before:last.changes[0].before}],label),group,time);}
    else this.push(tx,group,time);
    this.current=next;this.emit();return tx;
  }
  push(tx,group='',time=Date.now()){
    this.undoStack.push(Object.freeze({...tx,group,time}));this.redoStack=[];this.sequence++;
    while(this.undoStack.length>this.limits.maxEntries)this.undoStack.shift();
    let bytes=this.undoStack.reduce((n,t)=>n+t.changes.reduce((m,c)=>m+2*((c.before?.length??0)+(c.after?.length??0)),0),0);
    while(bytes>this.limits.maxHistoryBytes&&this.undoStack.length){const t=this.undoStack.shift();bytes-=t.changes.reduce((n,c)=>n+2*((c.before?.length??0)+(c.after?.length??0)),0);}
  }
  commit(files,transaction){
    this.observe(files,'External source edit');const tx=applySourceTransaction(files,transaction);if(!tx.changes.length)return tx;
    this.current=snapshotFiles(files);this.push(tx);this.emit();return tx;
  }
  apply(files,direction){
    if(!['undo','redo'].includes(direction))throw new Error('Invalid history direction');
    if(workspaceChanges(this.current,snapshotFiles(files)).length)throw new Error('Unrecorded source changes; refusing stale undo');
    const from=direction==='undo'?this.undoStack:this.redoStack,to=direction==='undo'?this.redoStack:this.undoStack,tx=from.at(-1);if(!tx)return null;
    applySourceTransaction(files,tx,direction==='undo'?'reverse':'forward');from.pop();to.push(tx);this.current=snapshotFiles(files);this.sequence++;this.emit();return tx;
  }
  checkpoint(files,label='Checkpoint'){
    if(typeof label!=='string'||!label.trim()||label.length>120)throw new Error('Use a checkpoint label up to 120 characters');
    const source=snapshotFiles(files),size=Object.values(source).reduce((n,t)=>n+t.length,0);if(size>this.limits.maxCheckpointChars)throw new Error('Checkpoint budget exceeded');
    const checkpoint={id:++this.sequence,label,time:Date.now(),source,size};this.checkpoints.push(checkpoint);
    let chars=this.checkpoints.reduce((n,c)=>n+c.size,0);while(this.checkpoints.length>this.limits.maxCheckpoints||chars>this.limits.maxCheckpointChars){const removed=this.checkpoints.shift();chars-=removed.size;}
    this.emit();return checkpoint.id;
  }
  changes(files,id=this.checkpoints[0]?.id){const c=this.checkpoints.find(c=>c.id===id);if(!c)throw new Error('Checkpoint is no longer retained');return workspaceChanges(c.source,snapshotFiles(files));}
  restoreTransaction(files,id,paths=null){const all=this.changes(files,id),selected=paths?new Set(paths):null;return sourceTransaction(all.filter(c=>!selected||selected.has(c.path)).map(c=>({path:c.path,before:c.after,after:c.before})),'Restore checkpoint');}
  exportChanges(files,id){return JSON.stringify({format:'jailbreak-source-changes-v1',...sourceTransaction(this.changes(files,id),'Import reviewed changes')},null,2);}
  importChanges(files,json){if(typeof json!=='string'||json.length>64000000)throw new Error('Change-set budget exceeded');const data=JSON.parse(json);if(data.format!=='jailbreak-source-changes-v1')throw new Error('Unknown source change format');return this.commit(files,sourceTransaction(data.changes,data.label));}
}
