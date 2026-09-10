import {previewShortcut} from '../packages/workbench/preview-shortcuts.js';
import {createBinaryApplicationHtml} from '../packages/msil-runtime/export.js';
const $=id=>document.getElementById(id),state={mode:'il',files:[],result:null,id:0,worker:null,workerUrl:null,channel:'',tab:'il',ready:false};
let assets=null,timer=null,hostChannel=null,pausedBinary=null,binaryBusy=false,pendingInvoke=false,hostSettings={breakpoints:[],breakOnEntry:false};
addEventListener('keydown',event=>{if(!hostChannel||!event.isTrusted)return;const command=previewShortcut(event);if(command){event.preventDefault();hostSend('ide-shortcut',command);}},true);
function hostSend(event,payload={}){if(hostChannel)parent.postMessage({jailbreakBinaryStudio:1,channel:hostChannel,event,payload},'*');}
function hostState(){hostSend('binary-state',{ready:state.ready,compiled:state.result?.success===true,debug:$('cooperative-debug').checked,busy:binaryBusy,sites:state.result?.debug?.sites??[],sources:state.result?.debug?.sources??{}});}
function runtimeCommand(kind,payload={}){if(!state.channel)throw new Error('Compile a binary first');$('preview').contentWindow.postMessage({...payload,channel:state.channel,kind},'*');}
function hosted(enabled){document.body.classList.toggle('binary-hosted',enabled);}
window.addEventListener('message',event=>{
 const m=event.data,p=m?.payload??{};if(event.source!==parent||parent===window||m?.jailbreakStudio!==1)return;
 if(m.action==='attach'&&!hostChannel&&typeof m.channel==='string'&&/^studio-[a-f0-9-]{16,80}$/.test(m.channel)){
  hostChannel=m.channel;hosted(true);hostState();return;
 }
 if(!hostChannel||m.channel!==hostChannel)return;
 try{
  if(m.action==='compile')compile();
  else if(m.action==='start'){if(pausedBinary)runtimeCommand('debug-command',{taskId:pausedBinary.taskId,action:'continue'});else if(state.ready)$('invoke').click();else {pendingInvoke=true;compile();}}
  else if(m.action==='restart'){pendingInvoke=true;compile();}
  else if(m.action==='stop')stop();
  else if(m.action==='break'){hostSettings.breakOnEntry=true;if(state.ready)runtimeCommand('configure-debug',{settings:hostSettings});}
  else if(m.action==='mode'){const value=p.debug===true;if($('cooperative-debug').checked!==value){$('cooperative-debug').checked=value;compile();}}
  else if(['debug-command','debug-frame','debug-local'].includes(m.action))runtimeCommand(m.action,p);
  else if(m.action==='configure-debug'){if(!Array.isArray(p.settings?.breakpoints)||p.settings.breakpoints.length>1000)throw new Error('Invalid binary breakpoints');hostSettings.breakpoints=p.settings.breakpoints;if(state.ready)runtimeCommand('configure-debug',{settings:hostSettings});}
  else if(m.action==='source-location'){
   const point=p.point,text=state.result?.debug?.sources?.[point?.file];if(typeof text!=='string')return;
   showTab('symbols');$('symbol-listing').value=text;$('symbol-path').textContent=point.file;
   $('symbol-listing').setSelectionRange(point.offset??0,point.offset??0);$('symbol-listing').scrollTop=Math.max(0,((point.line??1)-3)*20);
  }
  else if(m.action==='theme')document.body.classList.toggle('light',p.light===true);
  else if(m.action==='export')$('export').click();
  else if(m.action==='open')$('open').click();
 }catch(error){hostSend('tool-error',{message:error.message});}
});

