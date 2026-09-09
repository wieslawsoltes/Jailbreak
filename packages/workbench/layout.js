const defaults={explorer:230,inspector:330,bottom:160,split:50};
export function layoutValues(value={}){
  const clamp=(key,min,max)=>Number.isFinite(value[key])?Math.min(max,Math.max(min,value[key])):defaults[key];
  return {explorer:clamp('explorer',150,450),inspector:clamp('inspector',280,500),bottom:clamp('bottom',90,450),split:clamp('split',25,75)};
}
export function installSplitters(doc,{read=()=>({}),write=()=>{}}={}){
  let values=layoutValues(read());const handles=[];
  function apply(){for(const [name,value]of Object.entries(values))doc.body.style.setProperty('--wb-'+name,value+(name==='split'?'%':'px'));for(const h of handles)h.el.setAttribute('aria-valuenow',String(Math.round(values[h.key])));}
  function splitter(parent,before,key,{vertical=true,invert=false,min,max,percent=false}){
    const el=doc.createElement('div');el.className='wb-splitter '+(vertical?'vertical':'horizontal');el.dataset.splitter=key;el.tabIndex=0;
    el.setAttribute('role','separator');el.setAttribute('aria-label','Resize '+key);el.setAttribute('aria-orientation',vertical?'vertical':'horizontal');el.setAttribute('aria-valuemin',String(min));el.setAttribute('aria-valuemax',String(max));
    parent.insertBefore(el,before);handles.push({el,key});let drag=null;
    const update=n=>{values[key]=Math.min(max,Math.max(min,n));apply();};
    el.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();drag={id:event.pointerId,start:vertical?event.clientX:event.clientY,value:values[key],size:parent.getBoundingClientRect().width};el.setPointerCapture(event.pointerId);doc.body.classList.add('wb-resizing');});
    el.addEventListener('pointermove',event=>{if(!drag)return;const delta=((vertical?event.clientX:event.clientY)-drag.start)*(invert?-1:1);update(drag.value+(percent?100*delta/Math.max(1,drag.size):delta));});
    const finish=event=>{if(!drag)return;drag=null;doc.body.classList.remove('wb-resizing');if(el.hasPointerCapture(event.pointerId))el.releasePointerCapture(event.pointerId);write({...values});};
    el.addEventListener('pointerup',finish);el.addEventListener('pointercancel',finish);el.addEventListener('lostpointercapture',()=>{drag=null;doc.body.classList.remove('wb-resizing');});
    el.addEventListener('keydown',event=>{const delta=(vertical?{ArrowLeft:-1,ArrowRight:1}:{ArrowUp:-1,ArrowDown:1})[event.key];if(delta||event.key==='Home'||event.key==='End'){event.preventDefault();update(event.key==='Home'?min:event.key==='End'?max:values[key]+delta*(event.shiftKey?10:1)*(invert?-1:1));write({...values});}});
    el.addEventListener('dblclick',()=>{update(defaults[key]);write({...values});});return el;
  }
  const workspace=doc.querySelector('.workspace'),main=doc.querySelector('.main-area'),work=doc.querySelector('.work-area');
  splitter(workspace,main,'explorer',{min:150,max:450});
  splitter(work,doc.querySelector('.preview-pane'),'split',{min:25,max:75,percent:true});
  splitter(main,doc.querySelector('.bottom-panel'),'bottom',{min:90,max:450,vertical:false,invert:true});
  const dock=doc.createElement('aside');dock.className='wb-tools-dock';dock.setAttribute('aria-label','Developer tool window');workspace.append(dock);
  const inspector=splitter(workspace,dock,'inspector',{min:280,max:500,invert:true});
  const development=doc.getElementById('development-panel');dock.append(development);
  function syncDock(){dock.hidden=development.hidden;inspector.hidden=development.hidden;doc.body.classList.toggle('wb-docked',!development.hidden);}
  const observer=new MutationObserver(syncDock);observer.observe(development,{attributes:true,attributeFilter:['hidden']});syncDock();apply();
  return {reset(){values=layoutValues();apply();write({...values});},values:()=>({...values}),dispose(){observer.disconnect();for(const {el}of handles)el.remove();}};
}
