import { escapeJs } from '../compiler-core/index.js';
/** Authenticated by iframe identity + per-preview channel, not by an opaque origin string. */
export function developmentBridge(settings,debug){
  return `
const development=Jailbreak.enableDevelopment({...${escapeJs(settings)},debug:${escapeJs({sites:debug?.sites??[]})},report:(event,payload)=>report('development',{event,payload})});
addEventListener('message',event=>{
  const message=event.data;
  if(event.source!==parent||message?.channel!==channel||message?.jailbreakDev!==1)return;
  try{
    if(message.action==='inspect')report('development',{event:'tree',payload:development.tree()});
    else if(message.action==='select')development.select(String(message.id),{additive:!!message.additive});
    else if(message.action==='design-configure')development.surface.configure(message.settings);
    else if(message.action==='design-arrange')development.surface.arrange(message.command);
    else if(message.action==='design-set')development.surface.setGeometry(message.values);
    else if(message.action==='design-clear')development.surface.clear();
    else if(message.action==='pick')development.pick(message.value);
    else if(message.action==='configure')development.configure(message.settings??{});
    else if(message.action==='break-next')development.breakNext();
    else if(message.action==='watch')report('development',{event:'watches',payload:development.watchResults()});
    else if(message.action==='debug-control')development.co.command(message.taskId,message.command);
    else if(message.action==='debug-frame')report('development',{event:'debug-frame',payload:development.co.inspectFrame(message.taskId,message.frameId,message.paths??[])});
    else if(message.action==='debug-local')development.co.setLocal(message.taskId,message.frameId,message.name,message.value);
    else if(message.action==='reload'){
      if(typeof message.script!=='string'||message.script.length>8000000)throw new Error('Reload script exceeds the session limit');
      const failed=error=>report('development',{event:'tool-error',payload:{message:error.message}});addEventListener('error',failed);
      try{const script=document.createElement('script');script.textContent=message.script;document.body.append(script);script.remove();}finally{removeEventListener('error',failed);}
    }
  }catch(error){report('development',{event:'tool-error',payload:{message:error.message}});}
});
queueMicrotask(()=>development.refresh());
`;
}
