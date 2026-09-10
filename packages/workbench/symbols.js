import {decodeBinaryRecord,encodeBinaryFile} from '../binary-project/workspace.js';
import {planSymbolRestore,restoreSymbols} from '../symbol-restoration/index.js';
import {sourceTransaction} from '../workspace/journal.js';
import {element,action} from './studio-ui.js';
/** An explicit source-workspace operation. Symbol metadata cannot start network I/O. */
export function createSymbolTools({document:doc=globalThis.document,workspace,development,compile,notify,activateSource=()=>{}}){
  const el=(tag,text,attrs)=>element(doc,tag,text,attrs),root=el('section',undefined,{id:'desktop-symbols'});
  const select=el('select',undefined,{id:'symbols-library','aria-label':'Source workspace library'}),files=el('input',undefined,{id:'symbols-file',type:'file',accept:'.dll,.exe',hidden:''});
  const label=(name,node)=>{const l=el('label',name);l.append(node);return l;};
  const servers=el('textarea',undefined,{id:'symbols-servers',rows:2,placeholder:'https://symbols.example/symbols','aria-label':'Approved symbol servers'});
  const origins=el('textarea',undefined,{id:'symbols-origins',rows:2,placeholder:'https://raw.githubusercontent.com','aria-label':'Approved original-source origins'});
  const mapping=el('textarea',undefined,{id:'symbols-map',rows:4,placeholder:'{"documents":{"C:\\\\build\\\\*":"https://source.example/revision/*"}}','aria-label':'Explicit Source Link map'});
  const consent=el('input',undefined,{type:'checkbox',id:'symbols-consent'}),refresh=el('input',undefined,{type:'checkbox',id:'symbols-refresh'});
  const message=el('p','Select a source-workspace DLL or open one. Inspecting does not make requests.',{id:'symbols-status',role:'status'}),report=el('pre','',{id:'symbols-report'});
  let opened=null,controller=null,ticket=0,pending=null,disposed=false;
  const setMessage=text=>message.textContent=text;
  const fail=e=>{setMessage(e.message??String(e));notify(e.message??String(e));};
  const button=(id,title,fn)=>action(doc,id,title,null,()=>{try{const p=fn();p?.catch(fail);}catch(e){fail(e);}});
  function stop(){ticket++;controller?.abort(new Error('Symbol restoration cancelled'));controller=null;pending=null;cancel.disabled=true;attach.disabled=true;restore.disabled=!consent.checked;}
  function selected(){
    if(select.value==='@opened'&&opened)return opened;
    const source=workspace.files()[select.value];if(typeof source!=='string')throw new Error('Choose a managed DLL');
    const record=decodeBinaryRecord(source,select.value);if(record.kind!=='dll')throw new Error('Choose a loose DLL; package symbols are restored from supplied packages during conversion');
    return {record,path:select.value,before:source};
  }
  const lines=input=>input.value.split(/\r?\n|,/).map(s=>s.trim()).filter(Boolean);
  const options=()=>({consent:consent.checked,symbolServers:lines(servers),sourceOrigins:lines(origins),refreshSources:refresh.checked,requireSources:true,...(mapping.value.trim()?{sourceMap:JSON.parse(mapping.value)}:{})});
  const inspect=button('symbols-inspect','Inspect requests',()=>{const {record}=selected();const plan=planSymbolRestore(record,options());report.textContent=JSON.stringify(plan,null,2);setMessage('No network requests made. Servers receive the PDB filename and build identity; approved source origins receive Source Link paths.');});
  const restore=button('symbols-restore','Restore & verify',async()=>{
    if(!development.canEdit())throw new Error('Finish or cancel suspended execution before restoring symbols');
    stop();const choice=selected(),revision=workspace.journal.state().revision,ownTicket=++ticket,policy=options();controller=new AbortController();restore.disabled=true;cancel.disabled=false;setMessage('Restoring with identity, source-checksum and byte-budget validation…');
    try{
      const result=await restoreSymbols(choice.record,{...policy,signal:controller.signal});
      if(disposed||ownTicket!==ticket)return;
      if(revision!==workspace.journal.state().revision)throw new Error('Workspace changed during restoration; nothing was attached');
      pending={choice,result,revision};report.textContent=JSON.stringify(result.report,null,2);setMessage('Verified '+result.report.verifiedDocuments+' original document(s). Attach & restart applies one undoable workspace change.');attach.disabled=false;
    }finally{if(ownTicket===ticket){controller=null;cancel.disabled=true;restore.disabled=!consent.checked;}}
  });
  const attach=button('symbols-attach','Attach & restart',async()=>{
    if(!pending)throw new Error('Restore and verify symbols first');const p=pending,ownTicket=ticket;
    if(p.revision!==workspace.journal.state().revision)throw new Error('Workspace changed after verification; restore again');
    attach.disabled=true;setMessage('Validating the linked application before changing the workspace…');
    try{
      const after=encodeBinaryFile(p.result.path,p.result.bytes,{pdb:p.result.pdb,sources:p.result.sources});
      const candidate={...workspace.files(),[p.choice.path]:after};const compiled=await workspace.validate(candidate);
      if(disposed||ownTicket!==ticket)return;
      if(p.revision!==workspace.journal.state().revision)throw new Error('Workspace changed during validation; nothing was attached');
      if(!compiled.success)throw new Error('Library is outside the current compiler profile: '+compiled.diagnostics.filter(d=>d.severity==='error').slice(0,3).map(d=>d.message).join('; '));
      const tx=sourceTransaction([{path:p.choice.path,before:p.choice.before,after}],'Attach verified original symbols');pending=null;
      workspace.apply(tx);opened=null;refreshLibraries();select.value=p.choice.path;activateSource();compile(true);setMessage('Verified symbols attached. Original source is debugger-only. Restarting the application.');
    }finally{if(pending===p)attach.disabled=false;}
  });attach.disabled=true;
  const cancel=button('symbols-cancel','Cancel',()=>{stop();setMessage('Cancelled. No workspace changes applied.');});cancel.disabled=true;
  const open=button('symbols-open','Open managed DLL',()=>files.click());
  files.onchange=async()=>{const file=files.files?.[0];if(!file)return;stop();try{
    if(!/\.(dll|exe)$/i.test(file.name)||file.size>16*1024*1024)throw new Error('Choose a managed DLL/EXE no larger than 16 MiB');
    const path='libraries/'+file.name+'.binary.json';if(Object.hasOwn(workspace.files(),path))throw new Error('This workspace already contains '+path+'; select that record instead');
    const record={path:file.name,bytes:new Uint8Array(await file.arrayBuffer())};planSymbolRestore(record);opened={record,path,before:null};refreshLibraries();select.value='@opened';inspect.click();
  }catch(e){fail(e);}finally{files.value='';}};
  function refreshLibraries(){const prior=select.value;select.replaceChildren(el('option','Select a source-workspace DLL…',{value:''}));for(const [path,text]of Object.entries(workspace.files()))if(path.endsWith('.binary.json')){
    try{const record=decodeBinaryRecord(text,path);if(record.kind==='dll')select.append(el('option',record.path+(record.pdb?' · symbols attached':''),{value:path}));}catch{/* The compiler reports malformed records; do not manufacture a module here. */}}
    if(opened)select.append(el('option',opened.record.path+' · not attached',{value:'@opened'}));if([...select.options].some(o=>o.value===prior))select.value=prior;
  }
  select.onchange=()=>{consent.checked=false;stop();report.textContent='';};
  for(const field of [servers,origins,mapping,refresh])field.addEventListener('input',()=>{consent.checked=false;stop();});consent.onchange=()=>{if(!consent.checked)stop();restore.disabled=!consent.checked;};restore.disabled=true;
  const controls=el('div',undefined,{class:'desktop-window-toolbar'});controls.append(open,inspect,restore,attach,cancel);
  const policy=el('div',undefined,{class:'symbols-policy'}),advanced=el('details');advanced.append(el('summary','Explicit source map (optional)'),mapping);
  policy.append(label('Library',select),label('Approved symbol-server URLs (one per line)',servers),label('Approved original-source origins (one per line)',origins),label('Re-fetch embedded originals from Source Link',refresh),advanced,label('Allow this operation to download from the listed servers and origins',consent));
  root.append(controls,files,policy,message,report);
  const unsubscribe=workspace.journal.subscribe(()=>{if(controller){stop();setMessage('Workspace changed; restoration cancelled without attaching results.');}else if(pending){stop();setMessage('Workspace changed; verified result was not attached.');}refreshLibraries();});
  refreshLibraries();return {node:root,dispose(){disposed=true;stop();unsubscribe();root.remove();}};
}
