import { Exception, SystemException, ArithmeticException, OverflowException, DivideByZeroException, NullReferenceException, IndexOutOfRangeException, InvalidCastException, ArgumentException, ArgumentNullException, ArgumentOutOfRangeException, InvalidOperationException, NotSupportedException, FormatException, TypeInitializationException } from './exceptions.js';
export { Exception, SystemException, ArithmeticException, OverflowException, DivideByZeroException, NullReferenceException, IndexOutOfRangeException, InvalidCastException, ArgumentException, ArgumentNullException, ArgumentOutOfRangeException, InvalidOperationException, NotSupportedException, FormatException, TypeInitializationException } from './exceptions.js';
export { checkedBinary, checkedConvert } from './checked.js';
/** Deliberately small, independently reusable .NET-style JavaScript standard library. */
export class Event {
  constructor(){this.handlers=[];}
  add(handler){if(typeof handler!=='function')throw new TypeError('Event handler must be callable');this.handlers.push(handler);return ()=>this.remove(handler);}
  remove(handler){const i=this.handlers.lastIndexOf(handler);if(i>=0)this.handlers.splice(i,1);}
  Invoke(...args){for(const handler of [...this.handlers])handler(...args);}
  clear(){this.handlers.length=0;}
  get Count(){return this.handlers.length;}
}
export class EventArgs { static Empty=Object.freeze(new EventArgs()); }
export class PropertyChangedEventArgs extends EventArgs { constructor(name){super();this.PropertyName=name;} }
export class RoutedEventArgs extends EventArgs { constructor(source=null,event=null){super();this.Source=source;this.OriginalEvent=event;this.Handled=false;} }
export class DotObject {
  constructor(){this.PropertyChanged=new Event();}
  RaisePropertyChanged(name){this.PropertyChanged.Invoke(this,new PropertyChangedEventArgs(name));}
  OnPropertyChanged(name){this.RaisePropertyChanged(typeof name==='string'?name:name?.PropertyName);}
  SetAndRaise(name,value){const old=this[name];if(Object.is(old,value))return false;this[name]=value;notify(this,name,value,old);return true;}
  Equals(other){return this===other;}
  ToString(){return this.$type??this.constructor.name;}
  GetType(){return {Name:this.constructor.name,FullName:this.$type??this.constructor.name};}
}
export class ObservableObject extends DotObject {}
export function notify(object,name,value,old){if(!Object.is(value,old))object.PropertyChanged?.Invoke(object,{PropertyName:name,NewValue:value,OldValue:old});}
export function eventAdd(object,name,handler){if(!object[name]?.add)throw new InvalidOperationException(`'${name}' is not an event`);return object[name].add(handler);}
export function eventRemove(object,name,handler){object[name]?.remove(handler);}
const boundMethods=new WeakMap();
export function method(object,name){let map=boundMethods.get(object);if(!map){map=new Map();boundMethods.set(object,map);}if(!map.has(name))map.set(name,object[name].bind(object));return map.get(name);}
export class List extends Array {
  static get [Symbol.species](){return Array;}
  constructor(items){super();if(items!=null&&typeof items!=='number')this.push(...items);}
  get Count(){return this.length;} get Capacity(){return this.length;}
  Add(item){this.push(item);} AddRange(items){this.push(...items);} Clear(){this.length=0;}
  Insert(index,item){if(index<0||index>this.length)throw new ArgumentException('Index out of range');this.splice(index,0,item);}
  Remove(item){const i=this.indexOf(item);if(i<0)return false;this.splice(i,1);return true;}
  RemoveAt(index){if(index<0||index>=this.length)throw new ArgumentException('Index out of range');this.splice(index,1);}
  Contains(item){return this.includes(item);} IndexOf(item){return this.indexOf(item);}
  ToArray(){return Array.from(this);} ToList(){return new List(this);} ForEach(action){this.forEach(action);}
  Find(predicate){return this.find(predicate)??null;} FindAll(predicate){return new List(this.filter(predicate));}
  Sort(compare){this.sort(compare??compareValues);} Reverse(){this.reverse();}
}
export class ObservableCollection extends List {
  constructor(items){super(items);this.CollectionChanged=new Event();this.PropertyChanged=new Event();}
  changed(action,items=[],index=-1){this.CollectionChanged.Invoke(this,{Action:action,NewItems:items,NewStartingIndex:index});this.PropertyChanged.Invoke(this,{PropertyName:'Count'});}
  Add(item){super.Add(item);this.changed('Add',[item],this.length-1);}
  AddRange(items){const a=[...items];const i=this.length;super.AddRange(a);this.changed('Add',a,i);}
  Insert(index,item){super.Insert(index,item);this.changed('Add',[item],index);}
  Remove(item){const result=super.Remove(item);if(result)this.changed('Remove',[item]);return result;}
  RemoveAt(index){const item=this[index];super.RemoveAt(index);this.changed('Remove',[item],index);}
  Clear(){super.Clear();this.changed('Reset');}
}
export class Dictionary extends Map {
  get Count(){return this.size;} get Keys(){return new List(this.keys());}get Values(){return new List(this.values());}
  Add(key,value){if(this.has(key))throw new ArgumentException('Duplicate key');this.set(key,value);}
  ContainsKey(key){return this.has(key);}ContainsValue(value){return [...this.values()].includes(value);}
  Remove(key){return this.delete(key);}Clear(){this.clear();}
}
export class HashSet extends Set { get Count(){return this.size;}Add(value){const old=this.size;this.add(value);return old!==this.size;}Contains(value){return this.has(value);}Remove(value){return this.delete(value);}Clear(){this.clear();} }
export class Queue extends List { Enqueue(value){this.Add(value);}Dequeue(){if(!this.length)throw new InvalidOperationException('Queue is empty');return this.shift();}Peek(){if(!this.length)throw new InvalidOperationException('Queue is empty');return this[0];} }
export class Stack extends List { Push(value){this.Add(value);}Pop(){if(!this.length)throw new InvalidOperationException('Stack is empty');return this.pop();}Peek(){if(!this.length)throw new InvalidOperationException('Stack is empty');return this.at(-1);} }
export function iterate(value){if(value==null||!value[Symbol.iterator])throw new ArgumentException('Value is not enumerable');return value;}
export function length(value){if(value==null)throw new NullReferenceException('Cannot read Length/Count of null');if(typeof value.Count==='number')return value.Count;if(typeof value.Length==='number')return value.Length;return value.length??value.size;}
export function getIndex(value,key,optional=false){if(value==null){if(optional)return undefined;throw new NullReferenceException('Indexing null');}if(value instanceof Map){if(!value.has(key))throw new InvalidOperationException('Key not found');return value.get(key);}if((Array.isArray(value)||typeof value==='string')&&(!Number.isInteger(key)||key<0||key>=value.length))throw new IndexOutOfRangeException('Index out of range');return value[key];}
export function setIndex(value,key,item){if(value==null)throw new NullReferenceException('Indexing null');if(value instanceof Map)value.set(key,item);else {if(Array.isArray(value)&&(!Number.isInteger(key)||key<0||key>=value.length))throw new IndexOutOfRangeException('Index out of range');value[key]=item;}return item;}
export function updateIndex(value,key,op,right){const left=getIndex(value,key);return setIndex(value,key,({'+=':()=>left+right,'-=':()=>left-right,'*=':()=>left*right,'/=':()=>left/right,'%=':()=>left%right,'??=':()=>left??right}[op]??(()=>{throw new NotSupportedException(op);}))());}
export function incrementIndex(value,key,delta,postfix){const old=getIndex(value,key),next=old+delta;setIndex(value,key,next);return postfix?old:next;}
export function newArray(length,initial=null){if(!Number.isInteger(length)||length<0||length>10000000)throw new ArgumentException('Invalid or excessive array length');return Array(length).fill(initial);}
export function initializeCollection(collection,items){for(const value of items){if(collection instanceof Dictionary)collection.Add(...value);else collection.Add(value);}return collection;}
class Query {constructor(factory){this.factory=factory;}[Symbol.iterator](){return this.factory();}}
function compareValues(a,b){return a===b?0:a==null?-1:b==null?1:a<b?-1:1;}
class OrderedQuery extends Query {
  constructor(source,criteria){super(function*(){const items=[...source];items.sort((a,b)=>{for(const {key,descending} of criteria){const n=compareValues(key(a),key(b));if(n)return descending?-n:n;}return 0;});yield*items;});this.source=source;this.criteria=criteria;}
}
export const Enumerable={
  Empty:()=>[],Range:(start,count)=>new Query(function*(){if(count<0)throw new ArgumentException('Negative count');for(let i=0;i<count;i++)yield start+i;}),Repeat:(item,count)=>new Query(function*(){for(let i=0;i<count;i++)yield item;}),
  Where:(source,predicate)=>new Query(function*(){let i=0;for(const value of iterate(source))if(predicate(value,i++))yield value;}),
  Select:(source,selector)=>new Query(function*(){let i=0;for(const value of iterate(source))yield selector(value,i++);}),
  SelectMany:(source,selector)=>new Query(function*(){for(const value of iterate(source))yield*selector(value);}),
  Any:(source,predicate=()=>true)=>{for(const v of iterate(source))if(predicate(v))return true;return false;},
  All:(source,predicate)=>{for(const v of iterate(source))if(!predicate(v))return false;return true;},
  Count:(source,predicate=()=>true)=>{let count=0;for(const v of iterate(source))if(predicate(v))count++;return count;},
  First:(source,predicate=()=>true)=>{for(const v of iterate(source))if(predicate(v))return v;throw new InvalidOperationException('Sequence contains no matching element');},
  FirstOrDefault:(source,predicate=()=>true,fallback=null)=>{for(const v of iterate(source))if(predicate(v))return v;return fallback;},
  Last:(source,predicate=()=>true)=>{const a=[...source].filter(predicate);if(!a.length)throw new InvalidOperationException('Sequence is empty');return a.at(-1);},
  LastOrDefault:(source,predicate=()=>true,fallback=null)=>[...source].filter(predicate).at(-1)??fallback,
  Single:(source,predicate=()=>true)=>{const a=[...source].filter(predicate);if(a.length!==1)throw new InvalidOperationException('Sequence must contain exactly one element');return a[0];},
  SingleOrDefault:(source,predicate=()=>true,fallback=null)=>{const a=[...source].filter(predicate);if(a.length>1)throw new InvalidOperationException('Sequence contains more than one element');return a[0]??fallback;},
  Sum:(source,selector=x=>x)=>{let sum=0;for(const x of source)sum+=selector(x);return sum;},
  Average:(source,selector=x=>x)=>{const a=[...source];if(!a.length)throw new InvalidOperationException('Sequence is empty');return a.reduce((s,x)=>s+selector(x),0)/a.length;},
  Min:(source,selector=x=>x)=>{const a=[...source].map(selector);if(!a.length)throw new InvalidOperationException('Sequence is empty');return a.reduce((a,b)=>a<b?a:b);},
  Max:(source,selector=x=>x)=>{const a=[...source].map(selector);if(!a.length)throw new InvalidOperationException('Sequence is empty');return a.reduce((a,b)=>a>b?a:b);},
  OrderBy:(source,key)=>new OrderedQuery(source,[{key,descending:false}]),OrderByDescending:(source,key)=>new OrderedQuery(source,[{key,descending:true}]),
  ThenBy:(source,key)=>new OrderedQuery(source.source,[...source.criteria,{key,descending:false}]),ThenByDescending:(source,key)=>new OrderedQuery(source.source,[...source.criteria,{key,descending:true}]),
  Take:(source,count)=>new Query(function*(){if(count<=0)return;let n=0;for(const x of source){yield x;if(++n>=count)break;}}),
  Skip:(source,count)=>new Query(function*(){let n=0;for(const x of source)if(n++>=count)yield x;}),
  Concat:(a,b)=>new Query(function*(){yield*a;yield*b;}),Distinct:source=>new Set(source),Reverse:source=>[...source].reverse(),
  ToList:source=>new List(source),ToArray:source=>[...source],Contains:(source,item)=>{for(const v of source)if(v===item)return true;return false;},
  Aggregate:(source,seed,fn)=>{let result=seed;for(const x of source)result=fn(result,x);return result;}
};
export class StringBuilder {constructor(value=''){this.parts=[String(value)];}Append(value){this.parts.push(String(value??''));return this;}AppendLine(value=''){return this.Append(value+'\n');}Clear(){this.parts=[];return this;}ToString(){return this.parts.join('');}get Length(){return this.ToString().length;}}
export function formatValue(value,format=null){if(value==null)return '';if(typeof value==='number'&&format){const m=/^([fFnNpPdDxX])(\d*)$/.exec(format);if(!m)throw new NotSupportedException(`Format '${format}'`);const digits=m[2]?Number(m[2]):2;switch(m[1].toUpperCase()){case 'F':return value.toFixed(digits);case 'N':return value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});case 'P':return (value*100).toFixed(digits)+'%';case 'D':return Math.trunc(value).toString().padStart(Number(m[2])||1,'0');case 'X':{let s=(value>>>0).toString(16).padStart(Number(m[2])||1,'0');return m[1]==='X'?s.toUpperCase():s;}}}if(value.ToString)return value.ToString(format);return String(value);}
export const StringApi={Empty:'',IsNullOrEmpty:s=>s==null||s==='',IsNullOrWhiteSpace:s=>s==null||!String(s).trim(),Join:(separator,items)=>[...items].map(x=>formatValue(x)).join(separator),Concat:(...args)=>args.flat().join(''),Format:(format,...args)=>format.replace(/\{(\d+)(?::([^}]+))?\}/g,(_,i,f)=>formatValue(args[Number(i)],f)),Compare:(a,b)=>compareValues(a,b)};
export function invoke(value,name,args=[],optional=false){
  if(value==null){if(optional)return undefined;throw new ArgumentNullException('Calling '+name+' on null');}
  if(name==='ToString')return formatValue(value,args[0]);
  if(typeof value[name]==='function')return value[name](...args);
  if(typeof value==='string'){
    const [a,b]=args;switch(name){case 'Contains':return value.includes(a);case 'StartsWith':return value.startsWith(a);case 'EndsWith':return value.endsWith(a);case 'Substring':if(a<0||a>value.length||b<0||a+(b??0)>value.length)throw new ArgumentException('Substring out of range');return b===undefined?value.slice(a):value.slice(a,a+b);case 'ToUpper':case 'ToUpperInvariant':return value.toUpperCase();case 'ToLower':case 'ToLowerInvariant':return value.toLowerCase();case 'Trim':return value.trim();case 'TrimStart':return value.trimStart();case 'TrimEnd':return value.trimEnd();case 'Replace':return value.split(a).join(b);case 'Split':return value.split(a);case 'IndexOf':return value.indexOf(a,b);case 'LastIndexOf':return value.lastIndexOf(a,b);case 'PadLeft':return value.padStart(a,b??' ');case 'PadRight':return value.padEnd(a,b??' ');}
  }
  if(Enumerable[name])return Enumerable[name](value,...args);throw new NotSupportedException(`Method '${name}' is not available`);
}
export const iadd=(a,b)=>(a+b)|0, isub=(a,b)=>(a-b)|0, imul=(a,b)=>Math.imul(a,b);
export function idiv(a,b){if(b===0)throw new DivideByZeroException('Attempted to divide by zero');if(a===-2147483648&&b===-1)throw new OverflowException('Integer division overflow');return Math.trunc(a/b)|0;}
export function irem(a,b){if(b===0)throw new DivideByZeroException('Attempted to divide by zero');return (a%b)|0;}
export function toInt(value){return Math.trunc(Number(value))|0;}
export const Convert={ToInt32:toInt,ToDouble:Number,ToString:formatValue,ToBoolean:value=>typeof value==='string'?value.toLowerCase()==='true':!!value,Parse:value=>{const n=Number(value);if(!Number.isFinite(n))throw new ArgumentException('Invalid number');return n;}};
export const MathApi={...Object.fromEntries(Object.getOwnPropertyNames(Math).filter(n=>typeof Math[n]==='function').map(n=>[n[0].toUpperCase()+n.slice(1),Math[n].bind(Math)])),PI:Math.PI,E:Math.E,Clamp:(n,a,b)=>Math.min(b,Math.max(a,n)),Round:(n,d=0)=>{const m=10**d,x=n*m,f=Math.floor(x),r=x-f;return (r===0.5?(f%2===0?f:f+1):Math.round(x))/m;}};
export const Task={Delay:(ms,token)=>new Promise((resolve,reject)=>{if(token?.IsCancellationRequested){reject(new Exception('Task canceled'));return;}const id=setTimeout(resolve,ms);token?.signal?.addEventListener('abort',()=>{clearTimeout(id);reject(new Exception('Task canceled'));},{once:true});}),Run:fn=>Promise.resolve().then(fn),WhenAll:tasks=>Promise.all(tasks),WhenAny:tasks=>Promise.race(tasks),FromResult:value=>Promise.resolve(value),CompletedTask:Promise.resolve()};
export class CancellationTokenSource {constructor(){this.controller=new AbortController();}get Token(){const signal=this.controller.signal;return {signal,get IsCancellationRequested(){return signal.aborted;}};}Cancel(){this.controller.abort();}Dispose(){this.Cancel();}}
export class RelayCommand {constructor(execute,canExecute=()=>true){this.execute=execute;this.canExecute=canExecute;this.CanExecuteChanged=new Event();}CanExecute(parameter){return !!this.canExecute(parameter);}Execute(parameter){if(this.CanExecute(parameter))return this.execute(parameter);}NotifyCanExecuteChanged(){this.CanExecuteChanged.Invoke(this,EventArgs.Empty);}}
export class DateTime {
  constructor(year,month,day,hour=0,minute=0,second=0){this.value=year instanceof Date?year:year==null?new Date():new Date(year,month-1,day,hour,minute,second);}
  static get Now(){return new DateTime(new Date());}static get UtcNow(){return new DateTime(new Date());}static get Today(){const d=new Date();d.setHours(0,0,0,0);return new DateTime(d);}
  get Year(){return this.value.getFullYear();}get Month(){return this.value.getMonth()+1;}get Day(){return this.value.getDate();}get Hour(){return this.value.getHours();}get Minute(){return this.value.getMinutes();}get Second(){return this.value.getSeconds();}
  AddDays(n){const d=new Date(this.value);d.setDate(d.getDate()+n);return new DateTime(d);}ToString(){return this.value.toISOString();}valueOf(){return this.value.getTime();}
}
export class TimeSpan {constructor(milliseconds=0){this.TotalMilliseconds=milliseconds;}static FromSeconds(n){return new TimeSpan(n*1000);}static FromMilliseconds(n){return new TimeSpan(n);}static FromMinutes(n){return new TimeSpan(n*60000);}get TotalSeconds(){return this.TotalMilliseconds/1000;}ToString(){return String(this.TotalSeconds);}valueOf(){return this.TotalMilliseconds;}}
export const Guid={NewGuid:()=>globalThis.crypto.randomUUID()};
export const Console={WriteLine:(...args)=>console.log(...args),Write:(...args)=>console.log(...args)};
export const Debug={WriteLine:Console.WriteLine,Assert:(value,message='Assertion failed')=>{if(!value)throw new Exception(message);}};
export function is(value,type){if(value==null)return false;if(type===Number)return typeof value==='number';if(type===String)return typeof value==='string';if(type===Boolean)return typeof value==='boolean';if(type===Exception)return value instanceof Error;return typeof type==='function'&&value instanceof type;}
export function as(value,type){return is(value,type)?value:null;}
export function cast(value,type){if(value==null||is(value,type))return value;throw new ArgumentException('Invalid cast');}
export function typeInfo(type){return {Name:type?.$fullName?.split('.').at(-1)??type?.name,FullName:type?.$fullName??type?.name,constructor:type};}
export function getType(value){return typeInfo(value.constructor);}
export const Enum={GetValues:type=>Object.values(type?.constructor??type).filter(x=>typeof x==='number'),GetNames:type=>Object.keys(type?.constructor??type),Parse:(type,name)=>(type?.constructor??type)[name]};
