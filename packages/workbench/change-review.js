import {lineDiff} from '../workspace/diff.js';
import {sourceTransaction} from '../workspace/journal.js';
import {extractComponent} from '../development/component-refactor.js';
/** Local workspace review; not a Git client. Uses the same transaction history as the editor/designer. */
export function createChangeReview({document:doc=globalThis.document,workspace,development,open,notify,shell,compile}){
  const el=(tag,text,attrs={})=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;},$=id=>doc.getElementById(id);
  const guard=fn=>{try{return fn();}catch(e){message.textContent=e.message;notify(e.message);}};
  const button=(id,label,run)=>{const n=el('button',label,{id,type:'button'});n.onclick=()=>guard(run);return n;};
  const dialog=el('dialog',undefined,{id:'workspace-review','aria-labelledby':'workspace-review-title'}),title=el('h2','Workspace changes',{id:'workspace-review-title'});
  const header=el('header');header.append(title,button('workspace-review-close','Close',()=>dialog.close()));
  const message=el('p','',{id:'workspace-review-message',role:'status'}),tools=el('div',undefined,{class:'workspace-review-toolbar'}),checkpoints=el('select',undefined,{id:'workspace-checkpoints','aria-label':'Compare with checkpoint'});
  const checkpointLabel=el('input',undefined,{id:'workspace-checkpoint-name',placeholder:'Checkpoint label','aria-label':'Checkpoint label',maxlength:'120'});
  const checkpoint=button('workspace-checkpoint','Create checkpoint',()=>{workspace.journal.checkpoint(workspace.files(),checkpointLabel.value||'Checkpoint '+new Date().toLocaleTimeString());checkpointLabel.value='';refresh();});
  const undo=button('workspace-undo','Undo',()=>workspace.history('undo')),redo=button('workspace-redo','Redo',()=>workspace.history('redo'));
  const download=(name,text)=>{const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=el('a',undefined,{download:name,href:url});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const exportButton=button('workspace-export-changes','Export changes',()=>download('jailbreak-source-changes.json',workspace.journal.exportChanges(workspace.files(),checkpointId())));
  const importFile=el('input',undefined,{type:'file',accept:'.json',hidden:'',id:'workspace-import-file'}),importButton=button('workspace-import-changes','Import changes',()=>importFile.click());
  tools.append(checkpoints,checkpointLabel,checkpoint,undo,redo,exportButton,importButton,importFile);
  const layout=el('div',undefined,{class:'workspace-review-layout'}),list=el('nav',undefined,{id:'workspace-change-list','aria-label':'Changed source files'}),diff=el('section',undefined,{id:'workspace-diff','aria-label':'Source differences'});
  layout.append(list,diff);
  const footer=el('footer'),summary=el('span','',{id:'workspace-review-summary'}),restoreFile=button('workspace-restore-file','Review restore file',()=>prepareRestore([selected])),restoreAll=button('workspace-restore-all','Review restore all',()=>prepareRestore());
  const apply=button('workspace-apply','Apply reviewed changes',()=>applyPlan()),cancel=button('workspace-cancel-plan','Cancel review',()=>{plan=null;refresh();});
  footer.append(summary,restoreFile,restoreAll,cancel,apply);dialog.append(header,message,tools,layout,footer);doc.body.append(dialog);
  let selected=null,changes=[],plan=null,planRevision=null,returnFocus=null,working=false,validation=0,disposed=false;
  const checkpointId=()=>Number(checkpoints.value)||workspace.journal.state().checkpoints[0]?.id;
  const diffView=c=>{
    diff.replaceChildren();if(!c){diff.append(el('p','No source changes in this comparison.'));return;}
    const heading=el('div',undefined,{class:'workspace-diff-heading'});heading.append(el('strong',c.path),button('workspace-open-source','Open source',()=>{dialog.close();open(c.path);}));diff.append(heading);
    if(c.path.endsWith('.binary.json')||c.before?.startsWith('data:')||c.after?.startsWith('data:')){diff.append(el('p','Binary/asset payload changed. Exact payload is retained in the transaction; textual diff is not rendered.'));return;}
    const result=lineDiff(c.before??'',c.after??'');if(result.coarse||result.truncated)diff.append(el('p',result.truncated?'Display limit reached. The complete exact change is retained.':'Large changed block shown as exact replacement.'));
    const rows=el('div',undefined,{class:'workspace-diff-lines'});
    for(const r of result.rows){const row=el('div',undefined,{class:'workspace-diff-row '+r.kind});row.append(el('span',r.beforeLine??'',{class:'diff-line-number'}),el('span',r.afterLine??'',{class:'diff-line-number'}),el('span',{add:'+',remove:'−',equal:' ',gap:'…'}[r.kind]),el('code',r.text.slice(0,16000)));if(r.text.length>16000)row.append(el('span','[line display truncated]'));rows.append(row);}diff.append(rows);
  };
  function render(){
    list.replaceChildren();if(!changes.some(c=>c.path===selected))selected=changes[0]?.path??null;
    for(const c of changes){const type=c.before===null?'added':c.after===null?'deleted':'modified',b=button('',c.path,()=>{selected=c.path;render();});b.dataset.path=c.path;b.dataset.change=type;b.setAttribute('aria-current',String(c.path===selected));b.prepend(el('span',{added:'A',deleted:'D',modified:'M'}[type],{class:'change-mark'}));list.append(b);}
    if(!changes.length)list.append(el('p','No changes'));diffView(changes.find(c=>c.path===selected));
    summary.textContent=changes.length+' file'+(changes.length===1?'':'s')+' · local source only';apply.hidden=cancel.hidden=!plan;apply.disabled=working||!changes.length;restoreFile.hidden=restoreAll.hidden=!!plan;restoreFile.disabled=restoreAll.disabled=!changes.length;
    tools.hidden=!!plan;title.textContent=plan?plan.label:'Workspace changes';
    const state=workspace.journal.state();undo.disabled=!state.undo;redo.disabled=!state.redo;undo.title=state.undo??'Nothing to undo';redo.title=state.redo??'Nothing to redo';
  }
  function refresh(){
    const prior=checkpointId();checkpoints.replaceChildren();for(const c of workspace.journal.state().checkpoints)checkpoints.append(el('option',c.label+' · '+new Date(c.time).toLocaleTimeString(),{value:c.id}));
    if([...checkpoints.options].some(o=>Number(o.value)===prior))checkpoints.value=String(prior);
    changes=plan?.changes??workspace.journal.changes(workspace.files(),checkpointId());render();
    if(!plan)message.textContent='Compare with a local checkpoint. Restores and refactors are undoable. Export contains exact source; nothing is uploaded.';
  }
  function show(){plan=null;returnFocus=doc.activeElement;refresh();if(!dialog.open)dialog.showModal();}
  function review(tx,note){plan=tx;planRevision=workspace.journal.state().revision;changes=tx.changes;message.textContent=note;render();if(!dialog.open){returnFocus=doc.activeElement;dialog.showModal();}}
  function prepareRestore(paths=null){review(workspace.journal.restoreTransaction(workspace.files(),checkpointId(),paths),'Review the exact source changes below, including any additions/deletions. Applying will not change files on disk.');}
  function applyPlan(){
    if(!plan)return;if(planRevision!==workspace.journal.state().revision)throw new Error('Workspace changed after review; prepare the changes again');
    const tx=plan;plan=null;workspace.apply(tx);refresh();if(tx.componentPath){dialog.close();compile();notify('Component extracted. A changed document/type set requires restarting the running preview.');}
  }
  checkpoints.onchange=()=>{plan=null;refresh();};dialog.addEventListener('close',()=>returnFocus?.focus?.());
  importFile.onchange=async()=>{const file=importFile.files[0];if(!file)return;try{if(file.size>64000000)throw new Error('Change-set budget exceeded');const value=JSON.parse(await file.text());if(value.format!=='jailbreak-source-changes-v1')throw new Error('Unknown source change format');review(sourceTransaction(value.changes,value.label),'Imported source changes are not applied yet. Every original file must still match before Apply.');}catch(e){message.textContent=e.message;notify(e.message);}finally{importFile.value='';}};
  const entryButton=button('studio-change-review','Changes',show);entryButton.title='Compare source, checkpoints and atomic undo';
  doc.querySelector('.studio-toolbar').append(entryButton);
  const unobserve=workspace.journal.subscribe(()=>{
    const amount=workspace.journal.changes(workspace.files()).length;entryButton.textContent='Changes'+(amount?' · '+amount:'');
    if(dialog.open&&!plan)refresh();
  });
  const extractDialog=el('dialog',undefined,{id:'component-extract','aria-labelledby':'component-extract-title'}),extractName=el('input',undefined,{id:'component-name',value:'NewComponent','aria-label':'Component class name',maxlength:'80'}),extractMessage=el('p','',{id:'component-message',role:'status'});
  const extract=()=>{try{const s=development.sourceForSelection();if(!s)throw new Error('Select a source-backed visual in the designer first');extractName.value='NewComponent';extractMessage.textContent='Extract a self-contained literal subtree. Layout stays on the host; external names, handlers, bindings and styles are protected.';extractDialog.showModal();extractName.focus();extractName.select();}catch(e){notify(e.message);}};
  const preview=button('component-preview','Validate & review',async()=>{
    const stamp=workspace.journal.state().revision,ticket=++validation;working=true;preview.disabled=true;
    try{
      const source=development.sourceForSelection();if(!source)throw new Error('Selection is no longer editable');
      const tx=extractComponent(workspace.files(),source.file,source.offset,{name:extractName.value});
      const candidate={...workspace.files()};for(const c of tx.changes)if(c.after===null)delete candidate[c.path];else candidate[c.path]=c.after;
      extractMessage.textContent='Validating the proposed project in the compiler worker…';const result=await workspace.validate(candidate);
      if(disposed||ticket!==validation||!extractDialog.open)return;
      if(stamp!==workspace.journal.state().revision)throw new Error('Workspace changed during validation; try again');
      if(!result.success)throw new Error('Candidate does not compile: '+result.diagnostics.filter(d=>d.severity==='error').map(d=>d.message).slice(0,3).join('; '));
      if(!result.files?.includes(tx.componentPath)||!result.files?.includes(tx.componentPath+'.cs'))throw new Error('Project excludes the new component files; update explicit project items first');
      extractDialog.close();review(tx,'The real compiler accepted these three file changes. Apply creates a new UserControl boundary and requires a preview restart.');
    }catch(e){extractMessage.textContent=e.message;}finally{working=false;preview.disabled=false;if(dialog.open)render();}
  });
  extractDialog.addEventListener('close',()=>{validation++;});
  extractDialog.append(el('h2','Extract reusable UserControl',{id:'component-extract-title'}),extractMessage,extractName,el('div','The source edit is atomic and reversible. No code is executed during validation.',{class:'workspace-note'}),preview,button('component-cancel','Cancel',()=>extractDialog.close()));doc.body.append(extractDialog);
  const extractButton=button('studio-extract-component','Extract component…',extract);$('dev-property-panel').append(extractButton);
  const removeCommands=shell?.registerCommands?.([{label:'View: Workspace changes and source checkpoints',run:show},{label:'Edit: Undo workspace change',run:()=>workspace.history('undo')},{label:'Edit: Redo workspace change',run:()=>workspace.history('redo')},{label:'Refactor: Extract selection as UserControl',run:extract}]);
  return {show,dispose(){disposed=true;validation++;unobserve();removeCommands?.();dialog.remove();extractDialog.remove();entryButton.remove();extractButton.remove();}};
}
