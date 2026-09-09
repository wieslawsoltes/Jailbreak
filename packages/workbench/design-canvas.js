import {element,action} from './studio-ui.js';
import {validateSelection} from '../development/design-geometry.js';

export function canvasPreferences(input={}) {
  const bounded=(key,def,min,max)=>Number.isFinite(input?.[key])?Math.min(max,Math.max(min,input[key])):def;
  return {width:Math.round(bounded('width',960,240,4096)),height:Math.round(bounded('height',640,160,4096)),zoom:bounded('zoom',1,.25,2),grid:input?.grid!==false,snap:input?.snap===true,guides:input?.guides!==false};
}
/** Real iframe artboard. Zoom changes presentation only; layout remains in design pixels. */
export function createDesignCanvas({document:doc=globalThis.document,development,notify,persist}) {
  const el=(tag,text,attrs)=>element(doc,tag,text,attrs),$=id=>doc.getElementById(id);
  const frame=$('preview'),stage=doc.querySelector('.preview-stage'),pane=doc.querySelector('.preview-pane');
  let prefs=canvasPreferences(),active=false,items=[],tool='select',panning=null;
  const guard=fn=>{try{return fn();}catch(error){notify(error.message);}};
  const toolbar=el('div',undefined,{id:'design-canvas-toolbar',class:'design-canvas-toolbar',role:'toolbar','aria-label':'Artboard, zoom and layout tools',hidden:''});
  pane.insertBefore(toolbar,stage);
  // Install once before initial application startup. Later perspective switches do
  // not reparent the iframe, so its execution context and hot-reload state survive.
  const board=el('div',undefined,{class:'design-artboard'}),top=el('div',undefined,{class:'design-ruler top','aria-hidden':'true'}),left=el('div',undefined,{class:'design-ruler left','aria-hidden':'true'});
  stage.insertBefore(board,frame);board.append(frame,top,left);
  const pan=el('div',undefined,{class:'design-pan-layer',hidden:'',tabindex:'0','aria-label':'Pan design workspace'});stage.append(pan);
  const make=(id,label,glyph,fn)=>action(doc,id,label,glyph,()=>guard(fn));
  const select=make('design-select','Select','design',()=>setTool('select')),hand=make('design-hand','Pan',null,()=>setTool('pan'));
  select.title='Select visuals · Shift-click adds to selection';hand.title='Pan artboard with pointer or touch';const interact=make('design-interact','Interact',null,()=>setTool('interact'));interact.title='Use the running application without leaving the artboard';toolbar.append(select,hand,interact);
  const divider=()=>el('span',undefined,{class:'design-toolbar-divider','aria-hidden':'true'});
  const preset=el('select',undefined,{id:'design-device','aria-label':'Design artboard preset'});
  for(const [v,label]of [['960x640','Desktop · 960 × 640'],['1280x800','Desktop · 1280 × 800'],['768x1024','Tablet · 768 × 1024'],['390x844','Phone · 390 × 844'],['custom','Custom artboard']])preset.append(el('option',label,{value:v}));
  preset.onchange=()=>{if(preset.value==='custom')return;const [width,height]=preset.value.split('x').map(Number);prefs={...prefs,width,height};apply();save();};
  const zoom=el('select',undefined,{id:'design-zoom','aria-label':'Design zoom'});
  for(const [v,label]of [['.25','25%'],['.5','50%'],['.75','75%'],['1','100%'],['1.25','125%'],['1.5','150%'],['2','200%'],['custom','Fit']])zoom.append(el('option',label,{value:v}));
  zoom.onchange=()=>{if(zoom.value==='custom')fit();else{prefs.zoom=Number(zoom.value);apply();save();}};
  const fitButton=make('design-fit','Fit',null,fit);
  const grid=make('design-grid','Grid',null,()=>{prefs.grid=!prefs.grid;apply();save();}),snap=make('design-snap','Snap · 8px',null,()=>{prefs.snap=!prefs.snap;apply();save();}),guides=make('design-guides','Smart guides',null,()=>{prefs.guides=!prefs.guides;apply();save();});
  toolbar.append(divider(),preset,zoom,fitButton,divider(),grid,snap,guides);
  const status=el('div',undefined,{class:'design-canvas-status',hidden:''}),selectionLabel=el('span','No selection',{id:'design-selection-label'}),dimensions=el('span','',{id:'design-artboard-size'});
  status.append(selectionLabel,el('span','Shift-click · multi-select  /  Drag label · move  /  Alt · unsnapped',{class:'design-canvas-hint'}),dimensions);stage.after(status);
  const inspector=el('section',undefined,{id:'design-layout-inspector',class:'design-layout-inspector'}),header=el('div',undefined,{class:'design-layout-heading'});
  header.append(el('strong','LAYOUT'),el('span','Source-backed edits',{class:'design-muted'}));inspector.append(header);
  const geometry=el('div',undefined,{class:'design-geometry-fields'}),fields={};
  for(const [key,label]of [['x','X'],['y','Y'],['width','W'],['height','H']]){
    const input=el('input',undefined,{type:'number',step:1,id:'design-'+key,'aria-label':'Selection '+key}),wrapper=el('label',label);wrapper.append(input);fields[key]=input;geometry.append(wrapper);
  }
  const applyGeometry=make('design-apply-geometry','Apply bounds',null,()=>{
    if(items.length!==1)throw new Error('Select one movable visual for bounds editing');
    const values=Object.fromEntries(Object.entries(fields).map(([key,input])=>[{x:'Canvas.Left',y:'Canvas.Top',width:'Width',height:'Height'}[key],input.value===''?NaN:Number(input.value)]));development.setGeometry(values);
  });inspector.append(geometry,applyGeometry);
  const alignment=el('div',undefined,{class:'design-align-actions',role:'toolbar','aria-label':'Align and distribute selection'}),actions=new Map();
  for(const [key,label,short]of [['left','Align left','⇤'],['center-x','Align horizontal centers','↔'],['right','Align right','⇥'],['top','Align top','↥'],['center-y','Align vertical centers','↕'],['bottom','Align bottom','↧'],['distribute-x','Distribute horizontally','H⋯'],['distribute-y','Distribute vertically','V⋯'],['same-width','Match first selected width','W='],['same-height','Match first selected height','H=']]){
    const button=make('design-align-'+key,label,null,()=>development.arrange(key));button.textContent=short;actions.set(key,button);alignment.append(button);
  }
  const note=el('p','Select literal XAML children in a Canvas to move, align or distribute.',{id:'design-layout-note'});
  inspector.append(alignment,note);$('dev-property-panel').querySelector('h3').after(inspector);
  function save(){persist();}
  function configure(){if(development.options().enabled)development.designConfigure({snap:prefs.snap?8:0,guides:prefs.guides});}
  function setTool(value){tool=value;pan.hidden=!active||tool!=='pan';select.setAttribute('aria-pressed',String(value==='select'));hand.setAttribute('aria-pressed',String(value==='pan'));interact.setAttribute('aria-pressed',String(value==='interact'));if(active)development.pick(value==='select');}
  function fit(){prefs.zoom=Math.min(2,Math.max(.25,Math.floor(Math.min((stage.clientWidth-70)/prefs.width,(stage.clientHeight-70)/prefs.height)*100)/100));apply();save();}
  function rulers(){
    top.replaceChildren();left.replaceChildren();const interval=prefs.zoom<.5?200:100;
    for(let n=0;n<=prefs.width;n+=interval){const label=el('span',String(n));label.style.left=n*prefs.zoom+'px';top.append(label);}
    for(let n=0;n<=prefs.height;n+=interval){const label=el('span',String(n));label.style.top=n*prefs.zoom+'px';left.append(label);}
  }
  function apply(){
    prefs=canvasPreferences(prefs);doc.body.classList.toggle('designer-artboard-active',active);toolbar.hidden=status.hidden=!active;
    for(const [key,value]of Object.entries({'--design-width':prefs.width+'px','--design-height':prefs.height+'px','--design-zoom':prefs.zoom,'--design-scaled-width':prefs.width*prefs.zoom+'px','--design-scaled-height':prefs.height*prefs.zoom+'px','--design-ruler-step':100*prefs.zoom+'px'}))stage.style.setProperty(key,value);
    stage.classList.toggle('design-grid-visible',prefs.grid);
    const key=prefs.width+'x'+prefs.height;preset.value=[...preset.options].some(o=>o.value===key)?key:'custom';
    zoom.value=[...zoom.options].some(o=>o.value!== 'custom'&&Number(o.value)===prefs.zoom)?String(prefs.zoom):'custom';
    // Decimal option spelling must be canonical when selecting values programmatically.
    const exact=[...zoom.options].find(o=>o.value!=='custom'&&Number(o.value)===prefs.zoom);if(exact)zoom.value=exact.value;
    for(const [button,value]of [[grid,prefs.grid],[snap,prefs.snap],[guides,prefs.guides]])button.setAttribute('aria-pressed',String(value));
    dimensions.textContent=prefs.width+' × '+prefs.height+' · '+Math.round(prefs.zoom*100)+'%';rulers();setTool(tool);configure();
  }
  function selection(payload){
    items=payload.items??[];selectionLabel.textContent=items.length===1?(items[0].name||items[0].type):items.length?items.length+' visuals selected':'No selection';
    let reason='';try{validateSelection(items);}catch(e){reason=e.message;}
    note.textContent=reason||'Canvas coordinates · anchor is the first selected visual. Edits preserve source and hot-reload state.';
    for(const [key,input]of Object.entries(fields)){input.value=items.length===1&&Number.isFinite(items[0].layout?.[key])?Math.round(items[0].layout[key]*1000)/1000:'';input.disabled=!!reason||items.length!==1;}
    applyGeometry.disabled=!!reason||items.length!==1;
    for(const [key,button]of actions){button.disabled=!!reason||items.length<(key.startsWith('distribute-')?3:2);}
  }
  pan.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1)return;e.preventDefault();panning={x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop};pan.setPointerCapture(e.pointerId);});
  pan.addEventListener('pointermove',e=>{if(panning){stage.scrollLeft=panning.left+panning.x-e.clientX;stage.scrollTop=panning.top+panning.y-e.clientY;}});
  const stopPan=()=>{panning=null;};pan.addEventListener('pointerup',stopPan);pan.addEventListener('pointercancel',stopPan);
  pan.addEventListener('keydown',e=>{const delta={ArrowLeft:[-40,0],ArrowRight:[40,0],ArrowUp:[0,-40],ArrowDown:[0,40]}[e.key];if(delta){e.preventDefault();stage.scrollBy(...delta);}else if(e.key==='Escape')setTool('select');});
  const off=development.subscribe(({event,payload})=>{if(event==='selection-changed')selection(payload);else if(event==='workspace-reset'||event==='session-stopped')selection({items:[]});});
  selection({items:[]});apply();
  return {options:()=>({...prefs}),restore(value){prefs=canvasPreferences(value);apply();},setActive(value){active=!!value;apply();},ready(){configure();if(active)setTool(tool);},dispose(){off();toolbar.remove();status.remove();inspector.remove();pan.remove();}};
}
