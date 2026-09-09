import {decodeBinaryRecord} from '../binary-project/workspace.js';
import {planSymbolRestore,restoreSymbols} from '../symbol-restoration/index.js';

/** IDE-origin, opt-in symbol retrieval. Never evaluates binary or application source. */
export function createSymbolTools({document:doc=globalThis.document,workspace,compile,notify=()=>{},activateSource=()=>{}}){
  const el=(tag,text,attrs={})=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const node=el('section',undefined,{id:'desktop-symbols',class:'symbol-tools'});
  const title=el('div','Symbols & original sources',{class:'symbol-tools-heading'});
  const record=el('select',undefined,{id:'symbols-library','aria-label':'Managed library attachment'});
  const servers=el('textarea',undefined,{id:'symbols-servers',rows:'2',placeholder:'https://your-symbol-server.example/symbols/','aria-label':'Approved symbol servers'});
  const origins=el('textarea',undefined,{id:'symbols-origins',rows:'2',placeholder:'https://raw.githubusercontent.com','aria-label':'Approved original-source origins'});
  const map=el('textarea',undefined,{id:'symbols-map',rows:'3',placeholder:'Optional explicit Source Link JSON','aria-label':'Explicit Source Link map'});
  const consent=el('input',undefined,{id:'symbols-consent',type:'checkbox'});
  const refresh=el('input',undefined,{id:'symbols-refresh-source',type:'checkbox'});
  const local=el('input',undefined,{id:'symbols-loopback',type:'checkbox'});
  const require=el('input',undefined,{id:'symbols-require-source',type:'checkbox'});require.checked=true;
  const status=el('div','Select a DLL workspace attachment. No network requests occur until Restore is selected with consent.',{id:'symbols-status',role:'status'});
  const report=el('pre','',{id:'symbols-report',tabindex:'0','aria-label':'Symbol restoration report'});
  let disposed=false,operation=0,controller=null,records=new Map();
  const checkbox=(input,label)=>{const n=el('label',undefined,{class:'symbol-option'});n.append(input,doc.createTextNode(label));return n;};
  const field=(caption,input)=>{const n=el('label',undefined,{class:'symbol-field'});n.append(el('span',caption),input);return n;};
  const refreshButton=el('button','Refresh libraries',{id:'symbols-refresh',type:'button'}),planButton=el('button','Preview requests',{id:'symbols-plan',type:'button'}),restoreButton=el('button','Restore & attach',{id:'symbols-restore',type:'button'}),cancel=el('button','Cancel',{id:'symbols-cancel',type:'button'});cancel.disabled=true;
  const toolbar=el('div',undefined,{class:'desktop-window-toolbar'});toolbar.append(record,refreshButton,planButton,restoreButton,cancel);
  const sourceDetails=el('details',undefined,{class:'symbol-source-options'});sourceDetails.append(el('summary','Source Link and network policy'),field('Approved source origins (one exact origin per line)',origins),field('Explicit Source Link map (optional; otherwise use the PDB map)',map),checkbox(refresh,'Retrieve source again even when embedded source is present'),checkbox(require,'Require all original source documents'),checkbox(local,'Allow explicitly configured loopback HTTP servers'));
  node.append(title,toolbar,field('Symbol servers (one HTTPS base URL per line)',servers),sourceDetails,checkbox(consent,'Allow requests to the listed servers and source origins for this operation'),status,report);
  function sourceFiles(){if(typeof workspace?.symbolWorkspace!=='function')throw new Error('This host has not connected symbol attachment transactions');return workspace.symbolWorkspace();}
  function lines(input){return input.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);}
  function policy(){return {consent:consent.checked,symbolServers:lines(servers),sourceOrigins:lines(origins),sourceMap:map.value.trim()?JSON.parse(map.value):undefined,allowLocalHttp:local.checked,refreshSources:refresh.checked,requireSources:require.checked,maxRequests:64,maxBytes:32*1024*1024,maxPdbBytes:16*1024*1024,maxSourceBytes:4*1024*1024,timeoutMs:20000};}
  function syncButtons(){const selected=records.has(record.value);restoreButton.disabled=!!controller||!selected||!consent.checked;planButton.disabled=!!controller||!selected;record.disabled=!!controller;refreshButton.disabled=!!controller;cancel.disabled=!controller;}
  function refreshRecords(){
    const old=record.value;records=new Map();record.replaceChildren();
    const files=sourceFiles();
    for(const [path,text]of Object.entries(files))if(path.endsWith('.binary.json')){
      try{const input=decodeBinaryRecord(text,path);if(input.kind!=='dll')continue;records.set(path,{input,text});record.append(el('option',input.path,{value:path}));}catch{/* Invalid files remain compiler diagnostics, not retrieval inputs. */}
    }
    if(records.has(old))record.value=old;
    if(!records.size){record.append(el('option','No loose DLL attachments in this workspace',{value:''}));status.textContent='Import a DLL workspace record first. NuGet dependency restore is a separate operation.';}
    syncButtons();
  }
  function selected(){const entry=records.get(record.value);if(!entry)throw new Error('Select a managed DLL attachment');if(sourceFiles()[record.value]!==entry.text)throw new Error('The library changed. Refresh the library list before restoring symbols.');return {path:record.value,...entry};}
  function error(e){if(disposed)return;status.textContent=String(e?.message??e);notify(status.textContent);}
  function safe(fn){try{return fn();}catch(e){error(e);}}
  function encode(bytes){let binary='';for(let at=0;at<bytes.length;at+=8192)binary+=String.fromCharCode(...bytes.subarray(at,at+8192));return btoa(binary);}
  async function restore(){
    if(controller)return;
    let target,options;try{target=selected();options=policy();if(!options.consent)throw new Error('Explicit consent is required');}catch(e){error(e);return;}
    const id=++operation;controller=new AbortController();options.signal=controller.signal;syncButtons();status.textContent='Restoring and verifying symbols…';report.textContent='';
    try{
      const result=await restoreSymbols(target.input,options);
      if(disposed||id!==operation)return;
      const original=JSON.parse(target.text);
      const updated={...original,symbols:{...original.symbols,pdb:encode(result.pdb),sources:result.sources}};
      const after=JSON.stringify(updated,null,2)+'\n';decodeBinaryRecord(after,target.path);
      if(typeof workspace.applySymbolAttachments!=='function')throw new Error('The workspace cannot apply symbol attachments');
      // The host validates the complete preimage immediately before changing any files.
      workspace.applySymbolAttachments([{path:target.path,before:target.text,after}]);
      report.textContent=JSON.stringify(result.report,null,2);
      status.textContent=`Attached verified ${result.report.format} symbols and ${result.report.verifiedDocuments} original source document(s).`;
      consent.checked=false;activateSource();await compile();
    }catch(e){if(!disposed&&id===operation)error(e);}finally{if(id===operation){controller=null;if(!disposed){safe(refreshRecords);syncButtons();}}}
  }
  refreshButton.onclick=()=>safe(refreshRecords);
  planButton.onclick=()=>safe(()=>{const target=selected(),plan=planSymbolRestore(target.input,policy());report.textContent=JSON.stringify(plan,null,2);status.textContent='Request plan only. No network requests were made.';});
  restoreButton.onclick=restore;cancel.onclick=()=>controller?.abort(new Error('Symbol restoration cancelled'));
  consent.onchange=record.onchange=syncButtons;
  const observer=new MutationObserver(()=>{if(!node.hidden&&node.closest('[hidden]')===null&&!controller)safe(refreshRecords);});
  observer.observe(node,{attributes:true,attributeFilter:['hidden']});safe(refreshRecords);
  return {node,refresh:()=>safe(refreshRecords),dispose(){if(disposed)return;disposed=true;operation++;controller?.abort(new Error('Symbol tool disposed'));controller=null;observer.disconnect();records.clear();node.remove();}};
}
