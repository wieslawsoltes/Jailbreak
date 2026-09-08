/** Reusable native-control host; no compiler or IDE dependencies. */
export function createControlClass({doc,dotnet,ObservableObject,allControls,defaults,boolean,numeric,bool,num,applyStyles,report,drawingBackend,definitions,build,flush,schedule,resetBudget,applyProperty}) {
  class Control extends ObservableObject {
    constructor(type='Control'){
      super();if(!doc)throw new Error('Control creation requires a document host');
      this._type=type;this._layers=new Map();this._parent=null;this._children=[];this._events=new Map();this._disposers=[];this._nativeDisposers=[];this._styles=[];this._state=new Set();this._names=new Map();this._owner=this;this._disposed=false;this._building=false;
      this.Resources=new dotnet.Dictionary();
      const owner=this;
      this.Children=new class extends dotnet.List{Add(child){owner.add(child);return owner._children.length-1;}Remove(child){const i=owner._children.indexOf(child);if(i<0)return false;owner._children.splice(i,1);child.element.remove();child._parent=null;return true;}Clear(){for(const child of [...owner._children])child.dispose();owner._children=[];}get Count(){return owner._children.length;}[Symbol.iterator](){return owner._children[Symbol.iterator]();}}();
      this._createElement();allControls.add(this);
    }
    _createElement(){
      const t=this._type,tags={Button:'button',RepeatButton:'button',ToggleButton:'button',TextBox:'input',Slider:'input',NumericUpDown:'input',ProgressBar:'progress',ComboBox:'select',ComboBoxItem:'option',ListBoxItem:'button',CheckBox:'label',RadioButton:'label',ToggleSwitch:'label',TextBlock:'div',Label:'label',Expander:'details',Separator:'hr',Image:'img',DatePicker:'input',CalendarDatePicker:'input',TimePicker:'input',DrawingSurface:'canvas',Rectangle:'div',Ellipse:'div',MenuItem:'button'};
      this.element=doc.createElement(tags[t]||'div');this.element.className='jb-control jb-'+t.toLowerCase();this.element.dataset.control=t;this._contentHost=this.element;
      if(['Button','RepeatButton','ToggleButton','ListBoxItem','MenuItem'].includes(t))this.element.type='button';
      if(['CheckBox','RadioButton','ToggleSwitch'].includes(t)){this.input=doc.createElement('input');this.input.type=t==='RadioButton'?'radio':'checkbox';this.label=doc.createElement('span');this.element.append(this.input,this.label);this._contentHost=this.label;if(t==='ToggleSwitch')this.input.setAttribute('role','switch');}
      if(['TextBox','Slider','NumericUpDown','DatePicker','CalendarDatePicker','TimePicker'].includes(t)){this.input=this.element;this.input.type=({Slider:'range',NumericUpDown:'number',DatePicker:'date',CalendarDatePicker:'date',TimePicker:'time'})[t]||'text';}
      if(t==='ContentPage'){this.header=doc.createElement('header');this._contentHost=doc.createElement('div');this._contentHost.className='jb-content';this.element.append(this.header,this._contentHost);}
      if(t==='Expander'){this.header=doc.createElement('summary');this._contentHost=doc.createElement('div');this._contentHost.className='jb-content';this.element.append(this.header,this._contentHost);}
      if(t==='TabControl'){this.tabs=doc.createElement('div');this.tabs.className='jb-tabs';this.tabs.setAttribute('role','tablist');this._contentHost=doc.createElement('div');this.element.append(this.tabs,this._contentHost);}
      if(t==='ListBox')this.element.setAttribute('role','listbox');
      if(t==='Canvas')this.element.style.position='relative';
      if(t==='Ellipse')this.element.style.borderRadius='50%';
      if(t==='DrawingSurface'){this.element.width=600;this.element.height=240;this.element.setAttribute('aria-label','Accelerated drawing surface');}
      this._wireNative();
    }
    _wireNative(){
      for(const d of this._nativeDisposers)d();this._nativeDisposers=[];
      const listen=(el,event,fn)=>{el.addEventListener(event,fn);this._nativeDisposers.push(()=>el.removeEventListener(event,fn));},t=this._type;
      const dispatch=(name,event)=>this.emit(name,event);
      listen(this.element,'click',e=>{
        if(!this.IsEnabled){e.preventDefault();return;}
        if(t==='ToggleButton')this.IsChecked=this.IsThreeState?(this.IsChecked===false?true:this.IsChecked===true?null:false):!this.IsChecked;
        if(['Button','RepeatButton','ToggleButton','MenuItem'].includes(t)){const cmd=this.Command;if(cmd){if(typeof cmd==='function')cmd(this.CommandParameter);else cmd.Execute(this.CommandParameter);}dispatch('Click',e);}
      });
      if(['CheckBox','RadioButton','ToggleSwitch'].includes(t)){
        listen(this.input,'change',e=>{const current=this.IsChecked;this.IsChecked=t==='RadioButton'?true:this.IsThreeState?(current===false?true:current===true?null:false):this.input.checked;
          if(t==='RadioButton'&&this.IsChecked)for(const other of allControls)if(other!==this&&other._type==='RadioButton'&&other._owner===this._owner&&(this.GroupName?other.GroupName===this.GroupName:!other.GroupName&&other._parent===this._parent))other.IsChecked=false;
          dispatch(this.IsChecked?'Checked':'Unchecked',e);dispatch('IsCheckedChanged',e);
        });
      }
      if(t==='TextBox')listen(this.input,'input',e=>{this.Text=this.input.value;dispatch('TextChanged',e);});
      if(['Slider','NumericUpDown'].includes(t))listen(this.input,'input',e=>{this.Value=Number(this.input.value);dispatch('ValueChanged',e);});
      if(t==='ComboBox')listen(this.element,'change',e=>{this.SelectedIndex=this.element.selectedIndex;this.SelectedItem=this._items?.[this.SelectedIndex]??null;dispatch('SelectionChanged',e);});
      if(['DatePicker','CalendarDatePicker'].includes(t))listen(this.input,'change',e=>{this.SelectedDate=this.input.value;dispatch('SelectionChanged',e);});
      if(t==='TimePicker')listen(this.input,'change',e=>{this.SelectedTime=this.input.value;dispatch('SelectionChanged',e);});
      if(t==='Expander')listen(this.element,'toggle',()=>{this.IsExpanded=this.element.open;});
      for(const [native,name]of Object.entries({pointerdown:'PointerPressed',pointerup:'PointerReleased',pointermove:'PointerMoved',keydown:'KeyDown',keyup:'KeyUp',focusin:'GotFocus',focusout:'LostFocus'}))listen(this.element,native,e=>dispatch(name,e));
      for(const [native,state,on]of [['pointerenter','pointerover',true],['pointerleave','pointerover',false],['pointerdown','pressed',true],['pointerup','pressed',false],['focusin','focus',true],['focusout','focus',false]])listen(this.element,native,()=>{on?this._state.add(state):this._state.delete(state);applyStyles(this);});
    }
    _reconcileRadio(){
      if(this._type!=='RadioButton'||!this.IsChecked)return;
      for(const other of allControls)if(other!==this&&other._type==='RadioButton'&&other._owner===this._owner&&(this.GroupName?other.GroupName===this.GroupName:!other.GroupName&&other._parent===this._parent))other.IsChecked=false;
    }
    GetValue(property){
      const name=typeof property==='string'?property:property.Name;if(name==='IsEnabled'&&this._parent&&!this._parent.IsEnabled)return false;const entries=this._layers.get(name);if(entries?.size)return [...entries.entries()].sort((a,b)=>b[0]-a[0])[0][1];
      if((name==='DataContext'||property?.inherits)&&this._parent)return this._parent.GetValue(property);
      return typeof property==='object'?property.defaultValue:defaults[name]??null;
    }
    SetValue(property,value,priority=100){
      const name=typeof property==='string'?property:property.Name;if(property?.coerce)value=property.coerce(value);
      if(boolean.has(name))value=bool(value);if(numeric.has(name)&&value!=null&&value!=='Auto'&&name!=='BorderThickness')value=num(value);
      const old=this.GetValue(property);let map=this._layers.get(name);if(!map)this._layers.set(name,map=new Map());map.set(priority,value);const next=this.GetValue(property);
      if(!Object.is(old,next)){this._apply(name,next);this.notify(name,old,next);}
      return value;
    }
    ClearValue(property,priority=100){const name=typeof property==='string'?property:property.Name,old=this.GetValue(property);this._layers.get(name)?.delete(priority);const next=this.GetValue(property);if(!Object.is(old,next)){this._apply(name,next);this.notify(name,old,next);}}
    _setContent(value){
      for(const c of [...this._children]){if(c===value)continue;c.dispose();}this._children=this._children.filter(c=>c===value);this._contentHost.replaceChildren();
      if(value instanceof Control){if(value._parent!==this)this.add(value);else this._contentHost.append(value.element);}else if(value!=null)this._contentHost.textContent=String(value).replace(/_(.)/g,'$1');
    }
    _layoutAttached(){const s=this.element.style;if(this._parent?._type==='Grid'){s.gridRow=`${(this.GetValue('Grid.Row')||0)+1} / span ${this.GetValue('Grid.RowSpan')||1}`;s.gridColumn=`${(this.GetValue('Grid.Column')||0)+1} / span ${this.GetValue('Grid.ColumnSpan')||1}`;}
      if(this._parent?._type==='Canvas'){s.position='absolute';for(const side of ['Left','Top','Right','Bottom']){const v=this.GetValue('Canvas.'+side);if(v!=null)s[side.toLowerCase()]=`${v}px`;}}
      if(this._parent?._type==='DockPanel')this._parent._dockLayout();
    }
    _dockLayout(){
      this.element.style.display='grid';let top=1,bottom=100,left=1,right=100;
      for(const[i,c]of this._children.entries()){const last=i===this._children.length-1&&this.LastChildFill,dock=c.GetValue('DockPanel.Dock')||'Left';c.element.style.gridRow=`${top}/${bottom}`;c.element.style.gridColumn=`${left}/${right}`;
        if(!last){if(dock==='Top')c.element.style.gridRow=`${top++}/${top}`;else if(dock==='Bottom')c.element.style.gridRow=`${--bottom}/${bottom+1}`;else if(dock==='Right')c.element.style.gridColumn=`${--right}/${right+1}`;else c.element.style.gridColumn=`${left++}/${left}`;}}
    }
    add(child){
      if(!(child instanceof Control))throw new TypeError('A visual child must be a Control');if(child===this)throw new Error('A control cannot contain itself');
      for(let p=this;p;p=p._parent)if(p===child)throw new Error('Visual-tree cycle');
      if(child._parent&&child._parent!==this)child._parent.Children.Remove(child);if(!this._children.includes(child))this._children.push(child);
      child._parent=this;child._owner=this._owner;this._contentHost.append(child.element);child._layoutAttached();child._reconcileRadio();child._apply('IsEnabled',child.IsEnabled);
      if(this._type==='TabControl')this._refreshTabs();if(['ComboBox','ListBox'].includes(this._type))this._refreshItems();schedule();return child;
    }
    _refreshItems(){
      if(!['ComboBox','ListBox','ItemsControl'].includes(this._type))return;
      const raw=this.ItemsSource??this.GetValue('Items')??this._children;const items=raw==null?[]:Array.from(raw);this._items=items;this._itemControls?.forEach(c=>c.dispose());this._itemControls=[];this.element.replaceChildren();
      items.forEach((item,index)=>{
        if(this._type==='ComboBox'){const option=doc.createElement('option');option.textContent=String(item instanceof Control?item.Content||item.Text||'':item);option.value=String(index);this.element.append(option);}
        else if(this._type==='ListBox'){const button=doc.createElement('button');button.type='button';button.className='jb-control jb-listboxitem';button.setAttribute('role','option');button.textContent=String(item instanceof Control?item.Content||item.Text||'':item);button.setAttribute('aria-selected',String(index===this.SelectedIndex));button.addEventListener('click',e=>{this.SelectedIndex=index;this.SelectedItem=item;this.emit('SelectionChanged',e);});this.element.append(button);}
        else {const template=this._itemTemplate;if(template){const control=build(template,this._owner,{dataContext:item,parent:this,template:true});this._itemControls.push(control);this.element.append(control.element);}else{const div=doc.createElement('div');div.textContent=String(item);this.element.append(div);}}
      });if(this._type==='ComboBox')this.element.selectedIndex=this.SelectedIndex;
    }
    _refreshTabs(){if(this._type!=='TabControl')return;this.tabs.replaceChildren();let selected=this.SelectedIndex;if(selected<0)selected=0;this._children.forEach((c,i)=>{const button=doc.createElement('button');button.type='button';button.textContent=c.Header||`Tab ${i+1}`;button.setAttribute('role','tab');button.setAttribute('aria-selected',String(i===selected));button.addEventListener('click',e=>{this.SelectedIndex=i;this.emit('SelectionChanged',e);});this.tabs.append(button);c.element.style.display=i===selected?'':'none';});}
    async _redraw(){
      if(this._type!=='DrawingSurface'||this._disposed)return;if(!drawingBackend){report('JB4100','No drawing backend is registered');return;}
      if(!this._surfacePromise)this._surfacePromise=drawingBackend(this.element,{onCanvasReplace:canvas=>{this.element=canvas;},onStatus:status=>{this.element.dataset.backend=status.backend;report('JB4101',status.message||status.backend,'info');}});
      try{const surface=await this._surfacePromise;if(this._disposed){surface.dispose();return;}this._surface=surface;let scene=this.Scene;
        if(scene==='Bars'||scene==null){scene=Array.from({length:24},(_,i)=>({x:12+i*23,y:30+(Math.sin(i*.68)+1)*35,width:14,height:120-(Math.sin(i*.68)+1)*35,color:[.4+i*.01,.34,.9,1],radius:4}));}
        if(!Array.isArray(scene))throw new Error('DrawingSurface.Scene must be a primitive array or Bars');surface.render(scene,this.ClearColor||[.08,.09,.14,1]);
      }catch(e){report('JB4102',e.message);}
    }
    on(name,fn){if(typeof fn!=='function')throw new TypeError(`Handler for ${name} must be callable`);let set=this._events.get(name);if(!set)this._events.set(name,set=new Set());set.add(fn);return()=>set.delete(fn);}
    off(name,fn){this._events.get(name)?.delete(fn);}
    emit(name,nativeEvent){
      if(this._disposed)return;resetBudget();const args={Source:this,Handled:false,Key:nativeEvent?.key,Value:this.Value,IsChecked:this.IsChecked,OriginalEvent:nativeEvent};
      const pending=[];try{for(let c=this;c;c=c._parent){for(const fn of c._events.get(name)||[]){const result=fn(this,args);if(result?.then)pending.push(result);}if(args.Handled)break;}flush();Promise.all(pending).then(()=>flush()).catch(e=>report('JB4002',e.message));}catch(e){report('JB4002',e.message);}if(args.Handled)nativeEvent?.preventDefault?.();
    }
    FindControl(name){return this._owner._names.get(name)||this._names.get(name)||null;}
    FindName(name){return this.FindControl(name);}
    InitializeComponent(){const def=definitions.get(this.constructor.__typeName);if(!def)throw new Error(`No XAML definition for ${this.constructor.__typeName}`);if(this._initialized)return;this._initialized=true;build(def,this);}
    Focus(){(this.input||this.element).focus();return true;}
    Show(){this.IsVisible=true;}
    Close(){this.dispose();}
    InvalidateVisual(){this._redraw();}
    dispose(){if(this._disposed)return;this._disposed=true;for(const c of [...this._children])c.dispose();for(const d of [...this._disposers,...this._nativeDisposers])d();this._itemsDispose?.();this._commandDispose?.();this._surface?.dispose();this._surfacePromise?.then(s=>s.dispose()).catch(()=>{});this._listeners.clear();this._events.clear();allControls.delete(this);this.element.remove();}
  }
  Control.prototype._apply=applyProperty;
  return Control;
}
