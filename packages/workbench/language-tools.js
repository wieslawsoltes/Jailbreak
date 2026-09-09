import {element,action} from './studio-ui.js';
/** Worker-backed source editing: source identities never come from running application code. */
export function createLanguageTools({document:doc=globalThis.document,documents,active,open,notify,history}){
  const editor=doc.getElementById('editor'),el=(tag,text,attrs)=>element(doc,tag,text,attrs);
  let worker=null,url=null,serial=0,request=null,timer=null,completion=null,selected=0,disposed=false;
  const toolbar=el('div',undefined,{id:'studio-source-tools',role:'toolbar','aria-label':'Source intelligence'}),status=el('span','C# · XAML',{id:'studio-language-status','aria-live':'polite'});
  const invoke=(id,label,shortcut,fn)=>{const b=action(doc,id,label,null,()=>guard(fn),shortcut);b.className='source-tool';return b;};
  const guard=fn=>{try{const result=fn();result?.catch?.(e=>notify(e.message));}catch(e){notify(e.message);}};
  const back=[],forward=[];
  const position=()=>({file:active(),offset:editor.selectionStart});
  const go=(target,{record=true}={})=>{if(record){back.push(position());if(back.length>100)back.shift();forward.length=0;}open(target.file,target.start??target.offset??0);editor.focus();if(target.end!==undefined)editor.setSelectionRange(target.start,target.end);historyState();};
  const backward=invoke('source-back','←','Alt+Left',()=>{const p=back.pop();if(p){forward.push(position());go(p,{record:false});}}),next=invoke('source-forward','→','Alt+Right',()=>{const p=forward.pop();if(p){back.push(position());go(p,{record:false});}});
  function historyState(){backward.disabled=!back.length;next.disabled=!forward.length;}historyState();
  toolbar.append(backward,next,invoke('source-undo','Undo','Ctrl+Z',()=>history.undo()),invoke('source-redo','Redo','Ctrl+Y',()=>history.redo()),invoke('source-complete','Complete','Ctrl+Space',()=>complete()),invoke('source-definition','Definition','F12',()=>locate('definition')),invoke('source-references','References','Shift+F12',()=>locate('references')),invoke('source-peek','Peek','Alt+F12',()=>locate('definition',true)),invoke('source-rename','Rename','F2',rename),status);
  doc.querySelector('.editor-path').after(toolbar);
  const popup=el('section',undefined,{id:'source-completions',class:'source-completions',hidden:'','aria-label':'Completion suggestions'}),list=el('div',undefined,{role:'listbox',id:'source-completion-list'}),footer=el('div','↑ ↓ Select   Enter / Tab Insert   Esc Dismiss',{class:'source-completion-footer'});popup.append(list,footer);doc.body.append(popup);
  const peek=el('dialog',undefined,{id:'source-peek-dialog',class:'source-dialog','aria-labelledby':'source-peek-title'}),peekTitle=el('h2','Source locations',{id:'source-peek-title'}),peekRows=el('div',undefined,{id:'source-peek-list','aria-label':'Matching source locations'}),peekCode=el('pre',undefined,{id:'source-peek-code',tabindex:'0'}),peekBody=el('div',undefined,{class:'source-peek-body'});
  const peekClose=invoke('source-peek-close','Close','Esc',()=>peek.close());peekBody.append(peekRows,peekCode);peek.append(peekTitle,peekBody,peekClose);doc.body.append(peek);
  const renameDialog=el('dialog',undefined,{id:'source-rename-dialog',class:'source-dialog','aria-labelledby':'source-rename-title'}),renameTitle=el('h2','Rename local or parameter',{id:'source-rename-title'}),renameInput=el('input',undefined,{id:'source-rename-input','aria-label':'New symbol name',autocomplete:'off',spellcheck:'false'}),renameMessage=el('p','',{id:'source-rename-message',role:'status'}),renameDiff=el('pre','',{id:'source-rename-preview'});
  let renameOrigin=null,renamePlan=null;
  const renamePreview=invoke('source-rename-check','Preview changes','',()=>previewRename()),renameApply=invoke('source-rename-apply','Apply rename','',applyRename),renameCancel=invoke('source-rename-cancel','Cancel','Esc',()=>renameDialog.close());
  renameDialog.append(renameTitle,el('p','Only resolved local/parameter references change. Strings, comments and other symbols are preserved.'),renameInput,renameMessage,renameDiff,renamePreview,renameApply,renameCancel);doc.body.append(renameDialog);
  renameInput.oninput=()=>{renamePlan=null;renameApply.disabled=true;renameDiff.textContent='';};renameInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();guard(previewRename);}};
  function ensureWorker(){
    if(worker)return worker;const code=globalThis.__JailbreakAssets?.languageWorker;
    if(code){url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));worker=new Worker(url);}else worker=new Worker(new URL('./language-worker.js',doc.baseURI),{type:'module'});
    worker.onmessage=({data})=>{if(data.id!==request?.id)return;const req=request;request=null;clearTimeout(req.timeout);status.textContent='Source index ready';
      if(data.error)req.reject(new Error(data.error));else if(active()!==req.file||editor.value!==req.before)req.reject(new Error('Source changed during analysis; request ignored'));else req.resolve(data.result);};
    worker.onerror=event=>{fail(event.message||'Language worker failed');};return worker;
  }
  function fail(message){const req=request;request=null;if(req){clearTimeout(req.timeout);req.reject(new Error(message));}worker?.terminate();worker=null;if(url)URL.revokeObjectURL(url);url=null;status.textContent='Source tools unavailable';}
  function query(action,extra={}){
    if(request){clearTimeout(request.timeout);request.reject(new Error('Source query superseded'));request=null;}
    const file=active(),before=editor.value,offset=editor.selectionStart,id=++serial;
    return new Promise((resolve,reject)=>{let w;try{w=ensureWorker();}catch(e){reject(e);return;}status.textContent='Analyzing source…';request={id,file,before,resolve,reject,timeout:setTimeout(()=>fail('Source analysis exceeded its time budget'),5000)};
      const files=Object.fromEntries(Object.entries(documents()).filter(([p,t])=>/\.(cs|a?xaml)$/i.test(p)&&typeof t==='string'));w.postMessage({id,action,files,file,offset,...extra});});
  }
  function hide(){completion=null;popup.hidden=true;editor.removeAttribute('aria-controls');editor.removeAttribute('aria-activedescendant');}
  function selectedItem(index){selected=Math.max(0,Math.min(list.children.length-1,index));for(const [i,b]of [...list.children].entries())b.setAttribute('aria-selected',String(i===selected));if(list.children[selected]){editor.setAttribute('aria-activedescendant',list.children[selected].id);list.children[selected].scrollIntoView({block:'nearest'});}}
  function placePopup(){const r=editor.getBoundingClientRect(),style=getComputedStyle(editor),mirror=el('div');mirror.style.cssText='position:fixed;visibility:hidden;overflow:hidden;white-space:pre;left:0;top:0;';
    for(const key of ['font','lineHeight','letterSpacing','tabSize','padding','border','boxSizing'])mirror.style[key]=style[key];mirror.style.width=editor.clientWidth+'px';mirror.textContent=editor.value.slice(0,editor.selectionStart);const marker=el('span','\u200b');mirror.append(marker);doc.body.append(mirror);const p=marker.getBoundingClientRect();let x=r.left+p.left-editor.scrollLeft,y=r.top+p.top-editor.scrollTop+parseFloat(style.lineHeight);mirror.remove();
    x=Math.max(8,Math.min(doc.defaultView.innerWidth-370,x));y=Math.max(r.top+20,Math.min(doc.defaultView.innerHeight-270,y));popup.style.left=x+'px';popup.style.top=y+'px';}
  async function complete(){
    if(editor.readOnly){notify('Read-only source can be inspected but not completed');return;}
    const before=editor.value,file=active(),offset=editor.selectionStart,result=await query('complete');
    if(editor.selectionStart!==offset)return;hide();if(!result.items.length){notify(result.reason||'No source-aware completions at this location');return;}
    completion={before,file,items:result.items};list.replaceChildren();
    result.items.forEach((item,i)=>{const b=el('button',undefined,{type:'button',id:'source-completion-'+i,role:'option'});b.append(el('span',({property:'P',field:'F',event:'E',method:'M',local:'L',parameter:'A',control:'◇',class:'C',type:'T'})[item.kind]??'·',{class:'source-kind '+item.kind}),el('strong',item.label),el('small',item.detail??item.kind));b.onpointerdown=e=>e.preventDefault();b.onclick=()=>accept(i);list.append(b);});
    popup.hidden=false;placePopup();selectedItem(0);editor.setAttribute('aria-controls',list.id);editor.focus({preventScroll:true});
  }
  function accept(i){if(!completion)return;const {before,file,items}=completion,item=items[i];if(before!==editor.value||file!==active()||editor.readOnly){hide();notify('Stale completion was not applied');return;}hide();editor.setRangeText(item.insertText,item.start,item.end,'end');editor.setSelectionRange(item.start+item.cursor,item.start+item.cursor);editor.dispatchEvent(new Event('input'));editor.focus();}
  async function locate(kind,preview=false){hide();const result=await query(kind);if(!result.length){notify('No unambiguous source binding at this location');return;}if(kind==='definition'&&result.length===1&&!preview){go(result[0]);return;}
    peekTitle.textContent=(kind==='references'?'References':'Peek definition')+' · '+result.length;peekRows.replaceChildren();peekCode.replaceChildren();
    const show=target=>{const text=documents()[target.file];if(typeof text!=='string'){peekCode.textContent='Source document is no longer available';return;}const start=text.lastIndexOf('\n',Math.max(0,target.start-1))+1;const end=text.indexOf('\n',target.end);const p=el('span',text.slice(Math.max(0,start-300),target.start)),mark=el('mark',text.slice(target.start,target.end)),suffix=el('span',text.slice(target.end,end<0?text.length:Math.min(text.length,end+350)));peekCode.replaceChildren(p,mark,suffix);};
    for(const target of result.slice(0,500)){const b=el('button',target.file+':'+target.line+'  '+(target.declaration?'declaration':'reference'),{type:'button'});b.onclick=()=>{show(target);for(const x of peekRows.children)x.classList.toggle('selected',x===b);};b.ondblclick=()=>{peek.close();go(target);};b.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();peek.close();go(target);}};peekRows.append(b);}
    show(result[0]);const openLocation=invoke('source-peek-open','Open selected source','',()=>{const index=[...peekRows.children].findIndex(b=>b.classList.contains('selected'));peek.close();go(result[index<0?0:index]);});peek.querySelector('#source-peek-open')?.remove();peek.append(openLocation);peek.showModal();peekRows.querySelector('button')?.focus();
  }
  async function rename(){hide();if(editor.readOnly)throw new Error('Verified/generated documents are read-only');const symbol=await query('describe');if(!symbol||!['local','parameter'].includes(symbol.kind))throw new Error('Select a local variable or parameter; global renaming is not yet supported');
    renameOrigin={...position(),before:editor.value};renamePlan=null;renameTitle.textContent='Rename '+symbol.kind+' · '+symbol.name;renameInput.value=symbol.name;renameMessage.textContent='Preview resolves every reference before applying.';renameDiff.textContent='';renameApply.disabled=true;renameDialog.showModal();renameInput.focus();renameInput.select();}
  async function previewRename(){if(!renameOrigin||active()!==renameOrigin.file||editor.value!==renameOrigin.before)throw new Error('Source changed since Rename opened');
    try{const tx=await query('rename',{offset:renameOrigin.offset,name:renameInput.value});renamePlan=tx;renameMessage.textContent=tx.edits.length+' bound locations · one undoable edit';renameDiff.textContent=tx.edits.map(e=>{const line=tx.before.slice(0,e.start).split('\n').length;return 'Line '+line+'   '+tx.before.slice(e.start,e.end)+' → '+e.text;}).join('\n');renameApply.disabled=false;}
    catch(error){renamePlan=null;renameApply.disabled=true;renameMessage.textContent=error.message;}
  }
  function applyRename(){const tx=renamePlan;if(!tx||active()!==tx.file||editor.value!==tx.before||editor.readOnly)throw new Error('Source changed; stale rename was not applied');editor.setRangeText(tx.after,0,editor.value.length,'start');editor.setSelectionRange(tx.selection,tx.selection);editor.dispatchEvent(new Event('input'));renameDialog.close();editor.focus();notify(tx.label);}
  function key(event){
    if(event.isComposing||disposed)return;
    if(!popup.hidden&&event.target===editor){if(['ArrowDown','ArrowUp','Enter','Tab','Escape'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape')hide();else if(event.key==='Enter'||event.key==='Tab')accept(selected);else selectedItem(selected+(event.key==='ArrowDown'?1:-1));return;}}
    if(doc.querySelector('dialog[open]'))return;let fn;
    if((event.ctrlKey||event.metaKey)&&event.code==='Space')fn=complete;
    else if(event.key==='F12')fn=()=>locate(event.shiftKey?'references':'definition',event.altKey);
    else if(event.key==='F2'&&doc.activeElement===editor)fn=rename;
    else if(event.altKey&&event.key==='ArrowLeft')fn=()=>backward.click();else if(event.altKey&&event.key==='ArrowRight')fn=()=>next.click();
    if(fn){event.preventDefault();event.stopImmediatePropagation();guard(fn);}
  }
  const input=()=>{hide();clearTimeout(timer);if(!editor.readOnly&&editor.value[editor.selectionStart-1]==='.')timer=setTimeout(()=>guard(complete),180);};
  const outside=e=>{if(!popup.contains(e.target)&&e.target!==editor)hide();};
  const scroll=()=>{if(!popup.hidden)placePopup();};doc.addEventListener('keydown',key,true);doc.addEventListener('pointerdown',outside,true);editor.addEventListener('input',input);editor.addEventListener('scroll',scroll);
  return {changed(){hide();},reset(){hide();back.length=forward.length=0;historyState();},dispose(){disposed=true;hide();clearTimeout(timer);fail('Source tools disposed');toolbar.remove();popup.remove();peek.remove();renameDialog.remove();doc.removeEventListener('keydown',key,true);doc.removeEventListener('pointerdown',outside,true);editor.removeEventListener('input',input);editor.removeEventListener('scroll',scroll);}};
}
