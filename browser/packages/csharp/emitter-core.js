import {diagnostic,failure} from '../core/index.js';
import {primitive} from './lexer.js';

const builtinNames={
  Console:'R.dotnet.Console',Math:'Math',MathF:'Math',string:'R.dotnet.String',String:'R.dotnet.String',
  int:'R.dotnet.Int32',Int32:'R.dotnet.Int32',double:'R.dotnet.Double',Double:'R.dotnet.Double',bool:'R.dotnet.Boolean',Boolean:'R.dotnet.Boolean',
  Task:'R.dotnet.Task',TimeSpan:'R.dotnet.TimeSpan',DateTime:'R.dotnet.DateTime',Guid:'R.dotnet.Guid',
  List:'R.dotnet.List',ObservableCollection:'R.dotnet.ObservableCollection',Dictionary:'R.dotnet.Dictionary',HashSet:'R.dotnet.HashSet',
  RelayCommand:'R.dotnet.RelayCommand',DelegateCommand:'R.dotnet.RelayCommand',EventHandler:'R.dotnet.Event',
  Exception:'Error',InvalidOperationException:'Error',ArgumentException:'Error',NotSupportedException:'Error',
  AvaloniaXamlLoader:'R.AvaloniaXamlLoader',Dispatcher:'R.dotnet.Dispatcher',BindingMode:'R.BindingMode',
  Thickness:'R.Thickness',SolidColorBrush:'R.SolidColorBrush',Colors:'R.Colors',Brushes:'R.Colors',
  Orientation:'R.Orientation',HorizontalAlignment:'R.HorizontalAlignment',VerticalAlignment:'R.VerticalAlignment',
};
const uiTypes=new Set('Application Window UserControl ContentPage Control ContentControl StackPanel WrapPanel Grid DockPanel Canvas Panel Border ScrollViewer TextBlock Label Button RepeatButton ToggleButton CheckBox RadioButton TextBox Slider ProgressBar NumericUpDown ToggleSwitch ComboBox ComboBoxItem ListBox ListBoxItem ItemsControl TabControl TabItem Expander Separator DatePicker CalendarDatePicker TimePicker Image Viewbox Menu MenuItem Rectangle Ellipse DrawingSurface AvaloniaObject StyledElement'.split(' '));
const inheritedMembers=new Set('InitializeComponent FindControl FindName DataContext Content Children Resources Styles Name IsVisible IsEnabled Width Height Margin Padding Background Foreground Close Show ShowDialog Focus InvalidateVisual SetValue GetValue RaiseEvent PropertyChanged notify subscribe'.split(' '));
export const defaultValue=type=>type?.arrays?'null':['int','short','byte','sbyte','ushort','double','float'].includes(type?.name)?'0':type?.name==='bool'?'false':'null';
const typeName=t=>t?.name||'object';

export class EmitterCore {
  constructor(programs,{extraMembers={}}={}){
    this.programs=programs;this.classes=new Map();this.enums=new Map();this.diagnostics=[];this.extraMembers=extraMembers;
    for(const program of programs){for(const c of program.classes){if(this.classes.has(c.fullName)){const existing=this.classes.get(c.fullName);if(!existing.mods.includes('partial')||!c.mods.includes('partial'))this.report('JB2010',`Duplicate class ${c.fullName}`,c);else existing.members.push(...c.members);}else this.classes.set(c.fullName,{...c,members:[...c.members]});}for(const e of program.enums)this.enums.set(e.fullName,e);}
  }
  report(code,message,node={}){this.diagnostics.push(diagnostic(code,message,this.current?.file||node.file||'', 'error',node.loc||node));}
  resolveType(name){
    if(!name)return null;
    if(this.classes.has(name)||this.enums.has(name))return `T[${JSON.stringify(name)}]`;
    const full=this.current?.namespace?`${this.current.namespace}.${name}`:name;if(this.classes.has(full)||this.enums.has(full))return `T[${JSON.stringify(full)}]`;
    const candidates=[...this.classes.keys(),...this.enums.keys()].filter(n=>n.endsWith('.'+name)&&this.current?.usings.includes(n.slice(0,-name.length-1)));
    if(candidates.length===1)return `T[${JSON.stringify(candidates[0])}]`;
    if(name.includes('.')&&!name.startsWith('System.')&&!name.startsWith('Avalonia.'))return null;
    const simple=name.split('.').at(-1);if(uiTypes.has(simple))return `R.controls[${JSON.stringify(simple)}]`;
    if(builtinNames[simple])return builtinNames[simple];return null;
  }
  type(type){if(type.arrays)return 'Array';const resolved=this.resolveType(type.name);if(resolved)return resolved;
    if(primitive.has(type.name))return ['string','char'].includes(type.name)?'String':type.name==='bool'?'Boolean':'Number';
    this.report('JB2011',`Unresolved type ${type.name}; register a library adapter or compile its source`,type.loc);return 'Object';
  }
  scope(parent=new Map()){return new Map(parent);}
  member(name,klass=this.current,seen=new Set()){
    if(!klass||seen.has(klass.fullName))return null;seen.add(klass.fullName);
    const own=klass.members.find(m=>m.name===name);if(own)return own;
    const base=klass.bases[0]?.name;const parent=this.classes.get(base)||this.classes.get(klass.namespace+'.'+base);
    return this.member(name,parent,seen);
  }
  name(node,scope){
    const n=node.name;if(n==='this')return 'this';if(n==='base')return 'super';if(scope.has(n))return n;
    if(n==='nameof')return 'String';
    const m=this.member(n);if(m){const owner=m.mods.includes('static')?`T[${JSON.stringify(this.current.fullName)}]`:'this';return m.kind==='method'?`R.dotnet.method(${owner},${JSON.stringify(n)})`:`${owner}.${n}`;}
    if(inheritedMembers.has(n)||(this.extraMembers[this.current?.fullName]||[]).includes(n))return `this.${n}`;
    const resolved=this.resolveType(n);if(resolved)return resolved;
    this.report('JB2012',`Unresolved identifier ${n}; unsupported APIs are not silently emitted`,node);return `undefined /* ${n} */`;
  }
  inferred(n,s){
    if(!n)return 'object';if(n.kind==='literal')return n.type;
    if(n.kind==='name')return typeName(s.get(n.name)||this.member(n.name)?.type);
    if(n.kind==='cast')return n.type.name;
    if(n.kind==='binary'){const l=this.inferred(n.left,s),r=this.inferred(n.right,s);return n.op==='+'&&(l==='string'||r==='string')?'string':l===r?l:'object';}
    if(n.kind==='unary'||n.kind==='postfix')return this.inferred(n.value,s);
    if(n.kind==='call'&&n.callee.kind==='name')return typeName(this.member(n.callee.name)?.type);
    return 'object';
  }
  path(node){return node.kind==='name'?node.name:node.kind==='member'?(this.path(node.object)?`${this.path(node.object)}.${node.name}`:null):null;}
  lvalue(node,s){if(node.kind==='name')return this.name(node,s);if(node.kind==='member')return `${this.expr(node.object,s)}.${node.name}`;if(node.kind==='index')return `${this.expr(node.object,s)}[${this.expr(node.index,s)}]`;this.report('JB2013','Expression is not assignable',node);return 'undefined';}
}
