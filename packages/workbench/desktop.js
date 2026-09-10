import {createSymbolTools} from './symbols.js';
import {createDockWorkspace} from './docking.js';
import {element,action,icon} from './studio-ui.js';
import {searchWorkspace} from './navigation.js';
/** Desktop composition of real controller-owned views, rather than a panel of duplicate controls. */
export function createDesktopWorkbench({document:doc=globalThis.document,shell,development,debugContext,binaryClient,bottomPanels,showPerspective,active,documents,open,closeDocument,reopenDocument,workspace,notify,compile}) {
  const el=(tag,text,attrs)=>element(doc,tag,text,attrs),$=id=>doc.getElementById(id);
  const storageKey='jailbreak.docking.v1',layoutKey='jailbreak.named-layouts.v1';
  const sessionLayouts=new Map();let storageWarning=false;
  const read=key=>{try{return JSON.parse(localStorage.getItem(key))??sessionLayouts.get(key)??{};}catch{return sessionLayouts.get(key)??{};}};
  const write=(key,value)=>{sessionLayouts.set(key,structuredClone(value));try{localStorage.setItem(key,JSON.stringify(value));}catch{if(!storageWarning){storageWarning=true;notify('Browser storage is unavailable; layouts are kept for this session.');}}};
  const guard=fn=>{try{const r=fn();if(r?.catch)r.catch(e=>notify(e.message));return r;}catch(e){notify(e.message);}};
  const b=(id,label,glyph,fn)=>action(doc,id,label,glyph,()=>guard(fn));
  let current='split',disposed=false;const off=[];
  shell.layout.dispose();
  for(const id of ['help-panel','about-panel'])$(id)?.remove();
  doc.querySelector('.sidebar-note')?.remove();
  // Source and build metadata belong in the solution window, not a second permanent toolbar.
  const newFile=$('new-file');const solution=$('files-panel');solution.hidden=false;solution.classList.remove('side-panel');solution.querySelector('.section-label')?.remove();
  const solutionTools=el('div',undefined,{class:'desktop-window-toolbar'});
  solutionTools.append(newFile??b('new-file','Add source file','files',()=>shell.execute('File: New source file')),b('desktop-collapse','Collapse folders',null,()=>{for(const d of $('files').querySelectorAll('details'))d.open=false;}),b('desktop-active-file','Find active document',null,()=>{$('file-search').value='';$('file-search').dispatchEvent(new Event('input'));$('files').querySelector(`[data-file="${CSS.escape(active())}"]`)?.scrollIntoView({block:'nearest'});}));solution.prepend(solutionTools);
  const options=solution.querySelector('.project-options');if(options){const details=el('details',undefined,{class:'desktop-project-properties'});details.append(el('summary','Startup project & entry view'),options);solution.append(details);}
  const hierarchy=$('dev-hierarchy-panel'),properties=$('dev-property-panel'),legacy=$('development-panel');
  for(const n of [hierarchy,properties]){n.hidden=false;n.querySelector('h3')?.remove();}
  const toolbox=el('section',undefined,{id:'desktop-toolbox'}),toolFilter=el('input',undefined,{id:'desktop-toolbox-filter',type:'search',placeholder:'Search controls','aria-label':'Search toolbox controls'});
  const existingToolbox=doc.querySelector('.studio-toolbox'),tiles=doc.querySelector('.studio-toolbox-tiles');if(tiles)toolbox.append(toolFilter,tiles);existingToolbox?.remove();
  toolFilter.oninput=()=>{for(const button of tiles?.children??[])button.hidden=!button.textContent.toLowerCase().includes(toolFilter.value.toLowerCase());};
  const palette=$('dev-toolbox');if(palette){const footer=el('div',undefined,{class:'desktop-toolbox-footer'});footer.append(palette);toolbox.append(footer);}
  const layout=el('section',undefined,{id:'desktop-layout-tools'});for(const id of ['design-layout-inspector','grid-designer'])if($(id))layout.append($(id));
  const settings=el('section',undefined,{id:'desktop-debug-settings'}),header=legacy.querySelector('header');header.querySelector('h2')?.remove();settings.append(header);header.classList.add('desktop-settings-grid');
  const oldClose=[...header.querySelectorAll('button')].find(n=>n.textContent==='Close');if(oldClose)oldClose.onclick=()=>dock.setMode('debug-settings','hidden');
  const consolePanel=el('section',undefined,{id:'desktop-debug-console'}),consoleBar=el('div',undefined,{class:'desktop-window-toolbar'});
  consoleBar.append(b('desktop-clear-debug','Clear','close',()=>$('dev-debug-output').textContent=''),el('span','Runtime events'));consolePanel.append(consoleBar,$('dev-debug-output'));
  // Breakpoint entry is integrated directly into the actual Breakpoints table window.
  const breakpoints=bottomPanels.get('breakpoints');
  const breakpointEditor=el('details',undefined,{id:'desktop-breakpoint-editor',class:'desktop-breakpoint-editor'});breakpointEditor.append(el('summary','Add conditional breakpoint / logpoint'));
  for(const node of [$('dev-breakpoint-line')?.parentElement,$('dev-logpoint')?.parentElement])if(node)breakpointEditor.append(node);
  const breakpointHost=el('section',undefined,{id:'desktop-breakpoints'});breakpointHost.append(breakpointEditor,breakpoints);
  const tasks=el('section',undefined,{id:'desktop-debug-tasks'});
  function renderTasks(){const states=debugContext.tasks?.()??[];const table=el('table',undefined,{class:'studio-data-table'});const head=el('thead'),tr=el('tr');for(const name of ['Task','State','Method','Location'])tr.append(el('th',name));head.append(tr);table.append(head);const body=el('tbody');for(const state of states){const r=el('tr'),select=el('td');select.append(b('','Task '+state.taskId,null,()=>debugContext.selectTask(state.taskId)));r.append(select,el('td','Paused'),el('td',state.frames?.[0]?.method??''),el('td',(state.point?.file??'')+':'+(state.point?.line??'')));body.append(r);}table.append(body);tasks.replaceChildren(table);if(!states.length)tasks.append(el('p','No suspended tasks.',{class:'studio-empty-state'}));}
  renderTasks();off.push(debugContext.subscribe(({event})=>{if(event.startsWith('debug-')||event.startsWith('session-'))renderTasks();}));
  const search=el('section',undefined,{id:'desktop-search'}),searchInput=el('input',undefined,{id:'desktop-search-input',type:'search',placeholder:'Find in solution','aria-label':'Find in solution'}),searchResults=el('div',undefined,{class:'desktop-search-results'}),searchInfo=el('div','',{class:'desktop-search-count',role:'status'});
  const searchBar=el('div',undefined,{class:'desktop-window-toolbar'});searchBar.append(searchInput,b('desktop-search-run','Find all','search',()=>runSearch()));search.append(searchBar,searchInfo,searchResults);
  const runSearch=()=>guard(()=>{const result=searchWorkspace(documents(),searchInput.value);searchInfo.textContent=result.rows.length+(result.truncated?'+':'')+' results';searchResults.replaceChildren();for(const row of result.rows){const button=b('',row.file+':'+row.line,null,()=>{showPerspective('source',{enable:false});open(row.file,row.start);const e=$('editor');e.setSelectionRange(row.start,row.end);});button.append(el('code',row.detail??row.label));searchResults.append(button);}});
  searchInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runSearch();}});
  const errorHost=el('section',undefined,{id:'desktop-errors'});const errorToolbar=$('studio-error-toolbar');errorToolbar.hidden=false;errorHost.append(errorToolbar,bottomPanels.get('problems'));
  const outputHost=el('section',undefined,{id:'desktop-output'}),outputBar=el('div',undefined,{class:'desktop-window-toolbar'});outputBar.append(el('span','Build & application'),b('desktop-clear-output','Clear output','close',()=>{$('output').textContent='';}));outputHost.append(outputBar,bottomPanels.get('output'));
  for(const panel of bottomPanels.values())panel.hidden=false;
  const symbols=createSymbolTools({document:doc,workspace,development,compile,notify,activateSource:()=>showPerspective('split',{enable:false})});off.push(()=>symbols.dispose());
  const definitions=[
    {id:'symbols',title:'Symbols & Sources',icon:'box',node:symbols.node,zone:'bottom',mode:'hidden'},
    {id:'solution',title:'Solution Explorer',icon:'files',node:solution,zone:'right'},
    {id:'outline',title:'Document Outline',icon:'design',node:hierarchy,zone:'right'},
    {id:'properties',title:'Properties',icon:'settings',node:properties,zone:'right-lower'},
    {id:'layout',title:'Layout',icon:'design',node:layout,zone:'right-lower'},
    {id:'toolbox',title:'Toolbox',icon:'box',node:toolbox,zone:'left',mode:'auto-hide'},
    {id:'search',title:'Find Results',icon:'search',node:search,zone:'bottom',mode:'hidden'},
    {id:'problems',title:'Error List',node:errorHost,zone:'bottom'},
    {id:'output',title:'Output',node:outputHost,zone:'bottom'},
    {id:'stack',title:'Call Stack',node:bottomPanels.get('stack'),zone:'bottom',mode:'hidden'},
    {id:'locals',title:'Locals',node:bottomPanels.get('locals'),zone:'bottom-right',mode:'hidden'},
    {id:'watch',title:'Watch',node:bottomPanels.get('watch'),zone:'bottom-right',mode:'hidden'},
    {id:'breakpoints',title:'Breakpoints',node:breakpointHost,zone:'right-lower',mode:'hidden'},
    {id:'tasks',title:'Tasks',node:tasks,zone:'bottom',mode:'hidden'},
    {id:'debug-console',title:'Debug Console',node:consolePanel,zone:'bottom',mode:'hidden'},
    {id:'debug-settings',title:'Debug Settings',node:settings,zone:'left',mode:'hidden'}
  ];
  // Preserve controller-owned fields without presenting the retired mega-inspector.
  const controllers=el('div',undefined,{hidden:'',id:'desktop-controller-storage'});doc.body.append(controllers);controllers.append(legacy);controllers.append(doc.querySelector('.bottom-tabs'));legacy.classList.add('desktop-retired-panel');
  const live=$('live')?.closest('label'),summary=$('build-summary'),status=$('dev-status');
  const dock=createDockWorkspace({document:doc,definitions,read:()=>read(storageKey),write:value=>write(storageKey,value),notify});
  const buildStatus=el('div',undefined,{class:'desktop-build-status'});if(summary)buildStatus.append(summary);if(status)buildStatus.append(status);if(live)buildStatus.append(live);doc.querySelector('.statusbar').before(buildStatus);
  // New composition has one menu bar, one command toolbar, and document-local perspectives.
  const toolbar=doc.querySelector('.studio-toolbar'),commands=doc.querySelector('.commandbar');
  const workspaceControl=doc.querySelector('.workspace-control');toolbar.prepend(workspaceControl);
  for(const id of ['open-folder','open-files','save-workspace','development-tools','build-profile','wb-view-mode','folder-input','file-input'])if($(id))controllers.append($(id));
  commands?.remove();
  const documentModes=el('div',undefined,{class:'desktop-document-modes'});documentModes.append($('studio-perspectives'));$('desktop-documents').append(documentModes);
  const optionsButton=$('studio-inspector');optionsButton.title='Properties · F4';optionsButton.querySelector('span').textContent='Properties';
  const layoutSelect=el('select',undefined,{id:'desktop-layout-preset','aria-label':'Window layout'});for(const [value,label]of [['custom','Window layout'],['code','Code layout'],['design','Design layout'],['debug','Debug layout'],['binary','Binary layout']])layoutSelect.append(el('option',label,{value}));toolbar.append(layoutSelect);
  layoutSelect.onchange=()=>{if(layoutSelect.value!=='custom'){dock.preset(layoutSelect.value);layoutSelect.value='custom';}};
  const context=el('span','Source workspace',{id:'desktop-command-context'});toolbar.append(context);
  // Control buttons keep their original event handlers. Only their presentation is compacted.
  const compact=(node,label,glyph)=>{if(!node)return;node.setAttribute('aria-label',label);node.title=label;node.classList.add('desktop-icon-button');node.replaceChildren(icon(doc,glyph));};
  for(const [id,label,glyph]of [['dev-refresh','Refresh document outline','restart'],['dev-pick','Select on canvas','design'],['dev-insert','Insert selected control','box'],['dev-duplicate','Duplicate control','files'],['dev-delete','Delete control','close'],['dev-move-up','Move control up','out'],['dev-move-down','Move control down','into'],['dev-design-undo','Undo design','undo'],['dev-design-redo','Redo design','redo']])compact($(id),label,glyph);
  for(const row of hierarchy.querySelectorAll('.dev-row'))row.classList.add('desktop-window-toolbar');
  const propSort=el('button','A–Z',{id:'desktop-sort-properties',type:'button',title:'Sort properties alphabetically'});$('studio-property-search')?.after(propSort);propSort.onclick=()=>{const list=$('dev-properties');[...list.children].sort((a,b)=>a.textContent.localeCompare(b.textContent)).forEach(n=>list.append(n));};
  const moveGroup=el('details',undefined,{class:'desktop-outline-move'});moveGroup.append(el('summary','Move to container'));if($('dev-destination')?.parentElement)moveGroup.append($('dev-destination').parentElement);hierarchy.append(moveGroup);
  const advanced=el('details',undefined,{class:'desktop-property-editor',open:''});advanced.append(el('summary','Set property or binding'));const propRow=$('dev-property-name')?.parentElement;if(propRow){advanced.append(propRow);properties.append(advanced);}
  const toolboxButton=b('desktop-show-toolbox','Toolbox','box',()=>dock.activate('toolbox'));documentModes.prepend(toolboxButton);
  // Layout management uses validated model snapshots. Source buffers are never part of a layout.
  const layoutDialog=el('dialog',undefined,{id:'desktop-layout-dialog',class:'studio-dialog','aria-label':'Window layouts'}),layoutName=el('input',undefined,{id:'desktop-layout-name',placeholder:'Layout name','aria-label':'Layout name'}),savedList=el('div'),layoutMessage=el('p','',{role:'status'});
  function namedLayouts(){const value=read(layoutKey);return Object.fromEntries(Object.entries(value).filter(([k,v])=>k.length<=64&&v?.version===1).slice(0,12));}
  function refreshLayouts(){savedList.replaceChildren();for(const [name,value]of Object.entries(namedLayouts())){const row=el('div',undefined,{class:'desktop-window-toolbar'});row.append(b('',name,null,()=>{dock.restore(value);layoutDialog.close();}),b('','Delete layout '+name,'close',()=>{const saved=namedLayouts();delete saved[name];write(layoutKey,saved);refreshLayouts();}));savedList.append(row);}}
  layoutDialog.append(el('h2','Window layouts'),layoutName,b('desktop-save-layout','Save current layout',null,()=>{const name=layoutName.value.trim();if(!name||name.length>64)throw new Error('Use a layout name between 1 and 64 characters');const saved=namedLayouts();if(!Object.hasOwn(saved,name)&&Object.keys(saved).length>=12)throw new Error('Remove a saved layout before adding another');Object.defineProperty(saved,name,{value:dock.snapshot(),enumerable:true,writable:true,configurable:true});write(layoutKey,saved);layoutMessage.textContent='Layout saved';refreshLayouts();}),savedList,layoutMessage,b('desktop-close-layouts','Close',null,()=>layoutDialog.close()));doc.body.append(layoutDialog);
  const manageLayouts=()=>{refreshLayouts();layoutDialog.showModal();layoutName.focus();};
  const target=id=>()=>{const control=$(id);if(!control||control.disabled)throw new Error('Command is not available in this session');control.click();};
  const menuCommands=[...definitions.map(def=>({label:'View: '+def.title,menuGroup:'Tool Windows',run:()=>dock.activate(def.id),shortcut:def.id==='properties'?'F4':def.id==='solution'?'Ctrl+Alt+L':''})),
    {label:'File: Save all',shortcut:'Ctrl+Shift+S',run:()=>workspace.save()},
    {label:'File: Close active document',shortcut:'Ctrl+W',run:()=>closeDocument(active())},
    {label:'File: Reopen closed document',shortcut:'Ctrl+Shift+T',run:reopenDocument},
    {label:'View: Command Palette',shortcut:'Ctrl+Shift+P',run:()=>shell.show('commands')},
    {label:'View: Find in solution',shortcut:'Ctrl+Shift+F',run:()=>{dock.activate('search');searchInput.focus();}},
    {label:'Project: Startup project and build profile',run:target('build-profile')},
    {label:'Project: Add source file',run:target('new-file')},
    {label:'Build: Build solution',shortcut:'Ctrl+Shift+B',run:()=>current==='binary'?binaryClient.run('compile'):compile()},
    {label:'Debug: Start / Continue',shortcut:'F5',run:target('run')},
    ...[['into','Step Into','F11'],['over','Step Over','F10'],['out','Step Out','Shift+F11'],['stop','Stop Debugging','Shift+F5'],['restart','Restart','Ctrl+Shift+F5'],['break','Break All','']].map(([key,label,shortcut])=>({label:'Debug: '+label,shortcut,enabled:()=>!$('studio-debug-'+key).disabled,run:target('studio-debug-'+key)})),
    {label:'Debug: Cancel current invocation',enabled:()=>!!debugContext.state().paused,run:()=>debugContext.command('cancel')},
    {label:'Debug: Restore symbols and original sources',run:()=>dock.activate('symbols')},
    {label:'Debug: Exception Settings',run:()=>dock.activate('debug-settings')},
    {label:'Tools: Debug settings',run:()=>dock.activate('debug-settings')},
    {label:'Tools: Light theme',checked:()=>doc.body.classList.contains('light'),run:()=>{if(!doc.body.classList.contains('light'))$('theme').click();}},
    {label:'Tools: Dark theme',checked:()=>!doc.body.classList.contains('light'),run:()=>{if(doc.body.classList.contains('light'))$('theme').click();}},
    {label:'Window: Reset window layout',run:()=>dock.reset()},
    ...['code','design','debug','binary'].map(name=>({label:'Window: '+name[0].toUpperCase()+name.slice(1)+' layout',menuGroup:'Apply Layout',run:()=>dock.preset(name)})),
    {label:'Window: Save or restore named layout',run:manageLayouts},
    {label:'Window: Hide all tool windows',run:()=>{for(const def of definitions)dock.model.setMode(def.id,'hidden');dock.render();write(storageKey,dock.snapshot());}},
    {label:'Window: Close all documents',run:()=>{for(const button of [...$('tabs').querySelectorAll('.studio-close-tab')])button.click();}},
    {label:'Help: Keyboard shortcuts',run:()=>shell.show('commands')}
  ];
  off.push(shell.registerCommands(menuCommands));
  // Retire the old fake layout command, keeping its existing command-palette spelling functional.
  const oldReset=shell.commands().find(c=>c.label==='View: Reset tool-window layout');if(oldReset)oldReset.run=()=>dock.reset();
  const aliases={'Debug: Continue':'Debug: Start / Continue','Debug: Step over':'Debug: Step Over','Debug: Step into':'Debug: Step Into','Debug: Step out':'Debug: Step Out','Debug: Stop application':'Debug: Stop Debugging'};
  for(const [oldLabel,label]of Object.entries(aliases)){const c=shell.commands().find(c=>c.label===oldLabel),next=shell.commands().find(c=>c.label===label);if(c&&next){c.run=next.run;c.enabled=next.enabled;c.hidden=true;}}
  const exportCommand=shell.commands().find(c=>c.label==='File: Export compiled application');if(exportCommand){exportCommand.run=()=>current==='binary'?binaryClient.run('export'):$('export').click();exportCommand.enabled=()=>current==='binary'?binaryClient.state().compiled:!$('export').disabled;}
  $('development-tools').onclick=()=>dock.activate('debug-settings');
  const settingsChanged=development.subscribe(({event})=>{if(event==='tools-request')dock.activate('properties');});off.push(settingsChanged);
  const handleKeys=e=>{if(e.defaultPrevented||e.isComposing||doc.querySelector('dialog[open]'))return;let fn=null;if(e.key==='F4'&&!e.altKey)fn=()=>dock.activate('properties',{focus:true});else if((e.ctrlKey||e.metaKey)&&e.altKey&&e.key.toLowerCase()==='l')fn=()=>dock.activate('solution',{focus:true});else if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='b')fn=()=>current==='binary'?binaryClient.run('compile'):compile();if(fn){e.preventDefault();guard(fn);}};doc.addEventListener('keydown',handleKeys,true);off.push(()=>doc.removeEventListener('keydown',handleKeys,true));
  return {dock,showProperties(){dock.activate('properties');},
    showTools(key){if(key==='debug'){for(const id of ['stack','locals','breakpoints'])dock.activate(id);}else if(key==='design'){dock.activate('outline');dock.activate('properties');}else {dock.activate('solution');}},
    context(name){current=name;context.textContent=name==='binary'?'Binary workspace':'Source workspace';doc.body.dataset.desktopContext=name==='binary'?'binary':'source';if(name==='design'){dock.activate('outline');dock.activate('properties');}if(name==='binary'){for(const id of ['outline','properties','layout'])if(dock.model.window(id).mode==='docked')dock.setMode(id,'hidden');dock.activate('output');}else if(name==='source'||name==='split'){if(dock.model.window('solution').mode==='hidden')dock.activate('solution');}},
    activateBottom(id){dock.activate(id);},
    paused(){dock.activate('stack');dock.activate('locals');},
    dispose(){if(disposed)return;disposed=true;off.forEach(fn=>fn?.());layoutDialog.remove();dock.dispose();}
  };
}
