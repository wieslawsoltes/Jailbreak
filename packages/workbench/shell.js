import {DocumentPositions,rankItems,documentSymbols,searchWorkspace,findText,replaceText,lineOffset} from './navigation.js';
import {installSplitters} from './layout.js';
/** Optional workbench shell over the real editor/compiler. No application code is evaluated here. */
export function createWorkbenchShell({document:doc=globalThis.document,documents,active,open,generated,notify=()=>{}}){
  const $=id=>doc.getElementById(id),editor=$('editor'),positions=new DocumentPositions();let current='',internal=false;
  const el=(tag,text,attributes={})=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;for(const [k,v]of Object.entries(attributes))e.setAttribute(k,v);return e;};
  const button=(text,id,action)=>{const e=el('button',text,{type:'button',id});e.onclick=()=>safely(action);return e;};
  const safely=action=>{try{return action();}catch(e){notify(e.message);}};
  function savePosition(){if(!internal&&current)positions.save(current,{start:editor.selectionStart,end:editor.selectionEnd,top:editor.scrollTop,left:editor.scrollLeft});}
  for(const event of ['select','keyup','click','scroll'])editor.addEventListener(event,savePosition);
  const layout=installSplitters(doc,{read:()=>{try{return JSON.parse(localStorage.getItem('jailbreak.layout.v2'))??{};}catch{return {};}},write:value=>{try{localStorage.setItem('jailbreak.layout.v2',JSON.stringify(value));}catch{}}});
  doc.body.classList.add('wb-studio');
  const commandButton=button('Search everywhere…','wb-command',()=>show('commands'));commandButton.append(el('kbd','Ctrl ⇧ P'));commandButton.setAttribute('aria-haspopup','dialog');
  const menu=el('nav',undefined,{'aria-label':'Main menu',class:'wb-menubar'});
  for(const [group,label]of [['File','File'],['Edit','Edit'],['View','View'],['Build','Build'],['Debug','Run'],['Help','Help']])menu.append(button(label,'wb-menu-'+group.toLowerCase(),()=>show('commands',group+' ')));
  doc.querySelector('.topbar').insertBefore(menu,doc.querySelector('.top-actions'));menu.after(commandButton);
  doc.querySelector('.brand .workbench').textContent='Studio';doc.querySelector('.brand strong').textContent='Jailbreak';
  const view=el('select',undefined,{id:'wb-view-mode','aria-label':'Editor view mode'});for(const [value,label]of [['split','Code + Preview'],['source','Code only'],['preview','Preview only']])view.append(el('option',label,{value}));view.onchange=()=>{doc.body.dataset.view=view.value;};$('run').parentElement.insertBefore(view,$('run'));
  const searchButton=button('⌕','wb-search',()=>show('search'));searchButton.title='Search workspace · Ctrl+Shift+F';searchButton.setAttribute('aria-label','Search workspace');doc.querySelector('.activity').insertBefore(searchButton,doc.querySelector('.activity').children[1]);
  const quick=button('↗','wb-open-document',()=>show('files'));quick.title='Open document · Ctrl+P';quick.setAttribute('aria-label','Quick open document');doc.querySelector('.editor-path').append(quick);
  const commands=[
    ['File: Open folder','open-folder','Ctrl+O'],['File: Open files','open-files',''],['File: New source file','new-file',''],['File: Download workspace','save-workspace',''],['File: Export compiled application','export',''],
    ['Build: Compile and run','run','Ctrl+Enter'],['Build: Project profiles','build-profile',''],['Debug: Open developer tools','development-tools',''],['Debug: Stop application','stop',''],
    ['Debug: Continue','dev-debug-continue','F8'],['Debug: Step over','dev-debug-over','F10'],['Debug: Step into','dev-debug-into','F11'],['Debug: Step out','dev-debug-out','Shift+F11'],
    ['View: Toggle light / dark theme','theme',''],['View: Expand preview','expand-preview','']
  ].map(([label,id,shortcut])=>({label,shortcut,run:()=>{const target=$(id);if(!target)throw new Error('Command is not available in this workspace');if(target.disabled)throw new Error('Command is unavailable in the current application state');target.click();}}));
  commands.push(...[
    {label:'File: Quick open document',shortcut:'Ctrl+P',run:()=>show('files')},
    {label:'Edit: Find in document',shortcut:'Ctrl+F',run:()=>openFind()},
    {label:'Edit: Replace in document',shortcut:'Ctrl+H',run:()=>openFind(true)},
    {label:'Edit: Go to line and column',shortcut:'Ctrl+G',run:()=>show('line')},
    {label:'Edit: Toggle line comment',shortcut:'Ctrl+/',run:()=>toggleComment()},
    {label:'View: Go to source symbol',shortcut:'Ctrl+Shift+O',run:()=>show('symbols')},
    {label:'View: Search all workspace text',shortcut:'Ctrl+Shift+F',run:()=>show('search')},
    {label:'View: Reset tool-window layout',run:()=>layout.reset()},
    {label:'View: Code only',run:()=>{view.value='source';view.onchange();}},
    {label:'View: Code and preview',run:()=>{view.value='split';view.onchange();}},
    {label:'View: Preview only',run:()=>{view.value='preview';view.onchange();}},
    {label:'View: Generated JavaScript',run:generated},
    {label:'Help: Mandatory compatibility targets',run:()=>window.open('./docs/mandatory-targets-status.md','_blank','noopener')},
    {label:'Help: Debugger and designer documentation',run:()=>window.open('./docs/core-development-tools.md','_blank','noopener')}
  ]);
  const dialog=el('dialog',undefined,{id:'wb-palette','aria-labelledby':'wb-palette-title'}),title=el('h2','Search everywhere',{id:'wb-palette-title'}),query=el('input',undefined,{id:'wb-palette-query',autocomplete:'off',spellcheck:'false',role:'combobox','aria-expanded':'true','aria-controls':'wb-palette-results','aria-autocomplete':'list','aria-label':'Search command, file, symbol or text'}),results=el('div',undefined,{id:'wb-palette-results',role:'listbox'}),hint=el('div','↑ ↓ Navigate · Enter Open · Esc Close',{class:'wb-palette-hint'});
  const dialogTop=el('div',undefined,{class:'wb-dialog-top'});dialogTop.append(title,button('Esc','wb-close-palette',()=>dialog.close()));dialog.append(dialogTop,query,results,hint);doc.body.append(dialog);
  let mode='commands',items=[],index=0,previousFocus=null;
  function close(){if(dialog.open)dialog.close();}
  dialog.addEventListener('close',()=>{previousFocus?.focus?.();});dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
  function navigate(file,start=0,end=start){open(file,start,end);}
  function refresh(){
    const text=query.value;let info='';
    if(mode==='commands')items=rankItems(commands,text);
    if(mode==='files')items=rankItems(Object.keys(documents()).map(file=>({label:file.split('/').at(-1),detail:file,run:()=>navigate(file)})),text);
    if(mode==='symbols'){const file=active(),source=documents()[file]??editor.value;items=rankItems(documentSymbols(source,file).map(symbol=>({...symbol,detail:symbol.detail+' · '+symbol.line,run:()=>navigate(file,symbol.start)})),text);if(!items.length)info='No parsed C# or named XAML symbols. Unsupported syntax is not invented.';}
    if(mode==='search'){const found=searchWorkspace(documents(),text);items=found.rows.map(row=>({...row,run:()=>navigate(row.file,row.start,row.end)}));info=found.truncated?'Result budget reached. Refine your search.':text?items.length+' matching locations':'Enter literal text to search across source files.';}
    if(mode==='line'){const m=/^\s*(\d+)(?::(\d+))?\s*$/.exec(text);items=m?[{label:'Go to line '+m[1]+', column '+(m[2]??1),detail:active(),run:()=>{const at=lineOffset(editor.value,+m[1],+(m[2]??1));selectRange(at,at);}}]:[];info='Enter line or line:column (1-based).';}
    results.replaceChildren();index=0;
    items.forEach((item,i)=>{const b=button('', 'wb-result-'+i,()=>execute(i));b.setAttribute('role','option');b.append(el('span',item.label,{class:'wb-result-label'}));if(item.detail)b.append(el('span',item.detail,{class:'wb-result-detail'}));if(item.shortcut)b.append(el('kbd',item.shortcut));results.append(b);});
    if(!items.length)results.append(el('p',info||'No matching commands or documents.',{class:'wb-empty'}));hint.textContent=info||'↑ ↓ Navigate · Enter Open · Esc Close';selectIndex(0);
  }
  function selectIndex(n){index=Math.max(0,Math.min(items.length-1,n));for(const [i,b]of [...results.querySelectorAll('[role=option]')].entries())b.setAttribute('aria-selected',String(i===index));if(items.length){query.setAttribute('aria-activedescendant','wb-result-'+index);results.children[index].scrollIntoView({block:'nearest'});}else query.removeAttribute('aria-activedescendant');}
  function execute(i){const item=items[i];if(!item)return;close();safely(item.run);}
  function show(next,initial=''){mode=next;previousFocus=doc.activeElement;title.textContent={commands:'Commands',files:'Open document',symbols:'Go to symbol',search:'Search workspace',line:'Go to line'}[mode];query.value=initial;query.placeholder={commands:'Type a command…',files:'Type a file name…',symbols:'Type a symbol name…',search:'Search literal source text…',line:'Line:column'}[mode];if(!dialog.open)dialog.showModal();refresh();query.focus();query.select();}
  query.addEventListener('input',()=>safely(refresh));query.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();selectIndex(index+(event.key==='ArrowDown'?1:-1));}if(event.key==='Enter'){event.preventDefault();execute(index);}});
  // Find/replace is a source transaction on the real editor. Read-only binary
  // symbol documents and generated JavaScript are searchable but never writable.
  const findBar=el('section',undefined,{id:'wb-findbar','aria-label':'Find and replace',hidden:''}),find=el('input',undefined,{id:'wb-find',placeholder:'Find literal text','aria-label':'Find text'}),replace=el('input',undefined,{id:'wb-replace',placeholder:'Replace with','aria-label':'Replacement text'}),count=el('span','',{id:'wb-find-count','aria-live':'polite'});
  const cs=el('input',undefined,{type:'checkbox',id:'wb-find-case'}),ww=el('input',undefined,{type:'checkbox',id:'wb-find-word'}),csLabel=el('label','Match case'),wwLabel=el('label','Whole word');csLabel.prepend(cs);wwLabel.prepend(ww);
  const replaceOne=button('Replace','wb-replace-one',()=>replaceCurrent()),replaceAll=button('Replace all','wb-replace-all',()=>replaceAllMatches());
  findBar.append(find,count,button('↑','wb-find-prev',()=>moveFind(-1)),button('↓','wb-find-next',()=>moveFind(1)),csLabel,wwLabel,replace,replaceOne,replaceAll,button('×','wb-find-close',()=>{findBar.hidden=true;editor.focus();}));doc.querySelector('.editor-pane').insertBefore(findBar,$('editor-wrap'));
  const options=()=>({caseSensitive:cs.checked,wholeWord:ww.checked});
  function selectRange(start,end){editor.focus();editor.setSelectionRange(start,end);editor.scrollTop=Math.max(0,(editor.value.slice(0,start).split('\n').length-4)*parseFloat(getComputedStyle(editor).lineHeight));editor.dispatchEvent(new Event('scroll'));editor.dispatchEvent(new Event('select'));}
  function matches(){return findText(editor.value,find.value,options());}
  function updateFind(){const m=matches();count.textContent=m.matches.length+(m.truncated?'+':'')+' matches';replaceOne.disabled=replaceAll.disabled=editor.readOnly;return m.matches;}
  function openFind(withReplace=false){findBar.hidden=false;replace.hidden=replaceOne.hidden=replaceAll.hidden=!withReplace;if(editor.selectionEnd>editor.selectionStart&&editor.selectionEnd-editor.selectionStart<2000)find.value=editor.value.slice(editor.selectionStart,editor.selectionEnd);updateFind();find.focus();find.select();}
  function moveFind(direction){const found=updateFind();if(!found.length)return;const m=direction>0?(found.find(m=>m.start>=editor.selectionEnd&&(m.start!==editor.selectionStart||m.end!==editor.selectionEnd))??found[0]):([...found].reverse().find(m=>m.end<=editor.selectionStart)??found.at(-1));selectRange(m.start,m.end);}
  function replaceCurrent(){if(editor.readOnly)throw new Error('Read-only document');const found=matches().matches.find(m=>m.start===editor.selectionStart&&m.end===editor.selectionEnd);if(!found)return moveFind(1);editor.setRangeText(replace.value,found.start,found.end,'end');editor.dispatchEvent(new Event('input'));updateFind();}
  function replaceAllMatches(){if(editor.readOnly)throw new Error('Read-only document');const result=replaceText(editor.value,find.value,replace.value,options());if(!result.count)return;editor.setRangeText(result.after,0,editor.value.length,'start');editor.dispatchEvent(new Event('input'));updateFind();notify(result.count+' literal replacements');}
  for(const c of [find,cs,ww])c.addEventListener('input',()=>safely(updateFind));find.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();moveFind(e.shiftKey?-1:1);}if(e.key==='Escape'){findBar.hidden=true;editor.focus();}});
  function toggleComment(){if(editor.readOnly)throw new Error('Read-only document');const text=editor.value,start=text.lastIndexOf('\n',editor.selectionStart-1)+1;let end=text.indexOf('\n',Math.max(editor.selectionStart,editor.selectionEnd-1));if(end<0)end=text.length;const selected=text.slice(start,end);let value;if(/\.a?xaml$/i.test(active())){if(selected.includes('--'))throw new Error('Existing XML comments require explicit source editing');value='<!--'+selected+'-->';}else{const lines=selected.split('\n'),uncomment=lines.every(l=>!l.trim()||/^\s*\/\//.test(l));value=lines.map(l=>uncomment?l.replace(/^(\s*)\/\/? ?/,'$1'):l.replace(/^(\s*)/,'$1// ')).join('\n');}editor.setRangeText(value,start,end,'select');editor.dispatchEvent(new Event('input'));}
  function keys(e){
    if(e.defaultPrevented||e.isComposing)return;
    if((e.ctrlKey||e.metaKey)&&!e.altKey){const key=e.key.toLowerCase();let action;
      if(key==='p')action=()=>show(e.shiftKey?'commands':'files');else if(key==='o'&&e.shiftKey)action=()=>show('symbols');else if(key==='f')action=()=>e.shiftKey?show('search'):openFind();else if(key==='h')action=()=>openFind(true);else if(key==='g')action=()=>show('line');else if(key==='/')action=toggleComment;
      if(action){e.preventDefault();safely(action);return;}
    }
    const command={F8:'dev-debug-continue',F10:'dev-debug-over',F11:e.shiftKey?'dev-debug-out':'dev-debug-into'}[e.key];if(command){e.preventDefault();if($(command)&&!$(command).disabled)$(command).click();}
  }
  const protectReadOnly=e=>{if(editor.readOnly&&e.key==='Tab'){e.preventDefault();e.stopImmediatePropagation();}};doc.addEventListener('keydown',keys,true);editor.addEventListener('keydown',protectReadOnly,true);
  return {show,layout,
    beforeRender(){savePosition();internal=true;},
    afterRender(){current=active();const p=positions.get(current,editor.value.length);editor.setSelectionRange(p.start,p.end);editor.scrollTop=p.top;editor.scrollLeft=p.left;internal=false;editor.dispatchEvent(new Event('scroll'));editor.dispatchEvent(new Event('select'));if(!findBar.hidden)updateFind();},
    reset(){positions.clear();current='';},
    dispose(){layout.dispose();doc.removeEventListener('keydown',keys,true);editor.removeEventListener('keydown',protectReadOnly,true);for(const event of ['select','keyup','click','scroll'])editor.removeEventListener(event,savePosition);dialog.remove();findBar.remove();}
  };
}
