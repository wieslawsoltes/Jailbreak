import {createBindingEngine} from './bindings.js';
import {runtimeCss} from './theme.js';
import {createPropertyApplier} from './properties.js';
import {createControlClass} from './controls.js';

/** Browser compatibility runtime. Independent of either compiler and of the IDE. */
export function createRuntime({document:doc=globalThis.document,dotnet,drawingBackend,onDiagnostic=()=>{},resources={},instructionBudget=1000000}={}) {
  if(!dotnet)throw new Error('createRuntime requires createDotNet() adapters');
  const types=Object.create(null),controls=Object.create(null),definitions=new Map(),bindings=new Set(),allControls=new Set();
  let queued=false,flushing=false,remaining=instructionBudget,mounted=null;
  const bool=v=>v===null?null:typeof v==='string'?v.toLowerCase()==='true':!!v;
  const num=v=>{if(typeof v==='number')return v;const n=Number(v);if(!Number.isFinite(n))throw new TypeError(`Invalid numeric property value ${v}`);return n;};
  const numeric=new Set('Width Height MinWidth MinHeight MaxWidth MaxHeight FontSize Opacity TabIndex Spacing RowSpacing ColumnSpacing BorderThickness CornerRadius Value Minimum Maximum Increment SmallChange LargeChange TickFrequency SelectedIndex MaxLength Grid.Row Grid.Column Grid.RowSpan Grid.ColumnSpan Canvas.Left Canvas.Top Canvas.Right Canvas.Bottom StrokeThickness RadiusX RadiusY'.split(' '));
  const boolean=new Set('IsVisible IsEnabled IsChecked IsThreeState IsReadOnly AcceptsReturn IsExpanded IsSelected IsIndeterminate ShowProgressText IsSnapToTickEnabled IsDirectionReversed LastChildFill Focusable ClipToBounds IsDefault IsCancel'.split(' '));
  const defaults={IsVisible:true,IsEnabled:true,IsChecked:false,IsThreeState:false,IsReadOnly:false,AcceptsReturn:false,Minimum:0,Maximum:100,Value:0,Increment:1,SmallChange:1,TickFrequency:1,SelectedIndex:-1,Orientation:'Vertical',LastChildFill:true,Opacity:1,FontSize:14,Text:'',Content:'',Name:'',Classes:'',DataContext:null};
  const css=runtimeCss;
  class AvaloniaProperty {
    constructor(name,{defaultValue=null,inherits=false,coerce=v=>v}={}){this.Name=name;this.defaultValue=defaultValue;this.inherits=inherits;this.coerce=coerce;}
    static Register(owner,name,metadata){return new AvaloniaProperty(name,metadata);}
  }
  class ObservableObject {
    constructor(){this._listeners=new Set();this.PropertyChanged=new dotnet.Event();}
    subscribe(fn){this._listeners.add(fn);return()=>this._listeners.delete(fn);}
    notify(name,oldValue,newValue){for(const fn of [...this._listeners])fn({name,oldValue,newValue});this.PropertyChanged.Invoke(this,{PropertyName:name,OldValue:oldValue,NewValue:newValue});schedule();}
    SetProperty(name,value){if(Object.is(this[name],value))return false;const old=this[name];this[name]=value;this.notify(name,old,value);return true;}
  }
  const globalResources=new Map(Object.entries({ScrollPage:{kind:'theme',name:'ScrollPage'},...resources}));
  function report(code,message,severity='error'){onDiagnostic({code,message,severity});}
  function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;try{flush();}catch(e){report('JB4001',e.message);}});}
  function flush(){
    if(flushing)return;flushing=true;
    try{let changed=true,rounds=0;while(changed&&++rounds<32){changed=false;for(const b of [...bindings])changed=b.update()||changed;}if(changed)throw new Error('Binding cycle exceeded 32 propagation rounds');}
    finally{flushing=false;}
  }
  function color(value){if(value&&typeof value==='object')value=value.Color??value.color??value;const str=String(value??'transparent');return /^#[\da-f]{8}$/i.test(str)?'#'+str.slice(3)+str.slice(1,3):str;}
  function thickness(value){
    if(value&&typeof value==='object'&&'Left'in value)return `${value.Top}px ${value.Right}px ${value.Bottom}px ${value.Left}px`;
    const a=String(value??0).split(/[ ,]+/).filter(Boolean).map(Number);if(!a.every(Number.isFinite)||![1,2,4].includes(a.length))throw new Error(`Invalid Thickness ${value}`);
    return a.length===1?`${a[0]}px`:a.length===2?`${a[1]}px ${a[0]}px`:`${a[1]}px ${a[2]}px ${a[3]}px ${a[0]}px`;
  }
  function tracks(text){return String(text||'*').split(/[ ,]+/).filter(Boolean).map(x=>x.toLowerCase()==='auto'?'auto':x.endsWith('*')?`minmax(0,${Number(x.slice(0,-1)||1)}fr)`:`${num(x)}px`).join(' ');}
  function get(obj,name,optional=false){
    if(obj==null){if(optional)return undefined;throw new TypeError(`NullReferenceException reading ${name}`);}
    if(name==='Length'&&typeof obj.length==='number')return obj.length;
    if(name==='Count'&&obj.Count===undefined)return obj.size??obj.length;
    if(name==='HasValue')return obj!=null;
    if(name==='Value'&&!(obj instanceof Control)&&typeof obj!=='object')return obj;
    return obj[name];
  }
  function call(obj,name,args=[],optional=false){if(obj==null&&optional)return undefined;return dotnet.call(obj,name,args);}
  function resource(control,key){for(let c=control;c;c=c._parent)if(c.Resources.has(key))return c.Resources.get(key);if(globalResources.has(key))return globalResources.get(key);throw new Error(`Resource not found: ${key}`);}
  function pathGet(object,path){for(const part of path?path.split('.'):[]){if(object==null)return undefined;object=get(object,part);}return object;}
  function pathSet(object,path,value){const parts=path.split('.');if(!path)return;for(const part of parts.slice(0,-1)){object=get(object,part);if(object==null)throw new Error(`Cannot write unresolved binding path ${path}`);}const key=parts.at(-1);if(object==null)throw new Error(`Cannot write binding ${path}`);object[key]=value;object.notify?.(key);}

  const {bind,scalar,resolveValue,readResources,matches,applyStyles}=createBindingEngine({dotnet,bindings,pathGet,pathSet,schedule,num,bool,resource});
  const applyProperty=createPropertyApplier({doc,color,thickness,tracks,applyStyles,schedule});
  const Control=createControlClass({doc,dotnet,ObservableObject,allControls,defaults,boolean,numeric,bool,num,applyStyles,report,drawingBackend,definitions,build,flush,schedule,resetBudget:()=>{remaining=instructionBudget;},applyProperty});
  const properties=`Name Classes Width Height MinWidth MinHeight MaxWidth MaxHeight Margin Padding HorizontalAlignment VerticalAlignment HorizontalContentAlignment VerticalContentAlignment Background Foreground Opacity IsVisible IsEnabled FontSize FontFamily FontWeight FontStyle DataContext Tag Focusable TabIndex ClipToBounds Cursor Content Child Header Theme Title RequestedThemeVariant SizeToContent Orientation Spacing ItemWidth ItemHeight RowDefinitions ColumnDefinitions RowSpacing ColumnSpacing LastChildFill BorderBrush BorderThickness CornerRadius HorizontalScrollBarVisibility VerticalScrollBarVisibility Text TextWrapping TextAlignment MaxLines LineHeight Target Command CommandParameter IsDefault IsCancel IsChecked IsThreeState GroupName Watermark AcceptsReturn IsReadOnly MaxLength PasswordChar Value Minimum Maximum SmallChange LargeChange TickFrequency IsDirectionReversed IsSnapToTickEnabled IsIndeterminate ShowProgressText Increment FormatString OnContent OffContent ItemsSource SelectedIndex SelectedItem PlaceholderText Items SelectionMode IsSelected IsExpanded ExpandDirection SelectedDate SelectedTime Source Stretch Fill Stroke StrokeThickness RadiusX RadiusY Scene ClearColor`;
  for(const name of properties.split(' '))Object.defineProperty(Control.prototype,name,{get(){return this.GetValue(name);},set(value){this.SetValue(name,value);},configurable:true});
  for(const type of `Application Window UserControl ContentPage Control ContentControl StackPanel WrapPanel Grid DockPanel Canvas Panel Border ScrollViewer TextBlock Label Button RepeatButton ToggleButton CheckBox RadioButton TextBox Slider ProgressBar NumericUpDown ToggleSwitch ComboBox ComboBoxItem ListBox ListBoxItem ItemsControl TabControl TabItem Expander Separator DatePicker CalendarDatePicker TimePicker Image Viewbox Menu MenuItem Rectangle Ellipse DrawingSurface`.split(' ')){
    controls[type]=class extends Control{static controlType=type;constructor(){super(type);if(type==='Slider')this.SetValue('Orientation','Horizontal',0);}};
  }
  controls.AvaloniaObject=ObservableObject;controls.StyledElement=Control;
  const eventNames=new Set('Click Checked Unchecked IsCheckedChanged TextChanged ValueChanged SelectionChanged PointerPressed PointerReleased PointerMoved KeyDown KeyUp GotFocus LostFocus Loaded'.split(' '));
  function build(ir,owner=null,{parent=null,dataContext,template=false}={}){
    let root=owner instanceof Control&&!parent&&!template?owner:null;
    if(!root){const Type=controls[ir.type]||types[ir.type];if(!Type)throw new Error(`Runtime type not registered: ${ir.type}`);root=new Type();}
    owner=owner||root;root._owner=owner;root._parent=parent;if(dataContext!==undefined)root.DataContext=dataContext;
    if(!parent&&!template){owner._names=new Map();owner._owner=owner;}
    const pending=[];
    function populate(node,control){
      readResources(node.properties.Resources||[],control);
      control._styles=(node.properties.Styles||[]).flatMap(s=>s.type==='Styles'?s.children:[s]);
      const name=node.props.Name;if(name){owner._names.set(name,control);if(!template)owner[name]=control;}
      if(node.properties.DataContext?.length){const spec=node.properties.DataContext[0],Type=types[spec.type];if(!Type)throw new Error(`No data context type ${spec.type}`);const vm=new Type();for(const[k,v]of Object.entries(spec.props))vm[k]=resolveValue(v,control);control.DataContext=vm;}
      const templateDef=(node.properties.ItemTemplate||node.properties.ContentTemplate||[])[0];if(templateDef){if(templateDef.type!=='DataTemplate'||templateDef.children.length!==1)throw new Error('DataTemplate needs one visual root');control._itemTemplate=templateDef.children[0];}
      for(const[property,value]of Object.entries(node.props)){
        if(eventNames.has(property)){pending.push(()=>{const handler=owner[value];if(typeof handler!=='function')throw new Error(`Missing event handler ${value}`);control._disposers.push(control.on(property,handler.bind(owner)));});}
        else if(value?.kind==='binding')pending.push(()=>bind(control,property,value,owner));
        else if(value?.kind==='resource'&&value.dynamic)pending.push(()=>{let previous;const b={update(){const current=resource(control,value.key);if(Object.is(current,previous))return false;previous=current;control.SetValue(property,current,100);return true;}};bindings.add(b);control._disposers.push(()=>bindings.delete(b));});
        else control.SetValue(property,resolveValue(value,control));
      }
      if(node.text){if(['TextBlock'].includes(node.type))control.Text=node.text;else control.Content=node.text;}
      const children=[...node.children,...(node.properties.Children||[]),...(node.properties.Content||[]),...(node.properties.Child||[]),...(node.properties.Items||[])];
      for(const child of children){if(['Style','Styles','ResourceDictionary'].includes(child.type))continue;const Type=controls[child.type]||types[child.type];if(!Type)throw new Error(`Unsupported visual type ${child.type}`);const next=new Type();next._owner=owner;next._parent=control;populate(child,next);control.add(next);}
      if(control._itemTemplate&&control.ItemsSource)control._refreshItems();
    }
    populate(ir,root);for(const fn of pending)fn();for(const c of allControls)if(c._owner===owner)applyStyles(c);flush();root._redraw();return root;
  }
  function mount(root,host=doc.body){
    if(!(root instanceof Control))throw new TypeError('Only Control instances can be mounted');if(mounted&&mounted!==root)mounted.dispose();mounted=root;
    if(!doc.getElementById('jailbreak-runtime-style')){const style=doc.createElement('style');style.id='jailbreak-runtime-style';style.textContent=css;doc.head.append(style);}
    host.replaceChildren(root.element);flush();for(const c of allControls){c.emit('Loaded');if(c._type==='DrawingSurface')c._redraw();}return root;
  }
  function addEvent(obj,name,handler){if(obj instanceof Control)return obj.on(name,handler);if(obj?.[name]?.Add)return obj[name].Add(handler);throw new Error(`Unsupported event ${name}`);}
  function removeEvent(obj,name,handler){if(obj instanceof Control)return obj.off(name,handler);if(obj?.[name]?.Remove)return obj[name].Remove(handler);throw new Error(`Unsupported event ${name}`);}
  const R={types,controls,dotnet,ObservableObject,AvaloniaProperty,build,mount,bind,flush,css,get,call,addEvent,removeEvent,
    registerXaml:(name,ir)=>definitions.set(name,ir),registerType:(name,Type)=>types[name]=Type,
    setResource:(key,value)=>{globalResources.set(key,value);schedule();},
    guard(){if(--remaining<0)throw new Error('Execution budget exceeded; check loops or recursion');},resetBudget(){remaining=instructionBudget;},
    AvaloniaXamlLoader:{Load:owner=>owner.InitializeComponent()},
    Thickness:class{constructor(left,top=left,right=left,bottom=top){Object.assign(this,{Left:left,Top:top,Right:right,Bottom:bottom});}},
    SolidColorBrush:class{constructor(Color){this.Color=Color;}},
    Colors:new Proxy({},{get:(_,name)=>String(name)}),
    stats:()=>({controls:allControls.size,bindings:bindings.size}),
    dispose(){mounted?.dispose();mounted=null;for(const c of [...allControls])c.dispose();bindings.clear();},
  };
  for(const[name,values]of Object.entries({BindingMode:['Default','OneWay','TwoWay','OneTime'],Orientation:['Horizontal','Vertical'],HorizontalAlignment:['Left','Center','Right','Stretch'],VerticalAlignment:['Top','Center','Bottom','Stretch']}))R[name]=Object.fromEntries(values.map(v=>[v,v]));
  return R;
}
