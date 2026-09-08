import { renderProgress, progressState } from './progress.js';
import { applyControlTheme, applyControlTemplate, renderControlTemplate, releaseControlTemplate, renderDataContent } from './templates.js';
import { Event, ObservableCollection, RoutedEventArgs, notify, formatValue, DateTime } from '../dotnet-runtime/index.js';
import { StyledObject, AvaloniaProperty, ResourceDictionary } from './properties.js';
import { controlDefinitions,commonProperties,eventNames } from './schema.js';
import { applyCommon,applyStyles,gridTracks,dimension,brush } from './styling.js';
import { PrimitiveSurface,demoScene } from '../renderer/index.js';
const queue=new Set();let scheduled=false,id=0;
export function flushLayout(){scheduled=false;const controls=[...queue];queue.clear();for(const control of controls)if(!control._disposed&&control.element)control.render();}
function schedule(control){queue.add(control);if(!scheduled){scheduled=true;queueMicrotask(flushLayout);}}
const defaults={IsEnabled:true,IsVisible:true,Opacity:1,Minimum:0,Maximum:100,Value:0,IsChecked:false,IsThreeState:false,IsExpanded:false,SelectedIndex:-1,Text:'',Spacing:0,Orientation:'Vertical',IsPaneOpen:false,OpenPaneLength:200,LastChildFill:true,IsReadOnly:false,Focusable:false};
const numericProperties=new Set('Width Height MinWidth MinHeight MaxWidth MaxHeight FontSize Opacity Spacing RowSpacing ColumnSpacing Minimum Maximum Value Increment TickFrequency SelectedIndex MaxLength Delay Interval OpenPaneLength CompactPaneLength ItemWidth ItemHeight ZIndex CaretIndex SelectionStart SelectionEnd ItemCount'.split(' '));
const boolProperties=new Set('IsEnabled IsVisible IsChecked IsThreeState IsExpanded IsPaneOpen IsReadOnly AcceptsReturn AcceptsTab IsIndeterminate IsDefault IsCancel LastChildFill IsSnapToTickEnabled Focusable ClipToBounds IsSelected ShowProgressText DayVisible MonthVisible YearVisible UseLayoutRounding'.split(' '));
class ChildCollection extends ObservableCollection {
  constructor(owner){super();this.owner=owner;}
  Add(item){if(item instanceof Control){if(item.parent&&item.parent!==this.owner)item.parent.Children.Remove(item);item.parent=this.owner;item.inheritChanged('DataContext');}super.Add(item);this.owner.invalidate('children');}
  Remove(item){const removed=super.Remove(item);if(removed&&item instanceof Control){item.element?.remove();item.parent=null;item.inheritChanged('DataContext');}this.owner.invalidate('children');return removed;}
  Clear(){for(const item of this){if(item instanceof Control){item.element?.remove();item.parent=null;}}super.Clear();this.owner.invalidate('children');}
}
function accessText(value){return formatValue(value).replace(/__/g,'\u0000').replace(/_/g,'').replace(/\u0000/g,'_');}
export class Control extends StyledObject {
  constructor(type='Control'){
    super();this.type=type;this.uid='jb-'+(++id);this.parent=null;this.element=null;this.container=null;this._children=new ChildCollection(this);this.Resources=new ResourceDictionary();this.Styles=[];this.pseudos=new Set();this._dirty=new Set(['*']);this._generated=[];this._itemCache=[];
    for(const [name,value]of Object.entries(defaults))this._metadata.set(name,new AvaloniaProperty(Control,name,name==='Orientation'&&['Slider','ScrollBar','ProgressBar'].includes(type)?'Horizontal':value,{inherits:name==='DataContext'}));
    for(const event of eventNames)this[event]=new Event();
  }
  get Children(){return this._children;}get Items(){return this._children;}
  get effectiveEnabled(){return this.IsEnabled!==false&&(!this.parent||this.parent.effectiveEnabled);}
  get root(){let value=this;while(value.parent)value=value.parent;return value;}
  get visualChildren(){return [...new Set([...this.Children,...(this.type==='ContentPresenter'&&this.TemplatedParent?[]:[this.Content]),this._templateInstance?.root,this._contentTemplateRoot,...this._generated].filter(x=>x instanceof Control))];}
  SetValue(property,value,priority=1000){const name=this.propertyName(property);
    if(numericProperties.has(name)&&value!=null&&value!=='Auto'&&value!=='NaN')value=Number(value);
    if(boolProperties.has(name)&&typeof value==='string')value=value.toLowerCase()==='true';
    if(name==='Value'&&value!=null)value=Math.min(Number(this.Maximum??100),Math.max(Number(this.Minimum??0),Number(value)));
    return super.SetValue(property,value,priority);
  }
  onPropertyChanged(name,value,old){
    if(name==='DataContext'||name==='IsEnabled')for(const child of this.visualChildren)child.inheritChanged(name);
    if(name==='Content'&&!(this.type==='ContentPresenter'&&this.TemplatedParent)&&value instanceof Control){value.parent=this;value.inheritChanged('DataContext');}
    if(name==='Content'&&!(this.type==='ContentPresenter'&&this.TemplatedParent)&&old instanceof Control&&old!==value){old.element?.remove();old.parent=null;}
    if(name==='ItemsSource'){this._offItems?.();this._offItems=value?.CollectionChanged?.add(()=>this.invalidate('items'));}
    if(name==='Command'){this._offCommand?.();this._offCommand=value?.CanExecuteChanged?.add(()=>this.invalidate('Command'));}
    if(this.type==='ProgressBar'&&['Value','Minimum','Maximum'].includes(name)){const percentage=this.Percentage;if(!Object.is(this._lastPercentage,percentage)){const previous=this._lastPercentage;this._lastPercentage=percentage;notify(this,'Percentage',percentage,previous);}}
    if(name==='Header')this.parent?.invalidate('children');
    if((name==='Minimum'||name==='Maximum')&&this.Value!=null)this.SetValue('Value',this.Value);
    this.invalidate(name);
  }
  inheritChanged(name){notify(this,name,this.GetValue(name),Symbol());this.invalidate(name);for(const child of this.visualChildren)child.inheritChanged(name);}
  invalidate(name='*'){this._dirty.add(name);schedule(this);}
  addChild(child){this.Children.Add(child);}
  FindControl(name){if(this._nameScope)return this._nameScope.get(name)??null;const scope=this.scope?.names;if(scope?.has(name))return scope.get(name);if(this.Name===name)return this;for(const child of this.visualChildren){const found=child.FindControl(name);if(found)return found;}return null;}
  FindName(name){return this.FindControl(name);}
  InitializeComponent(){if(!Control.xamlLoader)throw new Error('XAML loader is not installed');Control.xamlLoader(this);}
  ApplyTemplate(){applyControlTheme(this);return applyControlTemplate(this);}
  OnApplyTemplate(args){}
  FindTemplateChild(name){return this._templateInstance?.names.get(name)??null;}
  Focus(){(this.input??this.element)?.focus();return true;}
  Show(){this.IsVisible=true;}Hide(){this.IsVisible=false;}Close(){this.Dispose();}
  RaiseEvent(name,event=null){if(typeof name!=='string'){event=name;name=event.RoutedEvent?.Name??'Click';}return this.raise(name,event);}
  raise(name,event=null){const args=event instanceof RoutedEventArgs?event:new RoutedEventArgs(this,event);let current=this;while(current){current[name]?.Invoke(current,args);if(args.Handled)break;current=current.parent;}return args;}
  mount(host){if(this._disposed)throw new Error('Cannot mount a disposed control');if(!this.element)this.createElement();if(this.element.parentNode!==host)host.append(this.element);this.render();if(!this._loaded){this._loaded=true;queueMicrotask(()=>{if(!this._disposed)this.Loaded.Invoke(this,new RoutedEventArgs(this));});}return this.element;}
  createElement(){
    const t=this.type,tags={Button:'button',RepeatButton:'button',ToggleButton:'button',TextBlock:'div',Label:'label',TextBox:this.AcceptsReturn?'textarea':'input',AutoCompleteBox:'input',NumericUpDown:'input',Slider:'input',ScrollBar:'input',ProgressBar:'div',ComboBox:'select',Separator:'hr',CheckBox:'label',RadioButton:'label',ToggleSwitch:'label',Expander:'details',Image:'img',DatePicker:'input',CalendarDatePicker:'input',Calendar:'input',TimePicker:'input',Run:'span',LineBreak:'br'};
    this.element=document.createElement(tags[t]??'div');this.element.id=this.uid;this.container=this.element;
    if(['Button','RepeatButton','ToggleButton'].includes(t))this.element.type='button';
    if(['CheckBox','RadioButton','ToggleSwitch'].includes(t)){this.input=document.createElement('input');this.input.type=t==='RadioButton'?'radio':'checkbox';if(t==='ToggleSwitch')this.input.setAttribute('role','switch');this.label=document.createElement('span');this.element.append(this.input,this.label);this.container=this.label;
      this.input.addEventListener('change',event=>{const value=t!=='RadioButton'&&this.IsThreeState?(this.IsChecked===false?true:this.IsChecked===true?null:false):this.input.checked;this.IsChecked=value;this.input.checked=!!value;this.input.indeterminate=value===null;this.enforceRadioGroup();this.raise('IsCheckedChanged',event);if(value===true)this.raise('Checked',event);if(value===false)this.raise('Unchecked',event);});
    }
    if(['TextBox','AutoCompleteBox','NumericUpDown','Slider','ScrollBar','DatePicker','CalendarDatePicker','Calendar','TimePicker'].includes(t)){
      this.input=this.element;if(t==='NumericUpDown')this.input.type='number';if(t==='Slider'||t==='ScrollBar')this.input.type='range';if(t==='TextBox'&&!this.AcceptsReturn)this.input.type=this.PasswordChar?'password':'text';if(['DatePicker','CalendarDatePicker','Calendar'].includes(t))this.input.type='date';if(t==='TimePicker')this.input.type='time';
      this.input.addEventListener('input',event=>{if(['Slider','ScrollBar','NumericUpDown'].includes(t)){this.Value=this.input.value===''?null:Number(this.input.value);this.raise('ValueChanged',event);}else if(['DatePicker','CalendarDatePicker','Calendar'].includes(t)){this.SelectedDate=this.input.value?new DateTime(new Date(this.input.value+'T00:00:00')):null;this.raise('SelectionChanged',event);}else if(t==='TimePicker'){this.SelectedTime=this.input.value;this.raise('SelectionChanged',event);}else {this.Text=this.input.value;this.raise('TextChanged',event);}});
    }
    if(t==='ComboBox')this.element.addEventListener('change',event=>{this.SelectedIndex=this.element.selectedIndex;this.SelectedItem=this.currentItems[this.SelectedIndex]??null;this.raise('SelectionChanged',event);});
    if(t==='ListBox'){this.element.setAttribute('role','listbox');this.element.tabIndex=0;this.element.addEventListener('keydown',e=>{let next=this.SelectedIndex;if(e.key==='ArrowDown')next++;else if(e.key==='ArrowUp')next--;else if(e.key==='Home')next=0;else if(e.key==='End')next=this.currentItems.length-1;else return;e.preventDefault();this.select(Math.max(0,Math.min(this.currentItems.length-1,next)),e);if(this._virtual){this.element.scrollTop=this.SelectedIndex*34;this.invalidate('items');}});this.element.addEventListener('scroll',()=>{if(this._virtual)this.invalidate('items');});}
    if(t==='TabControl'){this.tabHeaders=document.createElement('div');this.tabHeaders.className='jb-tab-headers';this.tabHeaders.setAttribute('role','tablist');this.tabPanels=document.createElement('div');this.tabPanels.className='jb-tab-panels';this.element.append(this.tabHeaders,this.tabPanels);this.container=this.tabPanels;}
    if(t==='Expander'){this.headerElement=document.createElement('summary');this.container=document.createElement('div');this.container.className='jb-expander-content';this.element.append(this.headerElement,this.container);this.element.addEventListener('toggle',()=>{this.IsExpanded=this.element.open;});}
    if(t==='GroupBox'){this.headerElement=document.createElement('div');this.headerElement.className='jb-group-header';this.container=document.createElement('div');this.container.className='jb-group-content';this.element.append(this.headerElement,this.container);}
    if(t==='ContentPage'){this.headerElement=document.createElement('h1');this.headerElement.className='jb-page-header';this.container=document.createElement('div');this.element.append(this.headerElement,this.container);}
    if(t==='TreeViewItem'){this.headerElement=document.createElement('div');this.headerElement.className='jb-tree-header';this.headerElement.tabIndex=0;this.container=document.createElement('div');this.element.append(this.headerElement,this.container);this.headerElement.addEventListener('click',e=>{this.IsExpanded=!this.IsExpanded;this.IsSelected=true;let root=this.parent;while(root&&root.type!=='TreeView')root=root.parent;if(root)root.SelectedItem=this;this.raise('SelectionChanged',e);});}
    if(t==='MenuItem'){this.element=document.createElement(this.Children.length?'details':'button');this.element.id=this.uid;if(this.Children.length){this.headerElement=document.createElement('summary');this.container=document.createElement('div');this.container.className='jb-menu-children';this.element.append(this.headerElement,this.container);}else {this.element.type='button';this.container=this.element;}}
    if(t==='SplitView'){this.paneElement=document.createElement('div');this.paneElement.className='jb-split-pane';this.container=document.createElement('div');this.container.className='jb-split-content';this.element.append(this.paneElement,this.container);}
    if(['Rectangle','Ellipse','Path','Line','Polygon'].includes(t)){this.element=document.createElementNS('http://www.w3.org/2000/svg','svg');this.element.id=this.uid;const tag={Rectangle:'rect',Ellipse:'ellipse',Path:'path',Line:'line',Polygon:'polygon'}[t];this.shape=document.createElementNS('http://www.w3.org/2000/svg',tag);this.element.append(this.shape);}
    const domEvents={pointerdown:'PointerPressed',pointerup:'PointerReleased',pointermove:'PointerMoved',keydown:'KeyDown',keyup:'KeyUp',focusin:'GotFocus',focusout:'LostFocus',dblclick:'DoubleTapped'};
    for(const [dom,name]of Object.entries(domEvents))this.element.addEventListener(dom,event=>{if(event.target===this.element||event.target===this.input)this.raise(name,event);});
    for(const [dom,pseudo,active]of [['pointerenter','pointerover',true],['pointerleave','pointerover',false],['pointerdown','pressed',true],['pointerup','pressed',false],['focusin','focus',true],['focusout','focus',false]])this.element.addEventListener(dom,()=>{active?this.pseudos.add(pseudo):this.pseudos.delete(pseudo);this.invalidate('pseudo');});
    this.element.addEventListener('click',event=>{if(!this.effectiveEnabled)return;if(['CheckBox','RadioButton','ToggleSwitch'].includes(t)&&event.target!==this.input)return;if(['Button','RepeatButton','ToggleButton','MenuItem'].includes(t)){if(t==='ToggleButton')this.IsChecked=!this.IsChecked;if(this.Command?.CanExecute?.(this.CommandParameter)!==false)this.Command?.Execute?.(this.CommandParameter);this.raise('Click',event);}else if(event.target===this.element||event.target===this.input)this.raise('Tapped',event);});
    if(t==='RepeatButton'){let timer=null,delay=null;const clear=()=>{clearTimeout(delay);clearInterval(timer);};this.element.addEventListener('pointerdown',()=>{clear();delay=setTimeout(()=>{timer=setInterval(()=>{if(this.effectiveEnabled)this.raise('Click');},this.Interval??100);},this.Delay??400);});for(const e of ['pointerup','pointerleave','pointercancel'])this.element.addEventListener(e,clear);this.track(clear);}
  }
  enforceRadioGroup(){if(this.type!=='RadioButton'||!this.IsChecked)return;const group=this.GroupName||this.parent?.uid||this.uid;const root=this.root;root._radios??=new Set();for(const radio of root._radios)if(radio!==this&&(radio.GroupName||radio.parent?.uid||radio.uid)===group)radio.IsChecked=false;root._radios.add(this);}
  select(index,event){if(index<0||index>=this.currentItems.length)return;this.SelectedIndex=index;this.SelectedItem=this.currentItems[index];this.raise('SelectionChanged',event);}
  get Percentage(){return progressState(this.Minimum,this.Maximum,this.Value).percentage;}
  get currentItems(){return Array.from(this.ItemsSource??this.Items??[]);}
  contentText(){const content=this.Content??this.Text??'';return content instanceof Control?content.element?.textContent??'':accessText(content);}
  renderContent(){if(renderDataContent(this))return;const content=this.Content;const controls=content instanceof Control?[content]:this.Children.filter(x=>x instanceof Control);if(controls.length){for(const [at,child]of controls.entries()){if(!(this.type==='ContentPresenter'&&this.TemplatedParent))child.parent=this;child.mount(this.container);if(this.container.children[at]!==child.element)this.container.insertBefore(child.element,this.container.children[at]??null);}const elements=new Set(controls.map(c=>c.element));for(const node of [...this.container.childNodes])if(!elements.has(node))node.remove();}else {const text=this.contentText();if(this.container.textContent!==text)this.container.textContent=text;}}
  itemControl(item,index){const old=this._itemCache[index];if(old&&old.item===item)return old.control;old?.control?.Dispose();let control;if(item instanceof Control)control=item;else if(this.ItemTemplate?.build)control=this.ItemTemplate.build(item,this);else {control=new Control('TextBlock');control.Text=formatValue(item);}control.parent=this;this._itemCache[index]={item,control};return control;}
  renderItems(){
    const items=this.currentItems,t=this.type;
    if(!['*','ItemsSource','children','items','SelectedIndex','SelectedItem','ItemTemplate'].some(k=>this._dirty.has(k)))return;
    if(this.SelectedItem!=null&&items.includes(this.SelectedItem)&&this._dirty.has('SelectedItem'))this.SelectedIndex=items.indexOf(this.SelectedItem);
    if(t==='ComboBox'){
      if(this._dirty.has('*')||this._dirty.has('ItemsSource')||this._dirty.has('children')||this._dirty.has('items')){this.element.replaceChildren();for(let i=0;i<items.length;i++){const option=document.createElement('option');option.value=String(i);option.textContent=items[i]instanceof Control?items[i].contentText():formatValue(items[i]);this.element.append(option);}}
      this.element.selectedIndex=Number(this.SelectedIndex);return;
    }
    if(t==='TabControl'){
      if(this.SelectedIndex<0&&items.length)this.SelectedIndex=0;
      this._tabButtons??=[];const panels=[];
      for(let i=0;i<items.length;i++){
        const control=this.itemControl(items[i],i);panels.push(control);let button=this._tabButtons[i];
        if(!button){button=document.createElement('button');button.type='button';button.setAttribute('role','tab');button.addEventListener('click',e=>this.select(Number(button.dataset.index),e));button.addEventListener('keydown',e=>{const index=Number(button.dataset.index);if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();this.select((index+(e.key==='ArrowRight'?1:this.currentItems.length-1))%this.currentItems.length,e);queueMicrotask(()=>this.tabHeaders.children[this.SelectedIndex]?.focus());}});this._tabButtons[i]=button;}
        button.dataset.index=i;button.textContent=accessText(control.Header??`Tab ${i+1}`);button.setAttribute('aria-selected',String(i===this.SelectedIndex));button.setAttribute('aria-controls',control.uid);button.tabIndex=i===this.SelectedIndex?0:-1;
        if(this.tabHeaders.children[i]!==button)this.tabHeaders.insertBefore(button,this.tabHeaders.children[i]??null);
        control._tabVisible=i===this.SelectedIndex;control.mount(this.tabPanels);control.element.setAttribute('role','tabpanel');control.element.style.display=control._tabVisible?'':'none';
      }
      for(const button of this._tabButtons.splice(items.length))button.remove();
      for(const node of [...this.tabPanels.childNodes])if(!panels.some(c=>c.element===node))node.remove();this._generated=panels;return;
    }
    this._virtual=t==='ListBox'&&items.length>1000&&!this.ItemTemplate;const start=this._virtual?Math.max(0,Math.floor(this.element.scrollTop/34)-8):0,end=this._virtual?Math.min(items.length,start+80):items.length;
    const fragment=document.createDocumentFragment(),generated=[];
    if(this._virtual){const spacer=document.createElement('div');spacer.style.height=start*34+'px';spacer.setAttribute('aria-hidden','true');fragment.append(spacer);}
    for(let i=start;i<end;i++){
      const item=items[i],child=this.itemControl(item,i);generated.push(child);
      if(t==='ListBox'){const row=document.createElement('div');row.className='jb-list-row';row.setAttribute('role','option');row.setAttribute('aria-selected',String(i===this.SelectedIndex));row.setAttribute('aria-posinset',String(i+1));row.setAttribute('aria-setsize',String(items.length));if(this._virtual)row.style.height='34px';row.addEventListener('click',e=>{if(this.effectiveEnabled)this.select(i,e);});child.mount(row);fragment.append(row);}else child.mount(fragment);
    }
    if(this._virtual){const spacer=document.createElement('div');spacer.style.height=(items.length-end)*34+'px';spacer.setAttribute('aria-hidden','true');fragment.append(spacer);}
    this.container.replaceChildren(fragment);this._generated=generated;
    for(let i=items.length;i<this._itemCache.length;i++)this._itemCache[i]?.control?.Dispose();this._itemCache.length=items.length;
  }
  render(){
    if(!this.element||this._disposed)return;applyControlTheme(this);applyStyles(this);const t=this.type,element=this.element,dirty=this._dirty;applyCommon(this);
    if(this.input)this.input.disabled=!this.effectiveEnabled;if('disabled'in element)element.disabled=!this.effectiveEnabled||(!!this.Command&&this.Command.CanExecute?.(this.CommandParameter)===false);
    if(renderControlTemplate(this)){this._dirty.clear();return;}
    if(['StackPanel','WrapPanel'].includes(t)){element.style.flexDirection=this.Orientation==='Horizontal'?'row':'column';element.style.gap=dimension(this.Spacing);}
    if(t==='Grid'){element.style.gridTemplateColumns=gridTracks(this.ColumnDefinitions);element.style.gridTemplateRows=gridTracks(this.RowDefinitions);element.style.rowGap=dimension(this.RowSpacing);element.style.columnGap=dimension(this.ColumnSpacing);}
    if(t==='DockPanel'){element.style.display=this.IsVisible===false?'none':'grid';element.style.gridTemplateColumns='auto minmax(0,1fr) auto';element.style.gridTemplateRows='auto minmax(0,1fr) auto';for(const child of this.Children){if(!(child instanceof Control))continue;const dock=child.GetValue('DockPanel.Dock')??'Left';child.mount(this.container);const areas={Top:'1 / 1 / 2 / 4',Bottom:'3 / 1 / 4 / 4',Left:'2 / 1 / 3 / 2',Right:'2 / 3 / 3 / 4'};child.element.style.gridArea=this.LastChildFill&&child===this.Children.at(-1)?'2 / 2 / 3 / 3':areas[dock];}}
    if(t==='TextBlock'||t==='Run'){if(element.textContent!==formatValue(this.Text))element.textContent=formatValue(this.Text);element.style.textAlign=this.TextAlignment?.toLowerCase()??'';element.style.whiteSpace=this.TextWrapping==='NoWrap'?'nowrap':'pre-wrap';if(this.TextTrimming&&this.TextTrimming!=='None'){element.style.overflow='hidden';element.style.textOverflow='ellipsis';}}
    else if(['TextBox','AutoCompleteBox'].includes(t)){if(element.value!==String(this.Text??''))element.value=String(this.Text??'');element.placeholder=this.Watermark??'';element.readOnly=!!this.IsReadOnly;if(this.MaxLength>0)element.maxLength=this.MaxLength;else element.removeAttribute('maxlength');}
    else if(t==='ProgressBar')renderProgress(this);
    else if(['Slider','ScrollBar','NumericUpDown'].includes(t)){element.min=this.Minimum??0;element.max=this.Maximum??100;if(t==='ProgressBar'&&this.IsIndeterminate)element.removeAttribute('value');else element.value=this.Value??0;if(t!=='ProgressBar')element.step=this.IsSnapToTickEnabled?this.TickFrequency??1:t==='NumericUpDown'?this.Increment??1:'any';if(t==='NumericUpDown')element.readOnly=!!this.IsReadOnly;if(this.Orientation==='Vertical'&&(t==='Slider'||t==='ScrollBar'))element.style.writingMode='vertical-lr';else element.style.writingMode='';}
    else if(['CheckBox','RadioButton','ToggleSwitch'].includes(t)){this.input.checked=!!this.IsChecked;this.input.indeterminate=this.IsChecked==null;this.input.setAttribute('aria-checked',this.IsChecked==null?'mixed':String(!!this.IsChecked));if(t==='RadioButton'){this.input.name=(this.root.uid+'-'+(this.GroupName||this.parent?.uid||this.uid));this.enforceRadioGroup();}this.renderContent();}
    else if(['DatePicker','CalendarDatePicker','Calendar'].includes(t)){const date=this.SelectedDate?.value??this.SelectedDate;const value=date instanceof Date?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`:date??'';if(element.value!==value)element.value=value;}
    else if(t==='TimePicker')element.value=this.SelectedTime??'';
    else if(['ItemsControl','ListBox','ComboBox','TabControl','TreeView'].includes(t))this.renderItems();
    else if(['Rectangle','Ellipse','Path','Line','Polygon'].includes(t)){const w=Number(this.Width)||100,h=Number(this.Height)||100;element.setAttribute('viewBox',`0 0 ${w} ${h}`);element.setAttribute('width',String(w));element.setAttribute('height',String(h));this.shape.setAttribute('fill',brush(this.Fill)||'transparent');this.shape.setAttribute('stroke',brush(this.Stroke)||'none');this.shape.setAttribute('stroke-width',String(this.StrokeThickness??1));if(t==='Rectangle'){this.shape.setAttribute('width',String(w));this.shape.setAttribute('height',String(h));this.shape.setAttribute('rx',String(this.RadiusX??0));this.shape.setAttribute('ry',String(this.RadiusY??this.RadiusX??0));}if(t==='Ellipse'){for(const [k,v]of Object.entries({cx:w/2,cy:h/2,rx:w/2,ry:h/2}))this.shape.setAttribute(k,String(v));}if(t==='Path')this.shape.setAttribute('d',String(this.Data??''));if(t==='Polygon')this.shape.setAttribute('points',String(this.Points??''));if(t==='Line'){const a=String(this.StartPoint??'0,0').split(','),b=String(this.EndPoint??`${w},${h}`).split(',');for(const [k,v]of Object.entries({x1:a[0],y1:a[1],x2:b[0],y2:b[1]}))this.shape.setAttribute(k,v);}}
    else if(t==='Image'){const source=Control.assetResolver?.(this.Source)??this.Source??'';if(element.getAttribute('src')!==source)element.setAttribute('src',source);element.alt=this.GetValue('ToolTip.Tip')??'Image';element.style.objectFit=this.Stretch==='Fill'?'fill':this.Stretch==='UniformToFill'?'cover':'contain';}
    else if(t==='GpuSurface'){if(!this.surface){this.surface=new PrimitiveSurface(element,{onStatus:status=>{element.dataset.renderer=status;Control.onRendererStatus?.(status);}});this.track(this.surface);}if(dirty.has('*')||dirty.has('Scene')||dirty.has('ItemCount'))this.surface.setScene(Array.isArray(this.Scene)?this.Scene:demoScene(Number(this.Width)||720,Number(this.Height)||320,Number(this.ItemCount)||3000));}
    else if(t!=='DockPanel')this.renderContent();
    if(this.headerElement)this.headerElement.textContent=accessText(this.Header??'');
    if(t==='Expander')element.open=!!this.IsExpanded;
    if(t==='TreeViewItem'){this.container.style.display=this.IsExpanded?'':'none';element.setAttribute('aria-selected',String(!!this.IsSelected));this.headerElement.textContent=(this.Children.length?(this.IsExpanded?'▾ ':'▸ '):'')+accessText(this.Header??'');}
    if(t==='ToggleButton')element.setAttribute('aria-pressed',String(!!this.IsChecked));
    if(t==='MenuItem'&&!this.headerElement)element.textContent=accessText(this.Header??this.Content??'');
    if(t==='SplitView'){this.paneElement.style.display=this.IsPaneOpen?'':'none';this.paneElement.style.width=dimension(this.OpenPaneLength);if(this.Pane instanceof Control)this.Pane.mount(this.paneElement);}
    if(this.Theme?.kind==='presetTheme')element.classList.add('jb-scroll-page');
    this._dirty.clear();
  }
  Dispose(){
    if(this._disposed||this._disposing)return;this._disposing=true;
    const errors=[],run=fn=>{try{fn();}catch(error){errors.push(error);}};
    run(()=>this.Unloaded.Invoke(this,new RoutedEventArgs(this)));
    run(()=>releaseControlTemplate(this));
    for(const child of this.visualChildren)run(()=>child.Dispose());
    for(const c of this._itemCache)run(()=>c?.control?.Dispose());
    run(()=>this._offItems?.());run(()=>this._offCommand?.());run(()=>this.Resources.Dispose());
    this.root._radios?.delete(this);this.element?.remove();queue.delete(this);
    for(const name of eventNames)this[name].clear();run(()=>super.Dispose());this._disposing=false;
    if(errors.length)throw new AggregateError(errors,'Control disposal failed after completing cleanup');
  }
}
const properties=new Set([...commonProperties,...Object.values(controlDefinitions).flatMap(p=>p.split(' ')),'Content','Child','Header','Text','DataContext']);
for(const property of properties){if(!property||property.includes('.')||property in Control.prototype||['Children','Items','Resources','Styles'].includes(property))continue;Object.defineProperty(Control.prototype,property,{get(){return this.GetValue(property);},set(value){this.SetValue(property,value);},configurable:true});}
export const controls={Control};
for(const name of Object.keys(controlDefinitions))if(name!=='Control'){const C=class extends Control {constructor(){super(name);}};Object.defineProperty(C,'name',{value:name});for(const property of properties)if(property&&!property.includes('.'))C[property+'Property']=new AvaloniaProperty(C,property,defaults[property]??null);controls[name]=C;}
