/** Observable, lazy resource dictionaries with last-merged precedence and cycle checks. */
class DeferredResource {
  constructor(factory){this.factory=factory;this.busy=false;this.ready=false;}
  get(){if(this.ready)return this.value;if(this.busy)throw new Error('JB3010: Cyclic StaticResource dependency');this.busy=true;try{this.value=this.factory();this.ready=true;this.factory=null;return this.value;}finally{this.busy=false;}}
}
class MergedResources {
  constructor(owner){this.owner=owner;this.items=[];this.disposers=new Map();}
  get Count(){return this.items.length;}get length(){return this.Count;}[Symbol.iterator](){return this.items[Symbol.iterator]();}
  Add(dictionary){
    if(!(dictionary instanceof ResourceDictionary))throw new TypeError('Merged resources require ResourceDictionary');
    const seen=new Set(),contains=d=>{if(d===this.owner)return true;if(seen.has(d))return false;seen.add(d);return [...d.MergedDictionaries].some(contains);};
    if(contains(dictionary))throw new Error('JB3011: Merged resource cycle');
    if(this.items.includes(dictionary))throw new Error('Duplicate merged dictionary instance');
    this.items.push(dictionary);this.disposers.set(dictionary,dictionary.subscribe(key=>{if(!Map.prototype.has.call(this.owner,key))this.owner.changed(key);}));
    for(const key of dictionary.keys())this.owner.changed(key);return this.Count-1;
  }
  Remove(dictionary){const index=this.items.indexOf(dictionary);if(index<0)return false;const keys=[...dictionary.keys()];this.items.splice(index,1);this.disposers.get(dictionary)?.();this.disposers.delete(dictionary);for(const key of keys)this.owner.changed(key);return true;}
  Clear(){for(const dictionary of [...this.items])this.Remove(dictionary);}
}
export class ResourceDictionary extends Map {
  constructor(entries=[]){super();this.listeners=new Set();this.MergedDictionaries=new MergedResources(this);for(const [key,value]of entries)this.set(key,value);}
  changed(key){for(const callback of [...this.listeners])callback(key);}
  set(key,value){super.set(key,value);if(this.listeners)this.changed(key);return this;}
  defer(key,factory){if(Map.prototype.has.call(this,key))throw new Error('Duplicate resource '+String(key));Map.prototype.set.call(this,key,new DeferredResource(factory));this.changed(key);}
  has(key){return super.has(key)||[...this.MergedDictionaries].some(d=>d.has(key));}
  get(key){if(super.has(key)){const value=super.get(key);return value instanceof DeferredResource?value.get():value;}const merged=this.MergedDictionaries.items;for(let i=merged.length-1;i>=0;i--)if(merged[i].has(key))return merged[i].get(key);}
  Add(key,value){if(Map.prototype.has.call(this,key))throw new Error('Duplicate resource '+String(key));this.set(key,value);}
  Set(key,value){return this.set(key,value);}
  delete(key){const removed=super.delete(key);if(removed)this.changed(key);return removed;}
  clear(){const keys=[...Map.prototype.keys.call(this)];super.clear();for(const key of keys)this.changed(key);}
  *keys(){const seen=new Set();for(const key of super.keys()){seen.add(key);yield key;}for(const dictionary of [...this.MergedDictionaries].reverse())for(const key of dictionary.keys())if(!seen.has(key)){seen.add(key);yield key;}}
  *values(){for(const key of this.keys())yield this.get(key);}
  *entries(){for(const key of this.keys())yield [key,this.get(key)];}
  [Symbol.iterator](){return this.entries();}get Count(){return [...this.keys()].length;}
  subscribe(callback){this.listeners.add(callback);return()=>this.listeners.delete(callback);}
  snapshot(){return {entries:[...Map.prototype.entries.call(this)],merged:[...this.MergedDictionaries]};}
  replaceContents(state){
    const changed=new Set([...this.keys(),...state.entries.map(e=>e[0]),...state.merged.flatMap(d=>[...d.keys()])]);
    for(const off of this.MergedDictionaries.disposers.values())off();
    this.MergedDictionaries.items=[...state.merged];this.MergedDictionaries.disposers=new Map();
    Map.prototype.clear.call(this);for(const [key,value]of state.entries)Map.prototype.set.call(this,key,value);
    for(const d of state.merged)this.MergedDictionaries.disposers.set(d,d.subscribe(key=>{if(!Map.prototype.has.call(this,key))this.changed(key);}));
    for(const key of changed)this.changed(key);
  }
  Dispose(){this.MergedDictionaries.Clear();this.listeners.clear();super.clear();}
}
