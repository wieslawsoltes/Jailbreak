import {DockLayout,DOCK_ZONES,floatRect} from './dock-model.js';
import {element,action,icon} from './studio-ui.js';
/** Real docking for existing tool views. Moving a view never clones it or its controllers. */
export function createDockWorkspace({document: doc = globalThis.document, definitions, read = () => ({}), write = () => {}, notify = () => {}}) {
  const el = (tag, text, attrs) => element(doc, tag, text, attrs), win = doc.defaultView;
  const viewport = () => ({width: win.innerWidth, height: win.innerHeight - 30});
  const model = new DockLayout(definitions, read(), viewport()), registry = new Map(definitions.map(d => [d.id, d]));
  const root = doc.querySelector('.workspace'), main = doc.querySelector('.main-area');
  const work = doc.querySelector('.work-area'), bottom = doc.querySelector('.bottom-panel');
  const oldSidebar = doc.querySelector('.sidebar'), oldDock = doc.querySelector('.wb-tools-dock');
  const fragments = new Map(definitions.map(d => [d.id, d.node]));
  const storage = el('div', undefined, {hidden: '', id: 'dock-hidden-views'});doc.body.append(storage);
  for (const node of fragments.values()) {node.hidden = false;storage.append(node);}
  // All source/preview iframes stay in the same document group after startup.
  const documents = el('div', undefined, {class: 'desktop-documents', id: 'desktop-documents'});
  const tabs = doc.getElementById('tabs');documents.append(tabs, work);
  const binary = doc.getElementById('studio-binary-host');if (binary) documents.append(binary);
  main.replaceChildren(documents);bottom?.remove();oldSidebar?.remove();oldDock?.remove();
  doc.querySelector('.activity')?.remove();
  for (const handle of [...root.querySelectorAll('.wb-splitter')]) handle.remove();
  root.className = 'workspace desktop-workspace';main.className = 'main-area desktop-main';
  doc.body.classList.remove('wb-docked');doc.body.classList.add('desktop-ide');
  const leftRail = el('nav', undefined, {class:'dock-auto-rail left', 'aria-label':'Left auto-hidden windows'});
  const rightRail = el('nav', undefined, {class:'dock-auto-rail right', 'aria-label':'Right auto-hidden windows'});
  const rightStack = el('aside', undefined, {class:'dock-right-stack'}), bottomStack = el('div', undefined, {class:'dock-bottom-stack'});
  const zones = new Map(), handles = [], off = [], floaters = new Map();let disposed = false, flyout = null, dragging = null, draggingId = null, zIndex = 45;
  const persist = () => {try {write(model.snapshot());} catch {notify('The layout could not be saved in this browser.');}};
  function button(label, glyph, fn) {const b = action(doc, '', label, glyph, fn);b.type = 'button';return b;}
  function makeZone(name) {
    const host = el('section', undefined, {class:'dock-zone', id:'dock-zone-'+name, 'data-dock-zone':name, 'aria-label':name+' tool windows'});
    const header = el('header', undefined, {class:'dock-titlebar'}), title = el('strong'), commands = el('div', undefined, {class:'dock-title-actions'});
    const body = el('div', undefined, {class:'dock-content'}), tabs = el('div', undefined, {class:'dock-tabs', role:'tablist', 'aria-label':name+' tool-window tabs'});
    const menu = button('Tool window options','chevron',e => showWindowMenu(model.state.active[name], menu));
    const pin = button('Auto hide tool window',null,() => setMode(model.state.active[name], 'auto-hide'));pin.textContent='⌖';pin.classList.add('dock-pin');
    const close = button('Close tool window','close',() => setMode(model.state.active[name], 'hidden'));
    commands.append(menu,pin,close);header.append(title, commands);host.append(header, body, tabs);zones.set(name, {host,header,title,body,tabs,menu,pin,close});
    header.addEventListener('pointerdown', e => {if (e.target.closest('button')) return;startDrag(e, model.state.active[name]);});
    header.addEventListener('dblclick', e => {if (!e.target.closest('button')) setMode(model.state.active[name], 'floating');});
    host.addEventListener('dragover', e => {if (draggingId) {e.preventDefault();host.classList.add('dock-drop-hover');}});
    host.addEventListener('dragleave', e => {if (!host.contains(e.relatedTarget)) host.classList.remove('dock-drop-hover');});
    host.addEventListener('drop', e => {if (!draggingId) return;e.preventDefault();host.classList.remove('dock-drop-hover');move(draggingId,name,e.target.closest('[data-window]')?.dataset.window);finishDrag();});
    tabs.addEventListener('keydown', e => {const current=e.target.closest('[role=tab]');if(!current)return;const all=[...tabs.querySelectorAll('[role=tab]')];let at=all.indexOf(current);if(e.key==='ArrowLeft')at--;else if(e.key==='ArrowRight')at++;else if(e.key==='Home')at=0;else if(e.key==='End')at=all.length-1;else return;e.preventDefault();const next=all[(at+all.length)%all.length];const id=next.dataset.window;activate(id);doc.getElementById('dock-tab-'+id)?.focus();});
    return host;
  }
  function separator(key, label, vertical, parent, before, direction=1, percent=false) {
    const h=el('div',undefined,{class:'desktop-splitter '+(vertical?'vertical':'horizontal'),role:'separator',tabindex:'0','aria-label':label,'aria-orientation':vertical?'vertical':'horizontal','data-resize':key});
    h.setAttribute('aria-valuemin',String(percent?20:100));h.setAttribute('aria-valuemax',String(percent?80:650));parent.insertBefore(h,before);handles.push({el:h,key});
    let start=null;
    h.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();start={id:e.pointerId,at:vertical?e.clientX:e.clientY,value:model.state.sizes[key],extent:vertical?parent.clientWidth:parent.clientHeight};h.setPointerCapture(e.pointerId);doc.body.classList.add('wb-resizing');});
    h.addEventListener('pointermove',e=>{if(!start||e.pointerId!==start.id)return;const delta=((vertical?e.clientX:e.clientY)-start.at)*direction;model.resize(key,start.value+(percent?100*delta/Math.max(1,start.extent):delta));sizes();});
    const done=e=>{if(!start)return;start=null;doc.body.classList.remove('wb-resizing');if(h.hasPointerCapture(e.pointerId))h.releasePointerCapture(e.pointerId);persist();};h.addEventListener('pointerup',done);h.addEventListener('pointercancel',done);
    h.addEventListener('keydown',e=>{const n=(vertical?{ArrowLeft:-1,ArrowRight:1}:{ArrowUp:-1,ArrowDown:1})[e.key];if(n){e.preventDefault();model.resize(key,model.state.sizes[key]+n*direction*(e.shiftKey?10:1));sizes();persist();}});
    h.addEventListener('dblclick',()=>{const defaults=new DockLayout(definitions).state.sizes;model.resize(key,defaults[key]);sizes();persist();});return h;
  }
  const left=makeZone('left'),right=makeZone('right'),lower=makeZone('right-lower'),bottomLeft=makeZone('bottom'),bottomRight=makeZone('bottom-right');
  rightStack.append(right,lower);bottomStack.append(bottomLeft,bottomRight);
  root.replaceChildren(leftRail,left,main,rightStack,rightRail);main.append(bottomStack);
  const leftResize=separator('left','Resize left tool windows',true,root,main);
  const rightResize=separator('right','Resize right tool windows',true,root,rightStack,-1);
  const bottomResize=separator('bottom','Resize bottom tool windows',false,main,bottomStack,-1);
  const rightInner=separator('rightRatio','Resize right tool groups',false,rightStack,lower,1,true);
  const bottomInner=separator('bottomRatio','Resize bottom tool groups',true,bottomStack,bottomRight,1,true);
  const editorResize=separator('split','Resize source and designer',true,work,doc.querySelector('.preview-pane'),1,true);editorResize.dataset.splitter='split';
  const overlay=el('div',undefined,{id:'dock-drop-overlay',hidden:''});
  for(const [zone,label] of [['left','Dock left'],['right','Dock right'],['right-lower','Dock lower right'],['bottom','Dock bottom'],['bottom-right','Split bottom']]) {
    const target=el('button',label,{'data-target':zone,class:'dock-drop-target '+zone});target.type='button';target.addEventListener('dragover',e=>e.preventDefault());target.addEventListener('drop',e=>{if(draggingId){e.preventDefault();move(draggingId,zone);finishDrag();}});overlay.append(target);
  }root.append(overlay);
  function sizes() {
    for(const [key,value] of Object.entries(model.state.sizes))root.style.setProperty('--dock-'+key,value+(key.includes('Ratio')||key==='split'?'%':'px'));
    doc.body.style.setProperty('--wb-split',model.state.sizes.split+'%');
    for(const {el,key}of handles)el.setAttribute('aria-valuenow',String(Math.round(model.state.sizes[key])));
  }
  function tabsFor(zone) {
    const z=zones.get(zone),ids=model.inZone(zone),active=model.state.active[zone];z.host.hidden=!ids.length;z.tabs.replaceChildren();
    for(const id of ids){const def=registry.get(id),b=button(def.title,def.icon,()=>activate(id));b.dataset.window=id;b.id='dock-tab-'+id;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(id===active));b.setAttribute('aria-controls',def.node.id||'dock-view-'+id);b.tabIndex=id===active?0:-1;b.draggable=true;
      b.addEventListener('dragstart',e=>{draggingId=id;e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';overlay.hidden=false;doc.body.classList.add('dock-dragging');});b.addEventListener('dragend',finishDrag);b.addEventListener('contextmenu',e=>{e.preventDefault();showWindowMenu(id,b);});z.tabs.append(b);
    }
    const def=registry.get(active);z.title.textContent=def?.title??'';z.title.title='Drag to dock · Double-click to float';z.header.dataset.window=active??'';
    z.close.setAttribute('aria-label','Close '+(def?.title??'tool window'));z.pin.setAttribute('aria-label','Auto hide '+(def?.title??'tool window'));z.menu.setAttribute('aria-label',(def?.title??'Tool window')+' window options');
  }
  function render() {
    if(disposed)return;closeFlyout();
    for(const zone of DOCK_ZONES)tabsFor(zone);
    for(const [id,def]of registry){const state=model.window(id),node=def.node;node.id=node.id||'dock-view-'+id;node.dataset.toolWindow=id;node.classList.add('desktop-tool-view');node.setAttribute('aria-label',def.title);
      const zone=zones.get(state.zone);
      if(state.mode==='docked') {if(node.parentElement!==zone.body)zone.body.append(node);node.hidden=model.state.active[state.zone]!==id;node.setAttribute('role','tabpanel');node.setAttribute('aria-labelledby','dock-tab-'+id);}
      else if(state.mode==='floating') {const f=floatingHost(id);if(node.parentElement!==f.body)f.body.append(node);node.hidden=false;node.removeAttribute('aria-labelledby');node.setAttribute('role','region');placeFloater(id);}
      else {if(node.parentElement!==storage)storage.append(node);node.hidden=false;}
      if(state.mode!=='floating'&&floaters.has(id)){floaters.get(id).host.remove();floaters.delete(id);}
    }
    for(const rail of [leftRail,rightRail])rail.replaceChildren();
    for(const [id,def]of registry)if(model.window(id).mode==='auto-hide'){const b=button(def.title,def.icon,()=>openFlyout(id));b.className='dock-auto-tab';b.dataset.window=id;b.setAttribute('aria-expanded','false');(model.window(id).zone==='left'?leftRail:rightRail).append(b);}
    leftRail.hidden=!leftRail.children.length;rightRail.hidden=!rightRail.children.length;
    const hasLeft=model.inZone('left').length>0,hasRight=model.inZone('right').length+model.inZone('right-lower').length>0,hasBottom=model.inZone('bottom').length+model.inZone('bottom-right').length>0;
    leftResize.hidden=!hasLeft;rightResize.hidden=rightStack.hidden=!hasRight;bottomResize.hidden=bottomStack.hidden=!hasBottom;
    rightInner.hidden=!model.inZone('right').length||!model.inZone('right-lower').length;bottomInner.hidden=!model.inZone('bottom').length||!model.inZone('bottom-right').length;
    rightStack.dataset.split=String(!rightInner.hidden);bottomStack.dataset.split=String(!bottomInner.hidden);
    root.dataset.left=String(hasLeft);root.dataset.right=String(hasRight);root.dataset.leftRail=String(!leftRail.hidden);root.dataset.rightRail=String(!rightRail.hidden);main.dataset.bottom=String(hasBottom);
    sizes();doc.dispatchEvent(new CustomEvent('dock-layout-changed',{detail:model.snapshot()}));
  }
  function activate(id,{focus=false}={}) {const state=model.window(id);if(state.mode==='auto-hide'){openFlyout(id);return;}model.activate(id);render();persist();if(focus)registry.get(id).node.querySelector('input,button,select,[tabindex]')?.focus();}
  function move(id,zone,before=null){if(!id)return;model.move(id,zone,before);render();persist();}
  function setMode(id,mode){if(!id)return;model.setMode(id,mode,viewport());render();persist();}
  function floatingHost(id) {
    if(floaters.has(id))return floaters.get(id);
    const host=el('section',undefined,{class:'dock-floating',role:'region','aria-label':registry.get(id).title+' floating window'}),header=el('header',undefined,{class:'dock-titlebar'}),title=el('strong',registry.get(id).title),body=el('div',undefined,{class:'dock-content'});
    const menu=button('Dock '+registry.get(id).title,null,()=>setMode(id,'docked'));menu.textContent='▣';header.append(title,menu,button('Close '+registry.get(id).title,'close',()=>setMode(id,'hidden')));host.append(header,body);doc.body.append(host);header.addEventListener('pointerdown',e=>{if(!e.target.closest('button'))startDrag(e,id);});header.addEventListener('dblclick',e=>{if(!e.target.closest('button'))setMode(id,'docked');});host.addEventListener('pointerdown',()=>host.style.zIndex=String(++zIndex));
    const resize=el('div',undefined,{class:'dock-float-resize',role:'separator',tabindex:'0','aria-label':'Resize floating '+registry.get(id).title});host.append(resize);let begin=null;
    resize.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();begin={...model.window(id).rect,pointerX:e.clientX,pointerY:e.clientY};resize.setPointerCapture(e.pointerId);doc.body.classList.add('wb-resizing');});
    resize.addEventListener('pointermove',e=>{if(!begin)return;model.floating(id,{...begin,width:begin.width+e.clientX-begin.pointerX,height:begin.height+e.clientY-begin.pointerY,x:model.window(id).rect.x,y:model.window(id).rect.y},viewport());placeFloater(id);});
    const end=()=>{begin=null;doc.body.classList.remove('wb-resizing');persist();};resize.addEventListener('pointerup',end);resize.addEventListener('pointercancel',end);
    resize.addEventListener('keydown',e=>{const d={ArrowRight:[10,0],ArrowLeft:[-10,0],ArrowDown:[0,10],ArrowUp:[0,-10]}[e.key];if(!d)return;e.preventDefault();const r=model.window(id).rect;model.floating(id,{...r,width:r.width+d[0],height:r.height+d[1]},viewport());placeFloater(id);persist();});
    const f={host,header,body};floaters.set(id,f);return f;
  }
  function placeFloater(id){const r=floatRect(model.window(id).rect,viewport()),f=floaters.get(id);model.window(id).rect=r;Object.assign(f.host.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});}
  function openFlyout(id) {
    closeFlyout();const def=registry.get(id),state=model.window(id);if(state.mode!=='auto-hide')return activate(id);
    const host=el('section',undefined,{class:'dock-flyout '+(state.zone==='left'?'left':'right'),'aria-label':def.title+' auto-hidden window'}),header=el('header',undefined,{class:'dock-titlebar'});
    header.append(el('strong',def.title),button('Pin '+def.title,'pin',()=>setMode(id,'docked')),button('Dismiss '+def.title,'close',closeFlyout));host.append(header,def.node);root.append(host);def.node.hidden=false;flyout={id,host};
    for(const b of root.querySelectorAll('.dock-auto-tab'))b.setAttribute('aria-expanded',String(b.dataset.window===id));def.node.querySelector('input,button,select')?.focus({preventScroll:true});
  }
  function closeFlyout(){if(!flyout)return;const {id,host}=flyout;flyout=null;storage.append(registry.get(id).node);host.remove();for(const b of root.querySelectorAll('.dock-auto-tab'))b.setAttribute('aria-expanded','false');}
  let popup=null;
  function closeMenu(){popup?.remove();popup=null;}
  function showWindowMenu(id,anchor){if(!id)return;closeMenu();popup=el('div',undefined,{class:'desktop-popup dock-menu',role:'menu','aria-label':registry.get(id).title+' docking options'});
    for(const [label,fn]of [['Float',()=>setMode(id,'floating')],['Dock',()=>setMode(id,'docked')],['Auto Hide',()=>setMode(id,'auto-hide')],...DOCK_ZONES.map(zone=>['Move to '+zone.replaceAll('-',' '),()=>move(id,zone)]),['Close',()=>setMode(id,'hidden')]]){const b=button(label,null,()=>{closeMenu();fn();});b.setAttribute('role','menuitem');popup.append(b);}
    doc.body.append(popup);const r=anchor.getBoundingClientRect();popup.style.left=Math.max(0,Math.min(r.left,win.innerWidth-popup.offsetWidth-8))+'px';popup.style.top=Math.min(r.bottom,win.innerHeight-popup.offsetHeight-8)+'px';popup.firstElementChild.focus();
    popup.addEventListener('keydown',e=>{const items=[...popup.children],i=items.indexOf(doc.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}if(e.key==='Escape'){e.preventDefault();closeMenu();anchor.focus();}});
  }
  function startDrag(e,id){if(!id||e.button!==0)return;e.preventDefault();const rect=model.window(id).rect;dragging={id,pointer:e.pointerId,x:e.clientX,y:e.clientY,rect:{...rect},started:false};doc.addEventListener('pointermove',dragMove,true);doc.addEventListener('pointerup',dragEnd,true);doc.addEventListener('pointercancel',cancelDrag,true);}
  function dragMove(e){if(!dragging||e.pointerId!==dragging.pointer)return;const d=dragging;if(!d.started&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<5)return;if(!d.started){d.started=true;draggingId=d.id;overlay.hidden=false;doc.body.classList.add('dock-dragging');}e.preventDefault();const target=doc.elementFromPoint(e.clientX,e.clientY)?.closest('[data-target]');for(const t of overlay.children)t.classList.toggle('active',t===target);if(model.window(d.id).mode==='floating'){model.floating(d.id,{...d.rect,x:d.rect.x+e.clientX-d.x,y:d.rect.y+e.clientY-d.y},viewport());placeFloater(d.id);}}
  function dragEnd(e){if(!dragging||e.pointerId!==dragging.pointer)return;const d=dragging;if(d.started){const target=doc.elementFromPoint(e.clientX,e.clientY)?.closest('[data-target]');if(target)move(d.id,target.dataset.target);else{model.floating(d.id,{...d.rect,x:e.clientX-100,y:e.clientY-14},viewport());setMode(d.id,'floating');}}finishDrag();}
  function cancelDrag(){if(dragging)model.floating(dragging.id,dragging.rect,viewport());finishDrag();render();}
  function finishDrag(){dragging=null;draggingId=null;overlay.hidden=true;doc.body.classList.remove('dock-dragging');for(const z of zones.values())z.host.classList.remove('dock-drop-hover');doc.removeEventListener('pointermove',dragMove,true);doc.removeEventListener('pointerup',dragEnd,true);doc.removeEventListener('pointercancel',cancelDrag,true);}
  const outside=e=>{if(popup&&!popup.contains(e.target))closeMenu();if(flyout&&!flyout.host.contains(e.target)&&!e.target.closest('.dock-auto-tab'))closeFlyout();};doc.addEventListener('pointerdown',outside);off.push(()=>doc.removeEventListener('pointerdown',outside));
  const escape=e=>{if(e.key==='Escape'){if(dragging){e.preventDefault();cancelDrag();}else if(flyout){e.preventDefault();closeFlyout();}else closeMenu();}};doc.addEventListener('keydown',escape);off.push(()=>doc.removeEventListener('keydown',escape));
  const onResize=()=>{for(const id of floaters.keys())placeFloater(id);};win.addEventListener('resize',onResize);off.push(()=>win.removeEventListener('resize',onResize));
  render();
  return {activate,move,setMode,model,views:registry,render,snapshot:()=>model.snapshot(),
    preset(name){model.preset(name);render();persist();},reset(){model.restore({});render();persist();},
    restore(value){model.restore(value,viewport());render();persist();},
    dispose(){disposed=true;finishDrag();closeFlyout();closeMenu();off.forEach(fn=>fn());for(const f of floaters.values())f.host.remove();overlay.remove();storage.remove();}
  };
}
