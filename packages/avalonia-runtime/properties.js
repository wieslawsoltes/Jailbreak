import { DotObject, notify } from '../dotnet-runtime/index.js';
export const priorities=Object.freeze({Default:0,Inherited:10,Style:100,LocalValue:1000,Animation:2000});
export class AvaloniaProperty {
  constructor(owner,name,defaultValue=null,options={}){this.OwnerType=owner;this.Name=name;this.DefaultValue=defaultValue;this.Inherits=!!options.inherits;this.Coerce=options.coerce??(x=>x);}
  static Register(owner,name,defaultValue=null,options={}){return new AvaloniaProperty(owner,name,defaultValue,options);}
  static RegisterAttached(owner,name,defaultValue=null,options={}){return new AvaloniaProperty(owner,name,defaultValue,options);}
  AddOwner(owner){return new AvaloniaProperty(owner,this.Name,this.DefaultValue,{inherits:this.Inherits,coerce:this.Coerce});}
}
export class StyledObject extends DotObject {
  constructor(){super();this._values=new Map();this._metadata=new Map();this._disposables=[];this._disposed=false;}
  propertyName(property){return typeof property==='string'?property:property.Name;}
  GetValue(property){
    const name=this.propertyName(property),levels=this._values.get(name);let selected=-Infinity,value;
    if(levels)for(const [priority,candidate]of levels)if(priority>selected){selected=priority;value=candidate;}
    if(selected>-Infinity)return value;
    const metadata=typeof property==='string'?this._metadata.get(name):property;
    if((metadata?.Inherits||name==='DataContext')&&this.parent)return this.parent.GetValue(property);
    return metadata?.DefaultValue??null;
  }
  SetValue(property,value,priority=priorities.LocalValue){
    const name=this.propertyName(property),old=this.GetValue(property),metadata=typeof property==='string'?this._metadata.get(name):property;
    if(metadata)this._metadata.set(name,metadata);value=metadata?.Coerce?metadata.Coerce(value,this):value;
    let levels=this._values.get(name);if(!levels){levels=new Map();this._values.set(name,levels);}levels.set(priority,value);
    const next=this.GetValue(property);if(!Object.is(old,next)){notify(this,name,next,old);this.onPropertyChanged?.(name,next,old);}
    return value;
  }
  SetCurrentValue(property,value){return this.SetValue(property,value);}
  ClearValue(property,priority=priorities.LocalValue){const name=this.propertyName(property),old=this.GetValue(property);this._values.get(name)?.delete(priority);const value=this.GetValue(property);if(!Object.is(old,value)){notify(this,name,value,old);this.onPropertyChanged?.(name,value,old);}}
  IsSet(property){return this._values.has(this.propertyName(property))&&this._values.get(this.propertyName(property)).size>0;}
  track(disposable){if(typeof disposable==='function')this._disposables.push(disposable);else if(disposable?.Dispose)this._disposables.push(()=>disposable.Dispose());return disposable;}
  Dispose(){if(this._disposed)return;this._disposed=true;for(const dispose of this._disposables.splice(0))dispose();this.PropertyChanged.clear();}
}
export { ResourceDictionary } from './resources.js';
export function observePath(source,path,callback){
  const segments=pathSegments(path);let subscriptions=[];
  const dispose=()=>{for(const off of subscriptions)off();subscriptions=[];};
  function refresh(){dispose();let object=source;for(let i=0;i<=segments.length;i++){
    if(object?.PropertyChanged?.add){const observed=object,key=segments[i];subscriptions.push(observed.PropertyChanged.add((sender,e)=>{if(!e?.PropertyName||e.PropertyName===key)refresh();}));}
    if(i<segments.length)object=object==null?undefined:object[segments[i]];
  }callback(object);}
  refresh();return dispose;
}
export function pathSegments(path){if(!path||path==='.')return [];return String(path).replace(/\[['"]?([^\]'"\s]+)['"]?\]/g,'.$1').split('.').filter(Boolean);}
export function writePath(source,path,value){const segments=pathSegments(path);if(!segments.length)return false;let object=source;for(const key of segments.slice(0,-1))object=object?.[key];if(object==null)return false;object[segments.at(-1)]=value;return true;}
