import { createDevelopmentSession } from '../development/runtime.js';
import { createBinaryRuntime } from '../msil-runtime/index.js';
import { TemplateAppliedEventArgs } from './templates.js';
export { TemplateAppliedEventArgs } from './templates.js';
import * as DN from '../dotnet-runtime/index.js';
import { Control, controls, flushLayout } from './controls.js';
import { StyledObject, AvaloniaProperty, ResourceDictionary } from './properties.js';
import { runtimeCss } from './styling.js';
import { createXamlRuntime } from './xaml.js';

export class Thickness {
  constructor(left=0,top=left,right=left,bottom=top){this.Left=left;this.Top=top;this.Right=right;this.Bottom=bottom;}
  static Parse(value){if(value instanceof Thickness)return value;const a=String(value).split(/[, ]+/).map(Number);if(![1,2,4].includes(a.length)||a.some(x=>!Number.isFinite(x)))throw new Error('Invalid thickness');return new Thickness(...a);}
}
export class CornerRadius {
  constructor(topLeft=0,topRight=topLeft,bottomRight=topLeft,bottomLeft=topRight){this.TopLeft=topLeft;this.TopRight=topRight;this.BottomRight=bottomRight;this.BottomLeft=bottomLeft;}
  static Parse(value){return new CornerRadius(...String(value).split(/[, ]+/).map(Number));}
  toString(){return `${this.TopLeft}px ${this.TopRight}px ${this.BottomRight}px ${this.BottomLeft}px`;}
}
export class Point {constructor(x=0,y=0){this.X=x;this.Y=y;}ToString(){return `${this.X},${this.Y}`;}toString(){return this.ToString();}}
export class Size {constructor(width=0,height=0){this.Width=width;this.Height=height;}}
export class Rect {constructor(x=0,y=0,width=0,height=0){this.X=x;this.Y=y;this.Width=width;this.Height=height;}}
export class Color {constructor(value){this.value=value;}static Parse(value){return value instanceof Color?value:new Color(String(value));}static FromRgb(r,g,b){return Color.FromArgb(255,r,g,b);}static FromArgb(a,r,g,b){return new Color('#'+[a,r,g,b].map(x=>(x&255).toString(16).padStart(2,'0')).join(''));}toString(){return this.value;}ToString(){return this.value;}}
export class SolidColorBrush {constructor(color){this.Color=Color.Parse(color);}toString(){return this.Color.toString();}ToString(){return this.toString();}}
export class Uri {constructor(value){this.OriginalString=String(value);}toString(){return this.OriginalString;}ToString(){return this.OriginalString;}}
export const Colors=Object.fromEntries('Transparent Black White Red Green Blue Yellow Orange Purple Gray LightGray DarkGray DodgerBlue CornflowerBlue Lime Pink Gold Silver'.split(' ').map(n=>[n,Color.Parse(n.toLowerCase())]));
export const Brushes=Object.fromEntries(Object.entries(Colors).map(([k,v])=>[k,new SolidColorBrush(v)]));
export const Dispatcher={UIThread:{Post:fn=>queueMicrotask(fn),InvokeAsync:fn=>Promise.resolve().then(fn),CheckAccess:()=>true}};
export const BindingMode={Default:'Default',OneWay:'OneWay',TwoWay:'TwoWay',OneTime:'OneTime',OneWayToSource:'OneWayToSource'};
export class Binding {constructor(path='',mode='Default'){this.kind='binding';this.path=path;this.Mode=mode;}}

/** Creates an independent registration context. Compilers only depend on this small ABI. */
export function createRuntime() {
  const types=new Map(),documents=new Map();
  const api={...DN,...controls,Object:DN.DotObject,String:DN.StringApi,Math:DN.MathApi,Array:{Empty:()=>[],...Array},
    DelegateCommand:DN.RelayCommand,AvaloniaObject:StyledObject,StyledElement:StyledObject,AvaloniaProperty,StyledProperty:AvaloniaProperty,
    ResourceDictionary,TemplateAppliedEventArgs,Thickness,CornerRadius,Point,Vector:Point,Size,Rect,Color,SolidColorBrush,Uri,Colors,Brushes,Dispatcher,BindingMode,Binding,
    runtimeCss,flushLayout,types,documents};
  api.enableDevelopment=options=>{api.dev?.dispose();api.dev=createDevelopmentSession(api,options);return api.dev;};
  api.binary=createBinaryRuntime({log:(...args)=>api.Console?.WriteLine?.(...args)});
  api.defineType=(name,type)=>{if(types.has(name))throw new Error(`Duplicate runtime type '${name}'`);types.set(name,type);if(typeof type==='function')Object.defineProperty(type,'$fullName',{value:name,configurable:true});return type;};
  for(const [name,type]of Object.entries(controls))types.set(name,type);
  api.registerXaml=(id,ir)=>{if(ir.version!==1)throw new Error('Unsupported XAML IR version');documents.set(id,ir);};
  Object.assign(api,createXamlRuntime(api,types,documents));
  api.AvaloniaXamlLoader={Load:api.loadXaml};
  api.ApplicationLifetime={MainWindow:null};
  api.boot=(manifest,host=globalThis.document?.body)=>{
    if(!host)throw new Error('A browser DOM host is required');
    const style=document.createElement('style');style.textContent=runtimeCss;host.append(style);
    const assets=manifest.assets??{};
    Control.assetResolver=source=>{const path=String(source??'').replace(/^avares:\/\/[^/]+\//,'');return assets[path]??assets[Object.keys(assets).find(k=>k.endsWith('/'+path))]??source;};
    const id=manifest.entryXaml,Type=manifest.entryType?api.resolveType(manifest.entryType):null;
    Control.xamlLoader=api.loadXaml;
    Control.onRendererStatus=status=>api.onRendererStatus?.(status);
    const root=Type?new Type():api.createFromXaml(id);
    if(id&&!root._xamlLoaded)api.loadXaml(root,id);
    if(!(root instanceof Control))throw new Error('Entry point must be a browser control');
    if(root.Title)document.title=root.Title;
    api.ApplicationLifetime.MainWindow=root;api.root=root;root.mount(host);flushLayout();
    return {root,dispose(){api.dev?.dispose();root.Dispose();style.remove();}};
  };
  // Constructors call this hook after registration, before the first DOM mount.
  Control.xamlLoader=instance=>api.loadXaml(instance);
  return api;
}
export const JB=createRuntime();
