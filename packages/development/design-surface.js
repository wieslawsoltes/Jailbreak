import {arrangeSelection,moveSelection,snapGuides} from './design-geometry.js';

/** Preview-owned selection and gesture overlays. Only source-edit intents cross the sandbox.
 * Runtime controls/properties are not changed during drag; cancellation drops the intent.
 */
export function createDesignSurface({document:doc,resolve,entries,inspect,onSelect,report,revision,busy=()=>false}) {
  const selected=new Set(),boxes=new Map(),guideLines=[];let primary=null,visible=false,picking=false,drag=null,snap=0,guides=true,observer=null,disposed=false;
  const win=doc?.defaultView;
  const fail=error=>report('tool-error',{message:error.message});
  const guard=fn=>{try{return fn();}catch(error){cancel();fail(error);}};
  const records=()=>[...selected].map(id=>resolve(id)).filter(Boolean).map(c=>inspect(c.uid));
  const announce=()=>report('selection-changed',{items:records(),primary,revision:revision()});
  function clearGuides(){for(const line of guideLines)line.remove();guideLines.length=0;}
  function cancel(){drag=null;clearGuides();refresh(false);}
  function place(box,rect){Object.assign(box.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});}
  function commit(edits){if(busy())throw new Error('Finish or cancel debugger tasks before design edits');report('design-edit',{revision:revision(),edits});}
  function select(id,{additive=false}={}){
    if(!resolve(id))throw new Error('Visual selection is no longer available');
    cancel();if(!additive)selected.clear();
    if(additive&&selected.has(id))selected.delete(id);else{if(selected.size>=128)throw new Error('Selection limit reached');selected.add(id);}
    primary=selected.has(id)?id:[...selected].at(-1)??null;visible=true;onSelect(primary?resolve(primary):null);
    if(primary)report('selected',inspect(primary));refresh(false);announce();return primary?inspect(primary):null;
  }
  function begin(event,kind,anchor='se'){
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();event.currentTarget.focus({preventScroll:true});
    if(busy())throw new Error('Finish or cancel debugger tasks before design edits');
    const items=records(),item=items.find(i=>i.id===primary);
    if(kind==='move')moveSelection(items,0,0);
    if(!item?.rect||!item.source||item.template)throw new Error('Visual is not editable');
    const others=kind==='move'?entries().filter(({c})=>c.parent?.uid===item.parent?.id&&!selected.has(c.uid)).slice(0,500).map(({c})=>inspect(c.uid)):[];
    drag={kind,anchor,items,item,others,x:event.clientX,y:event.clientY,revision:revision(),edits:null};event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event){if(!drag)return;event.preventDefault();
    if(drag.revision!==revision()||busy()){cancel();return;}
    clearGuides();let dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(drag.kind==='move'){
      if(event.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}
      let edits=moveSelection(drag.items,dx,dy,{snap:event.altKey?0:snap});
      if(guides&&!event.altKey&&!event.shiftKey){
        const first=drag.items[0];const delta=snapGuides(drag.items,drag.others,edits[0].values['Canvas.Left']-first.layout.x,edits[0].values['Canvas.Top']-first.layout.y);
        edits=moveSelection(drag.items,delta.dx,delta.dy);
        const parent=resolve(first.parent.id)?.element,rect=parent?.getBoundingClientRect();
        if(rect)for(const guide of delta.guides){const line=doc.createElement('div');line.className='jb-designer-guide';line.setAttribute('aria-hidden','true');line.style.cssText='position:fixed;pointer-events:none;z-index:2147483644;border-color:#dd69bf;border-style:dashed;border-width:0;';
          Object.assign(line.style,guide.axis==='x'?{left:(rect.x+parent.clientLeft-parent.scrollLeft+guide.position)+'px',top:rect.y+'px',height:rect.height+'px',borderLeftWidth:'1px'}:{left:rect.x+'px',top:(rect.y+parent.clientTop-parent.scrollTop+guide.position)+'px',width:rect.width+'px',borderTopWidth:'1px'});doc.body.append(line);guideLines.push(line);}

      }
      drag.edits=edits;
      for(const edit of edits){const item=drag.items.find(i=>i.id===edit.id),box=boxes.get(edit.id);if(box)place(box,{...item.rect,x:item.rect.x+edit.values['Canvas.Left']-item.layout.x,y:item.rect.y+edit.values['Canvas.Top']-item.layout.y});}
    }else{
      let width=Math.max(1,Math.round(drag.item.rect.width+dx)),height=Math.max(1,Math.round(event.shiftKey?width*drag.item.rect.height/drag.item.rect.width:drag.item.rect.height+dy));
      if(snap&&!event.altKey){width=Math.max(1,Math.round(width/snap)*snap);height=Math.max(1,Math.round(height/snap)*snap);}
      drag.edits=[{id:drag.item.id,values:{Width:width,Height:height}}];place(boxes.get(primary),{...drag.item.rect,width,height});
    }
  }
  function end(event){if(!drag)return;event.preventDefault();const state=drag;drag=null;clearGuides();
    if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    refresh(false);if(state.edits&&state.revision===revision()){
      // Preserve the original single-control C# initializer resize ABI.
      if(state.kind==='resize'&&state.item.source.language==='csharp')report('resize',{id:state.item.id,width:state.edits[0].values.Width,height:state.edits[0].values.Height});
      else commit(state.edits);
    }
  }
  function makeBox(id){const c=resolve(id),item=inspect(id),box=doc.createElement('div');box.className='jb-designer-outline';box.dataset.designId=id;box.setAttribute('role','group');box.setAttribute('aria-label',id===primary?'Design selection':'Selected visual');
    box.style.cssText='position:fixed;pointer-events:none;z-index:2147483645;border:1.5px solid #7666eb;box-sizing:border-box;background:#7666eb08;';
    const label=doc.createElement('button');label.type='button';label.textContent=(c.Name||c.type)+(selected.size>1?' · '+selected.size+' selected':'');label.setAttribute('aria-label','Move selected visuals');label.disabled=!item.movable;label.style.cssText='position:absolute;left:-1px;bottom:100%;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:10px/18px system-ui;background:#6252c9;color:white;padding:0 7px;border:0;border-radius:3px 3px 0 0;pointer-events:auto;cursor:move;touch-action:none';
    if(id===primary){box.append(label);label.addEventListener('pointerdown',e=>guard(()=>begin(e,'move')));label.addEventListener('pointermove',e=>guard(()=>move(e)));label.addEventListener('pointerup',e=>guard(()=>end(e)));label.addEventListener('pointercancel',cancel);
      label.addEventListener('keydown',e=>guard(()=>{const d=e.shiftKey?10:1,delta={ArrowLeft:[-d,0],ArrowRight:[d,0],ArrowUp:[0,-d],ArrowDown:[0,d]}[e.key];if(delta){e.preventDefault();commit(moveSelection(records(),...delta));}else if(e.key==='Escape')cancel();}));
      const handle=doc.createElement('button');handle.type='button';handle.setAttribute('aria-label','Resize selected visual');handle.title='Resize · Shift preserves aspect · Alt bypasses snapping';handle.disabled=!!item.template||!item.source;
      handle.style.cssText='position:absolute;right:-5px;bottom:-5px;width:10px;height:10px;padding:0;border:1.5px solid #6252c9;background:white;pointer-events:auto;cursor:nwse-resize;touch-action:none';box.append(handle);
      handle.addEventListener('pointerdown',e=>guard(()=>begin(e,'resize')));handle.addEventListener('pointermove',e=>guard(()=>move(e)));handle.addEventListener('pointerup',e=>guard(()=>end(e)));handle.addEventListener('pointercancel',cancel);
      handle.addEventListener('keydown',e=>guard(()=>{const d=e.shiftKey?10:1,delta={ArrowLeft:[-d,0],ArrowRight:[d,0],ArrowUp:[0,-d],ArrowDown:[0,d]}[e.key];if(!delta)return;e.preventDefault();if(busy())throw new Error('Finish or cancel debugger tasks before design edits');const r=inspect(primary).rect;report('resize',{id:primary,width:Math.max(1,Math.round(r.width+delta[0])),height:Math.max(1,Math.round(r.height+delta[1]))});}));
    }
    doc.body.append(box);boxes.set(id,box);return box;
  }
  function refresh(publish=true){if(disposed)return;
    for(const id of selected)if(!resolve(id))selected.delete(id);
    if(!selected.has(primary)){primary=[...selected].at(-1)??null;onSelect(primary?resolve(primary):null);}
    // Keep focused resize handles through plain layout/scroll updates.
    for(const [id,box]of boxes)if(!selected.has(id)||!visible){box.remove();boxes.delete(id);}
    if(visible&&doc)for(const id of selected){const item=inspect(id);if(!item.rect)continue;const box=boxes.get(id)??makeBox(id);place(box,item.rect);}
    if(publish)announce();
  }
  function rebuild(){for(const box of boxes.values())box.remove();boxes.clear();refresh(false);}
  function pointer(event){if(!picking||busy()||event.composedPath().some(n=>n?.classList?.contains('jb-designer-outline')))return;
    const path=event.composedPath(),items=entries().filter(({c})=>path.includes(c.element)).sort((a,b)=>path.indexOf(a.c.element)-path.indexOf(b.c.element));
    if(items.length){event.preventDefault();event.stopImmediatePropagation();if(event.type==='click'){select(items[0].c.uid,{additive:event.shiftKey||event.ctrlKey||event.metaKey});rebuild();}}
  }
  const key=e=>{if(e.key==='Escape'&&drag){e.preventDefault();cancel();}};
  doc?.addEventListener('pointerdown',pointer,true);doc?.addEventListener('click',pointer,true);doc?.addEventListener('keydown',key,true);
  const onScroll=()=>refresh(false);win?.addEventListener('scroll',onScroll,true);
  const onResize=()=>refresh(false);win?.addEventListener('resize',onResize);
  if(win?.ResizeObserver){observer=new win.ResizeObserver(onResize);observer.observe(doc.documentElement);}
  return {has:id=>selected.has(id),select(id,options){const result=select(id,options);rebuild();return result;},refresh,
    configure(settings={}){if(settings.snap!==undefined){if(!Number.isFinite(settings.snap)||settings.snap<0||settings.snap>256)throw new Error('Invalid snap grid');snap=settings.snap;}if(settings.guides!==undefined)guides=!!settings.guides;},
    pick(value){picking=!!value;visible=picking;cancel();return picking;},
    arrange(command){commit(arrangeSelection(records(),command));},
    setGeometry(values){const items=records();moveSelection(items,0,0);if(items.length!==1)throw new Error('Select one visual');
      if(!values||typeof values!=='object'||Object.keys(values).length!==4||Object.entries(values).some(([k,v])=>!['Canvas.Left','Canvas.Top','Width','Height'].includes(k)||typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1000000||['Width','Height'].includes(k)&&v<=0))throw new Error('Invalid layout bounds');commit([{id:primary,values}]);},
    clear(){selected.clear();primary=null;onSelect(null);rebuild();announce();},
    dispose(){disposed=true;drag=null;clearGuides();observer?.disconnect();for(const box of boxes.values())box.remove();boxes.clear();selected.clear();doc?.removeEventListener('pointerdown',pointer,true);doc?.removeEventListener('click',pointer,true);doc?.removeEventListener('keydown',key,true);win?.removeEventListener('resize',onResize);win?.removeEventListener('scroll',onScroll,true);}
  };
}