function log(message,severity='info'){hostSend('binary-log',{message:String(message),severity});const el=document.createElement('div');el.className='diagnostic '+severity;el.textContent=message;$('diagnostics').append(el);}
function status(message){$('status').textContent=message;}
function showTab(name){state.tab=name;$('symbol-listing').hidden=name!=='symbols';$('symbol-path').hidden=name!=='symbols';$('il').hidden=name!=='il';$('listing').hidden=name==='il'||name==='symbols';for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('selected',b.dataset.tab===name);if(name==='javascript')$('listing').textContent=state.result?.code||'No successful conversion.';else if(name==='package')$('listing').textContent=JSON.stringify(state.result?.packages??{message:'This input is not a NuGet package.'},null,2);else if(name==='disassembly')$('listing').textContent=state.result?.assemblies.flatMap(a=>a.methods.map(m=>`${a.name} / ${m.owner}::${m.name}\n${m.disassembly}${m.exceptionClauses?.length?'\nException regions:\n'+JSON.stringify(m.exceptionClauses,null,2):''}`)).join('\n\n')||'No decoded methods.';}
function stop(){pausedBinary=null;binaryBusy=false;hostSend('session-stopped');state.ready=false;state.channel='';$('invoke').disabled=true;$('preview').srcdoc='';$('runtime-state').textContent='Stopped';hostState();}
function invalidate(){state.worker?.terminate();clearTimeout(timer);state.id++;state.result=null;$('export').disabled=true;$('compile').disabled=false;stop();status('Modified — recompile before execution');}
function defaultValue(t){if(t==='string')return '';if(t?.kind==='array')return [];return 0;}
function methodChanged(){const [ai,mi]=$('method').value.split(':').map(Number),a=state.result?.assemblies[ai],m=a?.methods[mi];if(!m)return;$('args').value=JSON.stringify(m.name==='Add'&&m.signature.parameters.length===2?[40,2]:m.signature.parameters.map(defaultValue));const ctor=a.methods.find(x=>x.owner===m.owner&&x.name==='.ctor');$('constructor').value=JSON.stringify(ctor?.signature.parameters.map(defaultValue)??[]);$('constructor').disabled=m.static;}
function inventory(){const result=state.result;$('inventory').replaceChildren();$('method').replaceChildren();for(const [ai,a]of result.assemblies.entries()){const title=document.createElement('div');title.className='type';title.textContent=a.name;$('inventory').append(title);for(const [mi,m]of a.methods.entries()){if(!m.public||m.name[0]==='.')continue;const option=document.createElement('option');option.value=`${ai}:${mi}`;option.textContent=`${m.owner.split('.').at(-1)}::${m.name}`;$('method').append(option);const b=document.createElement('button');b.className='method-item';b.textContent=option.textContent;b.onclick=()=>{$('method').value=option.value;methodChanged();showTab('disassembly');$('listing').textContent=m.disassembly;};$('inventory').append(b);}}methodChanged();}
async function compile(){if(!assets)return;state.worker?.terminate();clearTimeout(timer);stop();hostSend('session-starting');state.result=null;$('export').disabled=true;$('compile').disabled=true;$('diagnostics').replaceChildren();status('Compiling binary input…');const id=++state.id;state.workerUrl&&URL.revokeObjectURL(state.workerUrl);state.workerUrl=URL.createObjectURL(new Blob([assets.worker],{type:'text/javascript'}));const worker=state.worker=new Worker(state.workerUrl);
 timer=setTimeout(()=>{worker.terminate();$('compile').disabled=false;status('Compilation timed out');log('Compiler worker exceeded its 15-second limit.','error');},15000);
 worker.onerror=e=>{clearTimeout(timer);$('compile').disabled=false;status('Worker error');log(e.message,'error');};
 worker.onmessage=({data})=>{if(data.id!==state.id)return;clearTimeout(timer);worker.terminate();state.result=data.result;const r=data.result;$('compile').disabled=false;$('count').textContent=r.diagnostics.length;for(const d of r.diagnostics)log(`${d.code} ${d.file??''}${d.method?' / '+d.method:''}${d.ilOffset!==undefined?' IL_'+d.ilOffset.toString(16):''}: ${d.message}`,d.severity);inventory();showTab(state.tab);if(!r.success){status('Conversion failed');hostState();return;}
 log(`Converted ${r.stats.methods} methods in ${r.stats.assemblies} assembly/assemblies.`, 'success');$('summary').textContent=`${r.stats.milliseconds.toFixed(1)} ms · ${r.code.length.toLocaleString()} generated JS bytes`;$('export').disabled=false;status('Conversion succeeded');state.channel='binary-'+(crypto.randomUUID?.()??Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join(''));$('preview').srcdoc=createBinaryApplicationHtml(r,assets.runtime,{channel:state.channel,development:{...hostSettings,hosted:!!hostChannel}});hostState();};
 worker.postMessage({id,mode:state.mode,text:$('il').value,files:state.files,framework:$('framework').value.trim(),debug:$('cooperative-debug').checked});
}
function loadSample(value){invalidate();if(['il','loop','exception'].includes(value)){state.mode='il';state.files=[];$('il').readOnly=false;$('il').value=assets.samples[value];showTab('il');}else{const name=({dll:'Jailbreak.BinaryExamples.dll',nuget:'Jailbreak.BinaryExamples.1.0.0.nupkg',exceptionDll:'Jailbreak.ExceptionExamples.dll',exceptionNuget:'Jailbreak.ExceptionExamples.1.0.0.nupkg'})[value];state.mode=name.endsWith('.nupkg')?'nuget':'dll';state.files=[{path:name,bytes:Uint8Array.from(atob((value.startsWith('exception')?assets.exceptionFixture:assets.fixture).files[name].base64),c=>c.charCodeAt(0))}];$('il').readOnly=true;$('il').value='// Binary input: '+name+'\n// Select Disassembly or JavaScript after compiling.\n// The original bytes are decoded locally.';showTab('disassembly');}compile();}
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{try{const files=[...e.target.files];if(!files.length)return;if(files.length>32||files.reduce((n,f)=>n+f.size,0)>32*1024*1024)throw new Error('Binary input budget: 32 files / 32 MiB');invalidate();if(files.length===1&&files[0].name.endsWith('.il')){state.mode='il';$('il').readOnly=false;$('il').value=await files[0].text();showTab('il');}else{const isNuget=files.every(f=>f.name.endsWith('.nupkg')),isDll=files.every(f=>/\.(dll|exe|pdb|cs)$/i.test(f.name));if(!isNuget&&!isDll)throw new Error('Load IL, managed DLLs with adjacent PDB/source files, or NuGet packages');state.mode=isNuget?'nuget':'dll';state.files=await Promise.all(files.map(async f=>({path:f.name,bytes:new Uint8Array(await f.arrayBuffer())})));$('il').readOnly=true;$('il').value='// Loaded binaries:\n'+files.map(f=>'// '+f.name).join('\n');showTab('disassembly');}compile();}catch(e){log(e.message,'error');}};
$('cooperative-debug').onchange=()=>{invalidate();compile();};
$('compile').onclick=compile;$('sample').onchange=()=>loadSample($('sample').value);$('il').oninput=invalidate;$('framework').oninput=invalidate;$('method').onchange=methodChanged;for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>showTab(b.dataset.tab);
$('invoke').onclick=()=>{try{if(!state.ready)return;const [ai,mi]=$('method').value.split(':').map(Number),a=state.result.assemblies[ai],m=a.methods[mi],args=JSON.parse($('args').value),constructorArgs=JSON.parse($('constructor').value);if(!Array.isArray(args)||!Array.isArray(constructorArgs))throw new Error('Arguments must be JSON arrays');$('preview').contentWindow.postMessage({channel:state.channel,kind:'invoke',assembly:a.name,token:m.token,args,constructorArgs},'*');}catch(e){$('result').textContent=e.message;}};
$('export').onclick=()=>{if(!state.result?.success)return;const html=createBinaryApplicationHtml(state.result,assets.runtime),url=URL.createObjectURL(new Blob([html],{type:'text/html'})),link=document.createElement('a');link.href=url;link.download='jailbreak-converted-library.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('message',e=>{const m=e.data;if(e.source!==$('preview').contentWindow||!state.channel||m?.channel!==state.channel)return;if(m.kind==='ready'){state.ready=true;$('invoke').disabled=false;$('runtime-state').textContent='Ready';hostState();if(pendingInvoke){pendingInvoke=false;$('invoke').click();}}else if(m.kind==='result'||m.kind==='error'){$('result').textContent=m.value;if(m.kind==='error')log(m.value,'error');}else if(m.kind==='log')log(m.value);else if(m.kind==='ide-shortcut')hostSend('ide-shortcut',m.value);
 else if(m.kind?.startsWith('debug-')){
  if(m.kind==='debug-started')binaryBusy=true;
  if(m.kind==='debug-paused')pausedBinary=m.value;
  if(m.kind==='debug-resumed')pausedBinary=null;
  if(m.kind==='debug-completed'){pausedBinary=null;binaryBusy=false;}
  $('invoke').disabled=!state.ready||binaryBusy;
  $('runtime-state').textContent=pausedBinary?'Paused':binaryBusy?'Running':state.ready?'Ready':'Stopped';
  hostSend(m.kind,m.value);hostState();
 }
});
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();compile();}});

async function start(){try{assets=globalThis.__JailbreakBinaryAssets??await fetch('./assets.json').then(r=>{if(!r.ok)throw new Error('Run npm run build to create binary studio assets');return r.json();});loadSample('il');}catch(e){status(e.message);log(e.message,'error');}}start();
