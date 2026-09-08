/** Binding propagation and simple style/resource evaluation; independent of the DOM adapter. */
export function createBindingEngine({dotnet,bindings,pathGet,pathSet,schedule,num,bool,resource}) {
  function bind(target,property,description,owner){
    let updating=false,first=true,last,disposed=false;
    const mode=description.mode==='Default'?(['TextBox','CheckBox','ToggleSwitch','Slider','NumericUpDown','ComboBox','ListBox'].includes(target._type)?'TwoWay':'OneWay'):description.mode;
    const source=()=>description.element?owner._names.get(description.element):target.DataContext;
    const binding={update(){if(disposed||(!first&&mode==='OneTime'))return false;const obj=source();let value=pathGet(obj,description.path);if(value===undefined&&description.fallback!==undefined)value=description.fallback;if(value==null&&description.targetNull!==undefined)value=description.targetNull;if(description.format)value=description.format.replace(/\{0(?::([^}]+))?\}/g,(_,f)=>dotnet.format(value,f));if(!first&&Object.is(value,last))return false;first=false;last=value;updating=true;try{target.SetValue(property,value,100);}finally{updating=false;}return true;}};
    if(mode==='TwoWay'){const unsub=target.subscribe(event=>{if(event.name===property&&!updating){pathSet(source(),description.path,target.GetValue(property));schedule();}});target._disposers.push(unsub);}
    bindings.add(binding);target._disposers.push(()=>{disposed=true;bindings.delete(binding);});return binding;
  }
  function scalar(ir,control){const text=ir.text??ir.props.Color??ir.props.Value??'';if(ir.type==='Double'||ir.type==='Int32')return num(text);if(ir.type==='Boolean')return bool(text);if(ir.type==='SolidColorBrush')return {Color:ir.props.Color||text};if(['Color','String','Thickness'].includes(ir.type))return text;return ir;}
  function resolveValue(value,control){return value?.kind==='resource'?resource(control,value.key):value;}
  function readResources(list,control){for(const ir of list){if(ir.type==='ResourceDictionary')readResources(ir.children,control);else if(ir.key)control.Resources.set(ir.key,scalar(ir,control));else throw new Error('Resource objects require x:Key');}}
  function matches(control,selector){const m=/^([A-Za-z_]\w*)?(?:\.([A-Za-z_]\w*))?(?::(pointerover|pressed|disabled|focus|checked))?$/.exec(selector||'');if(!m)return false;return(!m[1]||m[1]===control._type)&&(!m[2]||String(control.Classes||'').split(/\s+/).includes(m[2]))&&(!m[3]||(m[3]==='disabled'?!control.IsEnabled:control._state.has(m[3])));}
  function applyStyles(control){
    if(control._applyingStyles||control._disposed)return;control._applyingStyles=true;
    try{const styles=[];for(let p=control;p;p=p._parent)styles.unshift(...p._styles);const values=new Map();for(const style of styles)if(matches(control,style.props.Selector))for(const setter of style.children)if(setter.type==='Setter')values.set(setter.props.Property,resolveValue(setter.props.Value,control));
      for(const name of control._styleProperties||[])if(!values.has(name))control.ClearValue(name,20);for(const [name,value]of values)control.SetValue(name,value,20);control._styleProperties=[...values.keys()];
    }finally{control._applyingStyles=false;}
  }
  return {bind,scalar,resolveValue,readResources,matches,applyStyles};
}
