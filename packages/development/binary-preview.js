import {shortcutRelayScript} from '../workbench/preview-shortcuts.js';
import {escapeJs} from '../compiler-core/index.js';
/** Offline runner UI and channel bridge for the same cooperative scheduler used
 * by Studio. It displays already-serialized frames and never evaluates watches. */
export function binaryPreviewDebugger(debug,settings={}){
  return `(function(){
const settings=${escapeJs(settings)}, sources=${escapeJs(debug.sources??{})};
${shortcutRelayScript("command=>send('ide-shortcut',command)","settings.hosted===true")}
const root=document.createElement('details');root.id='binary-debugger';root.open=true;root.hidden=settings.hosted===true;
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
root.append(node('summary','MSIL debugger · compiled continuations'));
const state=node('div','Ready'),frames=node('select'),values=node('pre'),source=node('select'),listing=node('textarea'),line=node('input'),entry=node('input');
state.id='binary-debug-state';state.setAttribute('role','status');frames.id='binary-debug-frames';frames.setAttribute('aria-label','Binary call stack');values.id='binary-debug-values';
source.id='binary-debug-source';source.setAttribute('aria-label','Binary source document');listing.id='binary-debug-listing';listing.readOnly=true;listing.setAttribute('aria-label','Read-only binary source or disassembly');listing.rows=7;
line.id='binary-debug-line';line.type='number';line.min='1';line.value='1';line.setAttribute('aria-label','Binary breakpoint line');entry.type='checkbox';entry.id='binary-debug-entry';entry.checked=settings.breakOnEntry===true;
const entryLabel=node('label','Break on entry');entryLabel.prepend(entry);
for(const file of Object.keys(sources)){const option=node('option',file);option.value=file;source.append(option);}
source.onchange=()=>listing.value=sources[source.value]??'';source.onchange();
let taskId=null,paused=null;const actions=[];
function button(label,id,fn){const b=node('button',label);b.id=id;b.type='button';b.onclick=()=>{try{fn();}catch(e){state.textContent=e.message;}};return b;}
function showFrame(){const frame=paused?.frames.find(f=>String(f.id)===frames.value);values.textContent=JSON.stringify(frame??{},null,2);return frame;}
frames.onchange=showFrame;
function report(event,payload){
  send(event,payload);
  if(event==='debug-started'){taskId=payload.taskId;state.textContent='Running';}
  if(event==='debug-paused'){
    taskId=payload.taskId;paused=payload;state.textContent='Paused';frames.replaceChildren();
    for(const f of payload.frames){const option=node('option',f.method+' · '+(f.point?.file??'')+':'+(f.point?.line??''));option.value=String(f.id);frames.append(option);}showFrame();
    if(Object.hasOwn(sources,payload.point.file)){source.value=payload.point.file;source.onchange();const p=payload.point;listing.setSelectionRange(p.offset,p.offset);listing.scrollTop=Math.max(0,(p.line-3)*18);}
  }
  if(event==='debug-resumed'){paused=null;state.textContent='Running';}
  if(event==='debug-completed'){taskId=null;paused=null;state.textContent=payload.status;frames.replaceChildren();values.textContent='';}
  for(const b of actions)b.disabled=b.dataset.action==='cancel'?!co.busy:!paused;
  document.getElementById('run').disabled=co.busy;
}
const co=MS.createDebugger({breakpoint:point=>(settings.breakpoints??[]).some(b=>b.enabled!==false&&b.file===point.file&&Number(b.line)===point.line),report});
root.append(state,entryLabel,source,listing,line,button('Set breakpoint','binary-debug-breakpoint',()=>{
 const value=Number(line.value);if(!Number.isSafeInteger(value)||value<1||!${escapeJs(debug.sites??[])}.some(p=>p.file===source.value&&p.line===value))throw new Error('Unbound breakpoint: no emitted location');
 settings.breakpoints=[{file:source.value,line:value}];state.textContent='Breakpoint set';
}),button('Clear breakpoints','binary-debug-clear',()=>{settings.breakpoints=[];state.textContent='Breakpoints cleared';}));
const commands=node('div');commands.className='binary-debug-actions';
for(const [action,label]of [['continue','Continue'],['into','Step into'],['over','Step over'],['out','Step out'],['cancel','Cancel']]){
 const b=button(label,'binary-debug-'+action,()=>co.command(taskId,action));b.dataset.action=action;b.disabled=true;actions.push(b);commands.append(b);
}
root.append(commands,frames,values);
const name=node('input'),value=node('input');name.id='binary-debug-local';name.placeholder='Local name';name.setAttribute('aria-label','Binary local name');value.id='binary-debug-value';value.placeholder='JSON scalar value';value.setAttribute('aria-label','Binary local value');
root.append(name,value,button('Set local','binary-debug-set-local',()=>{const f=showFrame();if(!f)throw new Error('Pause a frame first');co.setLocal(taskId,f.id,name.value,JSON.parse(value.value));}));
document.getElementById('run').after(root);
addEventListener('pagehide',()=>co.dispose());
addEventListener('message',event=>{const m=event.data;if(event.source!==parent||m?.channel!==channel)return;try{
 if(m.kind==='debug-command')co.command(m.taskId,m.action);
 else if(m.kind==='debug-frame')send('debug-frame',co.inspectFrame(m.taskId,m.frameId,m.paths??[]));
 else if(m.kind==='debug-local')co.setLocal(m.taskId,m.frameId,m.name,m.value);
 else if(m.kind==='configure-debug'){
  if(Array.isArray(m.settings?.breakpoints))settings.breakpoints=m.settings.breakpoints.slice(0,1000);
  if(typeof m.settings?.breakOnEntry==='boolean')entry.checked=m.settings.breakOnEntry;
 }

}catch(e){send('error',e.message);}});
return {invoke(m,args,constructorArgs,instances){
 if(co.busy)throw new Error('Finish or cancel the active invocation first');
 const task=co.run((function*(){
  let self=null;
  if(!m.static){const key=m.assembly+'::'+m.owner+':'+JSON.stringify(constructorArgs);self=instances.get(key);
   if(!self){self=yield* co.construct(MS.getType(m.assembly,m.owner),constructorArgs);instances.set(key,self);}}
  return yield* MS.invokeSteps(co,m.assembly,m.token,args,self);
 })(),{breakOnEntry:entry.checked});
 task.promise.then(value=>{if(document.getElementById('binary-debug-state').textContent==='cancelled'){out.textContent='Cancelled';return;}const text=JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,null,2)??'void';out.textContent=text;send('result',text);},error=>{out.textContent=error.name+': '+error.message;send('error',out.textContent);});
}};
})()`;
}
