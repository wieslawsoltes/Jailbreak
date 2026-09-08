/** Native property projection. Supply host utilities, then install on Control.prototype. */
export function createPropertyApplier({doc,color,thickness,tracks,applyStyles,schedule}) {
  return function applyProperty(name,v){
      const e=this.element,s=e.style,t=this._type;
      const lengths={Width:'width',Height:'height',MinWidth:'minWidth',MinHeight:'minHeight',MaxWidth:'maxWidth',MaxHeight:'maxHeight',FontSize:'fontSize',CornerRadius:'borderRadius',Spacing:'gap',RowSpacing:'rowGap',ColumnSpacing:'columnGap'};
      if(lengths[name]){s[lengths[name]]=v==null||v==='Auto'?'':`${v}px`;if(t==='DrawingSurface')this._redraw();return;}
      const simple={FontFamily:'fontFamily',FontWeight:'fontWeight',FontStyle:'fontStyle',Opacity:'opacity',Cursor:'cursor',TextAlignment:'textAlign'};
      if(simple[name]){s[simple[name]]=v??'';return;}
      if(name==='Name'){e.dataset.name=v;if(v)e.id='jb-'+v;return;}
      if(name==='Classes'){e.className='jb-control jb-'+t.toLowerCase()+' '+(v||'');return;}
      if(name==='Background'||name==='Fill'){s.background=color(v);return;}if(name==='Foreground'){s.color=color(v);return;}
      if(name==='BorderBrush'||name==='Stroke'){s.borderColor=color(v);s.borderStyle='solid';return;}
      if(name==='BorderThickness'||name==='StrokeThickness'){s.borderWidth=thickness(v);s.borderStyle='solid';return;}
      if(name==='RadiusX'||name==='RadiusY'){s.borderRadius=`${this.RadiusX||0}px / ${this.RadiusY||0}px`;return;}
      if(name==='Margin'||name==='Padding'){s[name.toLowerCase()]=thickness(v);return;}
      if(name==='IsVisible'){s.display=v?'':'none';return;}
      if(name==='IsEnabled'){const enabled=this.IsEnabled;e.setAttribute('aria-disabled',String(!enabled));if('disabled'in e)e.disabled=!enabled;if(this.input)this.input.disabled=!enabled;for(const child of this._children)child._apply('IsEnabled',child.IsEnabled);return;}
      if(name==='ToolTip.Tip'){e.title=String(v??'');return;}
      if(name==='TabIndex'||name==='Focusable'){e.tabIndex=name==='TabIndex'?v:v?0:-1;return;}
      if(name==='ClipToBounds'){s.overflow=v?'hidden':'';return;}
      if(name==='HorizontalAlignment'){s.alignSelf=({Left:'flex-start',Right:'flex-end',Center:'center',Stretch:'stretch'})[v]||'';s.justifySelf=({Left:'start',Right:'end',Center:'center',Stretch:'stretch'})[v]||'';return;}
      if(name==='VerticalAlignment'){s.alignSelf=({Top:'flex-start',Bottom:'flex-end',Center:'center',Stretch:'stretch'})[v]||'';s.alignContent=({Top:'start',Bottom:'end',Center:'center',Stretch:'stretch'})[v]||'';return;}
      if(name==='HorizontalContentAlignment'){s.textAlign=({Left:'left',Right:'right',Center:'center'})[v]||'';return;}
      if(name==='VerticalContentAlignment'){s.alignItems=({Top:'start',Bottom:'end',Center:'center',Stretch:'stretch'})[v]||'';return;}
      if(name.startsWith('Grid.')||name.startsWith('Canvas.')||name==='DockPanel.Dock'){this._layoutAttached();return;}
      if(name==='RowDefinitions'){s.gridTemplateRows=tracks(v);return;}if(name==='ColumnDefinitions'){s.gridTemplateColumns=tracks(v);return;}
      if(name==='Orientation'){
        if(t==='Slider'){s.writingMode=v==='Vertical'?'vertical-lr':'';s.direction=this.IsDirectionReversed?'rtl':'';}else if(t==='StackPanel'||t==='WrapPanel')s.flexDirection=v==='Horizontal'?'row':'column';return;
      }
      if(name==='Text'){if(t==='TextBox'){this.input.value=v??'';}else e.textContent=v??'';return;}
      if(name==='TextWrapping'){s.whiteSpace=v==='Wrap'?'pre-wrap':'nowrap';s.overflowWrap=v==='Wrap'?'anywhere':'';return;}
      if(name==='MaxLines'){s.display='-webkit-box';s.webkitBoxOrient='vertical';s.webkitLineClamp=String(v);s.overflow='hidden';return;}
      if(name==='LineHeight'){s.lineHeight=v==null?'':`${v}px`;return;}
      if(name==='Content'||name==='Child'){this._setContent(v);return;}
      if(name==='Header'){if(this.header)this.header.textContent=String(v??'');else e.setAttribute('aria-label',String(v??''));this._parent?._refreshTabs();return;}
      if(name==='Title'){e.setAttribute('aria-label',String(v??''));return;}
      if(name==='IsChecked'){if(t==='RadioButton'&&v===true)this._reconcileRadio();if(this.input){this.input.checked=v===true;this.input.indeterminate=v===null;}e.setAttribute('aria-checked',v===null?'mixed':String(v));if(t==='ToggleButton')e.setAttribute('aria-pressed',String(!!v));if(v)this._state.add('checked');else this._state.delete('checked');applyStyles(this);return;}
      if(name==='GroupName'){if(this.input)this.input.name=`jb-${v||'default'}`;this._reconcileRadio();return;}
      if(name==='Watermark'||name==='PlaceholderText'){(this.input||e).setAttribute('placeholder',v??'');return;}
      if(name==='MaxLength'){if(this.input)this.input.maxLength=v??524288;return;}
      if(name==='IsReadOnly'){if(this.input)this.input.readOnly=!!v;return;}
      if(name==='PasswordChar'){if(this.input?.tagName==='INPUT')this.input.type=v?'password':'text';return;}
      if(name==='AcceptsReturn'&&t==='TextBox'){
        const tag=v?'TEXTAREA':'INPUT';if(e.tagName!==tag){const next=doc.createElement(tag);for(const attr of [...e.attributes])next.setAttribute(attr.name,attr.value);next.value=this.Text||'';if(v){next.removeAttribute('type');next.rows=4;}else next.type=this.PasswordChar?'password':'text';e.replaceWith(next);this.element=this.input=this._contentHost=next;this._wireNative();}return;
      }
      if(['Value','Minimum','Maximum','SmallChange','TickFrequency','IsSnapToTickEnabled','Increment','IsDirectionReversed'].includes(name)){
        if(t==='Slider'||t==='NumericUpDown'){const input=this.input;input.min=String(this.Minimum);input.max=String(this.Maximum);input.step=String(t==='NumericUpDown'?this.Increment:this.IsSnapToTickEnabled?this.TickFrequency:this.SmallChange);input.value=String(this.Value);if(t==='Slider')s.direction=this.IsDirectionReversed?'rtl':'';}
        if(t==='ProgressBar'){e.max=Math.max(0,this.Maximum-this.Minimum);e.value=this.Value-this.Minimum;}return;
      }
      if(name==='IsIndeterminate'){if(v)e.removeAttribute('value');else e.value=this.Value;return;}
      if(name==='Items'||name==='ItemsSource'){this._itemsDispose?.();this._itemsDispose=v?.subscribe?.(()=>this._refreshItems());this._refreshItems();return;}
      if(name==='SelectedIndex'||name==='SelectedItem'){
        if(name==='SelectedItem'){const index=(this._items||[]).indexOf(v);if(this.SelectedIndex!==index)this.SelectedIndex=index;}else if(['ComboBox','ListBox'].includes(t)){const item=this._items?.[v]??null;if(this.SelectedItem!==item)this.SelectedItem=item;}
        if(t==='ComboBox')e.selectedIndex=this.SelectedIndex;
        if(t==='ListBox')for(const [i,child]of [...e.children].entries())child.setAttribute('aria-selected',String(i===this.SelectedIndex));
        if(t==='TabControl')this._refreshTabs();return;
      }
      if(name==='IsExpanded'){e.open=!!v;return;}
      if(name==='SelectedDate'||name==='SelectedTime'){this.input.value=v instanceof Date?v.toISOString().slice(0,10):v??'';return;}
      if(name==='Source'){
        const source=String(v??'');if(source&&!/^(https?:|data:image\/(?:png|jpeg|webp|gif);base64,|blob:)/i.test(source))throw new Error(`Unsupported image URI ${source}; assets must be resolved by the project host`);e.src=source;return;
      }
      if(name==='Stretch'){s.objectFit=({Uniform:'contain',UniformToFill:'cover',Fill:'fill',None:'none'})[v]||'contain';return;}
      if(name==='HorizontalScrollBarVisibility'||name==='VerticalScrollBarVisibility'){s[name.startsWith('Horizontal')?'overflowX':'overflowY']=v==='Disabled'||v==='Hidden'?'hidden':v==='Visible'?'scroll':'auto';return;}
      if(name==='Theme'){if(v?.kind!=='theme')throw new Error('Only explicitly registered host themes are supported');return;}
      if(name==='Scene'||name==='ClearColor'){this._redraw();return;}
      if(name==='Command'||name==='CommandParameter'){v=this.Command;this._commandDispose?.();if(v?.CanExecuteChanged)this._commandDispose=v.CanExecuteChanged.Add(()=>{this.IsEnabled=v.CanExecute(this.CommandParameter);});if(v?.CanExecute)this.IsEnabled=v.CanExecute(this.CommandParameter);return;}
      if(name==='DataContext'){schedule();return;}
    };
}
