/** Minimal managed-library adapters; no global prototype modification. */
export function createDotNet({log=(...args)=>console.log(...args)}={}) {
  class Event {
    constructor(){this.handlers=new Set();}
    Add(fn){if(typeof fn!=='function')throw new TypeError('Event handler must be a function');this.handlers.add(fn);return()=>this.handlers.delete(fn);}
    Remove(fn){this.handlers.delete(fn);}
    Invoke(...args){for(const h of [...this.handlers])h(...args);}
    get Count(){return this.handlers.size;}
  }
  class List extends Array {
    static get [Symbol.species](){return Array;}
    constructor(items){super();if(items!=null&&typeof items!=='number')this.push(...items);}
    get Count(){return this.length;}
    Add(item){this.push(item);return this.length-1;}
    AddRange(items){this.push(...items);}
    Remove(item){const i=this.indexOf(item);if(i<0)return false;this.splice(i,1);return true;}
    RemoveAt(i){this.check(i);this.splice(i,1);}
    Insert(i,item){if(i<0||i>this.length)throw new RangeError('Index out of range');this.splice(i,0,item);}
    Clear(){this.length=0;}
    Contains(item){return this.includes(item);}
    IndexOf(item){return this.indexOf(item);}
    ToArray(){return [...this];}
    check(i){if(!Number.isInteger(i)||i<0||i>=this.length)throw new RangeError('Index out of range');}
    get_Item(i){this.check(i);return this[i];}
    set_Item(i,v){this.check(i);this[i]=v;}
  }
  class ObservableCollection extends List {
    constructor(items){super(items);this.CollectionChanged=new Event();}
    changed(action,item,index){this.CollectionChanged.Invoke(this,{Action:action,NewItems:[item],NewStartingIndex:index});}
    Add(item){const i=super.Add(item);this.changed('Add',item,i);return i;}
    Remove(item){const i=this.indexOf(item);if(i<0)return false;super.RemoveAt(i);this.changed('Remove',item,i);return true;}
    RemoveAt(i){const item=this[i];super.RemoveAt(i);this.changed('Remove',item,i);}
    Insert(i,item){super.Insert(i,item);this.changed('Add',item,i);}
    Clear(){super.Clear();this.changed('Reset');}
    set_Item(i,value){super.set_Item(i,value);this.changed('Replace',value,i);}
    subscribe(fn){return this.CollectionChanged.Add(fn);}
  }
  class Dictionary extends Map {
    get Count(){return this.size;}
    get Keys(){return [...this.keys()];}
    get Values(){return [...this.values()];}
    Add(k,v){if(this.has(k))throw new Error('Duplicate dictionary key');this.set(k,v);}
    ContainsKey(k){return this.has(k);}
    Remove(k){return this.delete(k);}
    Clear(){this.clear();}
    get_Item(k){if(!this.has(k))throw new Error('Key not found');return this.get(k);}
    set_Item(k,v){this.set(k,v);}
  }
  class HashSet extends Set {get Count(){return this.size;}Add(v){const absent=!this.has(v);this.add(v);return absent;}Contains(v){return this.has(v);}Remove(v){return this.delete(v);}Clear(){this.clear();}}
  class RelayCommand {
    constructor(execute,canExecute=()=>true){if(typeof execute!=='function')throw new TypeError('Command execute must be callable');this.execute=execute;this.canExecute=canExecute;this.CanExecuteChanged=new Event();}
    CanExecute(p){return !!this.canExecute(p);}
    Execute(p){if(this.CanExecute(p))return this.execute(p);}
    NotifyCanExecuteChanged(){this.CanExecuteChanged.Invoke(this,{});}
    RaiseCanExecuteChanged(){this.NotifyCanExecuteChanged();}
  }
  const numberParse=(value,integer=false)=>{const s=String(value).trim();if(!(integer?/^[+-]?\d+$/:/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i).test(s))throw new Error('Input string was not in a correct format');const n=Number(s);if(!Number.isFinite(n))throw new RangeError('Numeric overflow');if(integer&&(n>2147483647||n<-2147483648))throw new RangeError('Int32 overflow');return n;};
  const StringAdapter={Empty:'',IsNullOrEmpty:v=>v==null||v==='',IsNullOrWhiteSpace:v=>v==null||/^\s*$/.test(v),Join:(separator,values)=>Array.from(values,x=>x??'').join(separator),Format:(format,...args)=>format.replace(/\{(\d+)(?::([^}]+))?\}/g,(_,i,f)=>formatValue(args[+i],f))};
  function formatValue(value,spec=''){
    if(value==null)return '';if(!spec)return String(value);
    const m=/^([fFnNdDxX])(\d*)$/.exec(spec);
    if(!m)throw new Error(`Unsupported numeric format ${spec}`);
    const digits=m[2]?Number(m[2]):2,n=Number(value);if(digits>20)throw new RangeError('Format precision exceeds supported range');
    if(/[fF]/.test(m[1]))return n.toFixed(digits);if(/[nN]/.test(m[1]))return n.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
    if(/[dD]/.test(m[1]))return Math.trunc(n).toString().padStart(m[2]?digits:1,'0');
    let hex=Math.trunc(n).toString(16).padStart(m[2]?digits:1,'0');return m[1]==='X'?hex.toUpperCase():hex;
  }
  const methodCache=new WeakMap();
  const api={Event,List,ObservableCollection,Dictionary,HashSet,RelayCommand,String:StringAdapter,
    Console:{WriteLine:(...args)=>log(...args),Write:(...args)=>log(...args)},
    Int32:{Parse:v=>numberParse(v,true),MaxValue:2147483647,MinValue:-2147483648},Double:{Parse:v=>numberParse(v),IsNaN:Number.isNaN},
    Boolean:{Parse:v=>{if(!/^(true|false)$/i.test(String(v)))throw new Error('Invalid Boolean');return String(v).toLowerCase()==='true';}},
    Task:{Delay:ms=>new Promise(resolve=>setTimeout(resolve,Number(ms))),FromResult:value=>Promise.resolve(value),WhenAll:tasks=>Promise.all(tasks),get CompletedTask(){return Promise.resolve();}},
    TimeSpan:{FromMilliseconds:n=>n,FromSeconds:n=>n*1000,FromMinutes:n=>n*60000},
    DateTime:{get Now(){return new Date();},get UtcNow(){return new Date();}},Guid:{NewGuid:()=>globalThis.crypto.randomUUID()},
    Dispatcher:{UIThread:{Post:fn=>queueMicrotask(fn),InvokeAsync:fn=>Promise.resolve().then(fn)}},
    format:formatValue,
    method(target,name){let methods=methodCache.get(target);if(!methods)methodCache.set(target,methods=new Map());const fn=target[name];const found=methods.get(name);if(found?.original===fn)return found.bound;if(typeof fn!=='function')throw new TypeError(`Not a method: ${name}`);const bound=fn.bind(target);methods.set(name,{original:fn,bound});return bound;},
    index(target,index){if(target==null)throw new TypeError('NullReferenceException');if(target.get_Item)return target.get_Item(index);if(!Number.isInteger(index)||index<0||index>=target.length)throw new RangeError('IndexOutOfRangeException');return target[index];},
    setIndex(target,index,value){if(target==null)throw new TypeError('NullReferenceException');if(target.set_Item){target.set_Item(index,value);return value;}if(!Array.isArray(target)||!Number.isInteger(index)||index<0||index>=target.length)throw new RangeError('IndexOutOfRangeException');target[index]=value;return value;},
    updateIndex(target,index,op,value){const old=api.index(target,index);const operations={'+':()=>old+value,'-':()=>old-value,'*':()=>old*value,'/':()=>old/value,'%':()=>old%value,'??':()=>old??value,'&':()=>old&value,'|':()=>old|value,'^':()=>old^value};if(!operations[op])throw new Error('Unsupported indexed assignment '+op);return api.setIndex(target,index,operations[op]());},
    idiv(a,b){if(b===0)throw new RangeError('DivideByZeroException');if(a===-2147483648&&b===-1)throw new RangeError('OverflowException');return Math.trunc(a/b)|0;},
    cast(value,type){if(type==='int')return Math.trunc(Number(value))|0;if(type==='float')return Math.fround(value);if(type==='double')return Number(value);if(type==='string')return value==null?null:String(value);if(type==='bool')return Boolean(value);return value;},
    is(value,type){if(value==null)return false;if(type===Number)return typeof value==='number';if(type===String)return typeof value==='string';if(type===Boolean)return typeof value==='boolean';return value instanceof type;},
    as(value,type){return api.is(value,type)?value:null;},
    initializeCollection(collection,values){for(const v of values){if(collection.Add)collection.Add(v);else if(collection.push)collection.push(v);else throw new TypeError('Object is not an initializable collection');}return collection;},
    dispose(value){if(value?.Dispose)value.Dispose();else if(value?.dispose)value.dispose();},
    call(target,name,args){
      if(target==null)throw new TypeError(`NullReferenceException accessing ${name}`);
      if(typeof target[name]==='function')return target[name](...args);
      if(name==='ToString')return formatValue(target,args[0]);
      const stringMethods={ToUpper:'toUpperCase',ToUpperInvariant:'toUpperCase',ToLower:'toLowerCase',ToLowerInvariant:'toLowerCase',Trim:'trim',TrimStart:'trimStart',TrimEnd:'trimEnd',Contains:'includes',StartsWith:'startsWith',EndsWith:'endsWith',IndexOf:'indexOf',LastIndexOf:'lastIndexOf',Split:'split',Replace:'replaceAll',PadLeft:'padStart',PadRight:'padEnd'};
      if(typeof target==='string'){
        if(name==='Substring')return target.slice(args[0],args[1]==null?undefined:args[0]+args[1]);
        if(stringMethods[name])return target[stringMethods[name]](...args);
      }
      if(target[Symbol.iterator]){
        const a=Array.from(target);switch(name){case'Where':return a.filter(args[0]);case'Select':return a.map(args[0]);case'Any':return args.length?a.some(args[0]):a.length>0;case'All':return a.every(args[0]);case'Count':return args.length?a.filter(args[0]).length:a.length;case'FirstOrDefault':return (args.length?a.find(args[0]):a[0])??null;case'First':{const value=args.length?a.find(args[0]):a[0];if(value===undefined)throw new Error('Sequence contains no matching element');return value;}case'ToList':return new List(a);case'ToArray':return a;case'Sum':return a.reduce((n,v)=>n+(args.length?args[0](v):v),0);case'OrderBy':return a.toSorted((x,y)=>{const a=args[0](x),b=args[0](y);return a<b?-1:a>b?1:0;});case'Take':return a.slice(0,args[0]);case'Skip':return a.slice(args[0]);case'Contains':return a.includes(args[0]);}
      }
      throw new Error(`Unsupported library member ${target.constructor?.name||typeof target}.${name}`);
    }
  };
  return api;
}
