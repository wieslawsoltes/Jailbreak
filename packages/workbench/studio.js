import {installEditorHistory} from './editor-history.js';
import {createLanguageTools} from './language-tools.js';
import {createDesignCanvas} from './design-canvas.js';
import {element, action, icon, tabKeys} from './studio-ui.js';
import {studioPreferences, diagnosticMatches, indentSource} from './studio-model.js';
import {createDebugWindows} from './studio-debug.js';
import {lineOffset} from './navigation.js';

/** The Studio client composes the existing compiler, development session and editor.
 * It never evaluates application code or takes ownership of preview runtime objects. */
export function createStudio({document: doc = globalThis.document, development, active, open, closeDocument, reopenDocument, createDocument, shell, notify, persist, compile, documents}) {
  const $ = id => doc.getElementById(id), el = (tag, text, attrs) => element(doc, tag, text, attrs);
  const guard = fn => {try {return fn();} catch (error) {notify(error.message);}};
  let initializing = true;
  const persistState = () => {if (!initializing) persist();};
  let prefs = studioPreferences(), ready = false, waitingPick = false, binary = null, diagnosticItems = [], disposed = false;
  const off = [];
  const sourceHistory=installEditorHistory({document:doc,active,documents,notify});
  const sourceTools=createLanguageTools({document:doc,documents,active,open,notify,history:sourceHistory});
  doc.body.classList.add('vs-studio');
  doc.title = 'Jailbreak Studio — C# · XAML · JavaScript';
  doc.querySelector('.brand strong').textContent = 'Jailbreak';
  doc.querySelector('.brand').append(el('span', 'STUDIO', {class: 'studio-wordmark'}));
  $('wb-command').firstChild.textContent = 'Search commands and files';
  doc.querySelector('#files-panel .section-label').firstChild.textContent = 'SOLUTION EXPLORER ';
  doc.querySelector('.sidebar-note').replaceChildren(el('span', 'LOCAL WORKSPACE', {class: 'studio-eyebrow'}), el('p', 'Your source. Your browser.'), el('span', 'C# / XAML → JavaScript. Sources and builds stay on this device.'));
  const toolbar = el('div', undefined, {class: 'studio-toolbar', role: 'toolbar', 'aria-label': 'Build, debug and designer commands'});
  doc.querySelector('.commandbar').after(toolbar);
  const mode = el('select', undefined, {id: 'studio-session-mode', 'aria-label': 'Execution configuration'});
  for (const [value, label] of [['release', 'Release'], ['design', 'Design session'], ['cooperative', 'Debug · In-IDE'], ['native', 'Debug · DevTools']]) mode.append(el('option', label, {value}));
  mode.onchange = () => guard(() => {if (mode.value === 'cooperative' || mode.value === 'native') showTools('debug');development.mode(mode.value);});
  const modeWrap = el('label', undefined, {class: 'studio-configuration'});modeWrap.append(mode, el('span', 'Browser · JavaScript', {class: 'studio-target'}));
  const run = $('run');run.replaceChildren(icon(doc, 'play'), el('span', 'Start'), el('kbd', 'F5'));run.title = 'Build and run · F5';run.setAttribute('aria-label', 'Start application');
  run.onclick = () => guard(() => development.state().paused ? development.command('continue') : compile());
  const debugActions = el('div', undefined, {class: 'studio-debug-actions'});
  const buttons = {};
  for (const [command, title, glyph, key] of [['restart', 'Restart application', 'restart', 'Ctrl+Shift+F5'], ['stop', 'Stop application', 'stop', 'Shift+F5'], ['break', 'Pause at next statement', 'pause', ''], ['over', 'Step over', 'over', 'F10'], ['into', 'Step into', 'into', 'F11'], ['out', 'Step out', 'out', 'Shift+F11']]) {
    const b = action(doc, 'studio-debug-' + command, title, glyph, () => guard(() => {
      if (command === 'restart') compile(true);
      else if (command === 'stop') $('stop').click();
      else if (command === 'break') $('dev-break-next').click();
      else development.command(command);
    }), key);b.className = 'studio-icon-action';buttons[command] = b;debugActions.append(b);
  }
  const hot = action(doc, 'studio-hot-reload', 'Hot reload', 'flame', () => development.hotReload(!development.options().hotReload));hot.setAttribute('aria-pressed', 'false');
  const perspective = el('div', undefined, {id: 'studio-perspectives', class: 'studio-perspectives', role: 'tablist', 'aria-label': 'Workspace view'});
  const views = new Map();
  for (const [name, title, glyph] of [['source', 'Code', 'code'], ['split', 'Split', 'split'], ['design', 'Designer', 'design'], ['binary', 'Binary Studio', 'box']]) {
    const b = action(doc, 'studio-view-' + name, title, glyph, () => setPerspective(name));b.setAttribute('role', 'tab');b.setAttribute('aria-controls', name === 'binary' ? 'studio-binary-host' : 'studio-workspace-host');views.set(name, b);perspective.append(b);
  }
  off.push(tabKeys(perspective, b => b.click()));
  const inspectorButton = action(doc, 'studio-inspector', 'Inspector', 'settings', () => {development.show();showTools(prefs.tools);});
  toolbar.append(run, modeWrap, debugActions, el('span', '', {class: 'studio-toolbar-divider'}), hot, perspective, inspectorButton);
  const buildProfile = $('build-profile');if (buildProfile) doc.querySelector('.commands').prepend(buildProfile);
  const oldBinaryLink = [...doc.querySelectorAll('.commands a')].find(a => a.getAttribute('href') === './binary/');if (oldBinaryLink) oldBinaryLink.remove();
  const fontSize = el('select', undefined, {id:'studio-font-size','aria-label':'Editor font size'});
  for(const size of [11,12,13,14,16,18,20])fontSize.append(el('option',size+' px',{value:size}));
  fontSize.value='13';$('source-size').before(fontSize);
  fontSize.onchange=()=>{prefs.fontSize=Number(fontSize.value);doc.body.style.setProperty('--studio-font-size',prefs.fontSize+'px');persistState();debug.refresh();};
  const fileDialog=el('dialog',undefined,{id:'studio-new-file-dialog',class:'studio-dialog','aria-labelledby':'studio-new-file-title'});
  const fileName=el('input',undefined,{id:'studio-new-file-name',placeholder:'Views/NewView.axaml','aria-label':'New source file path'}),fileError=el('p','',{role:'alert'});
  fileDialog.append(el('h2','Add a source file',{id:'studio-new-file-title'}),el('p','Create a C# class, XAML view, or project file. Use a relative path to create folders.'),fileName,fileError,
    action(doc,'studio-new-file-cancel','Cancel',null,()=>fileDialog.close()),
    action(doc,'studio-new-file-create','Create file','files',()=>{try{createDocument(fileName.value.trim());fileDialog.close();}catch(error){fileError.textContent=error.message;}}));
  doc.body.append(fileDialog);$('new-file').onclick=()=>{fileName.value='';fileError.textContent='';fileDialog.showModal();fileName.focus();};
  fileName.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('studio-new-file-create').click();}});
  const designer=createDesignCanvas({document:doc,development,notify,persist:persistState});
  const workArea = doc.querySelector('.work-area');workArea.id = 'studio-workspace-host';workArea.setAttribute('role', 'tabpanel');
  const binaryHost = el('section', undefined, {id: 'studio-binary-host', role: 'tabpanel', 'aria-label': 'Binary compilation workspace', hidden: ''});
  workArea.after(binaryHost);
  function showBinary() {
    if (binary) return;
    const caption = el('div', undefined, {class: 'studio-binary-title'});
    caption.append(icon(doc, 'box'), el('strong', 'Binary Studio'), el('span', 'MSIL · Managed DLL · NuGet'), el('span', 'Separate compilation session', {class: 'studio-muted'}));
    binary = el('iframe', undefined, {id: 'studio-binary-frame', title: 'Integrated Binary Studio', sandbox: 'allow-scripts allow-downloads', referrerpolicy: 'no-referrer'});
    if (globalThis.__JailbreakAssets?.binaryHtml) binary.srcdoc = globalThis.__JailbreakAssets.binaryHtml;
    else binary.src = new URL('./binary/', doc.baseURI).href;
    binaryHost.append(caption, binary);
  }
  function setPerspective(name, {save = true, enable = true} = {}) {
    prefs.perspective = studioPreferences({perspective: name}).perspective;
    const isBinary = prefs.perspective === 'binary';
    designer.setActive(prefs.perspective==='design');
    workArea.hidden = isBinary;binaryHost.hidden = !isBinary;
    if (isBinary) showBinary();
    doc.body.classList.remove('preview-expanded');
    doc.body.dataset.view = name === 'design' ? 'preview' : name === 'source' ? 'source' : 'split';
    $('wb-view-mode').value = doc.body.dataset.view;
    for (const [key, b] of views) {b.setAttribute('aria-selected', String(key === prefs.perspective));b.tabIndex = key === prefs.perspective ? 0 : -1;}
    workArea.setAttribute('aria-labelledby', 'studio-view-' + (isBinary ? 'split' : prefs.perspective));
    binaryHost.setAttribute('aria-labelledby', 'studio-view-binary');
    if (name === 'design') {
      showTools('design');
      if (enable && !development.options().enabled) {waitingPick = true;development.mode('design');}
      else if (enable && ready) development.pick(true);
    } else {waitingPick=false;development.pick(false);}
    if (save) persistState();
  }
  $('wb-view-mode').onchange = () => setPerspective($('wb-view-mode').value === 'preview' ? 'design' : $('wb-view-mode').value, {enable: false});
  const dock = $('development-panel'), groups = {hierarchy: $('dev-hierarchy-panel'), properties: $('dev-property-panel'), debug: $('dev-debugger-panel')};
  const toolTabs = el('div', undefined, {id: 'studio-tool-tabs', role: 'tablist', 'aria-label': 'Inspector tools'});
  const toolButtons = new Map();
  for (const [key, label] of [['all', 'All tools'], ['design', 'Designer'], ['debug', 'Debugger']]) {
    const b = action(doc, 'studio-tools-' + key, label, null, () => showTools(key));b.setAttribute('role', 'tab');b.setAttribute('aria-controls', 'studio-inspector-content');toolButtons.set(key, b);toolTabs.append(b);
  }
  const columns = dock.querySelector('.dev-columns');columns.id = 'studio-inspector-content';columns.setAttribute('role', 'tabpanel');dock.prepend(toolTabs);
  off.push(tabKeys(toolTabs, b => b.click()));
  function showTools(key, show = true) {
    prefs.tools = studioPreferences({tools: key}).tools;
    if (show) development.show();
    groups.hierarchy.hidden = groups.properties.hidden = prefs.tools === 'debug';groups.debug.hidden = prefs.tools === 'design';
    for (const [name, b] of toolButtons) {b.setAttribute('aria-selected', String(name === prefs.tools));b.tabIndex = name === prefs.tools ? 0 : -1;}
    columns.setAttribute('aria-labelledby', 'studio-tools-' + prefs.tools);dock.dataset.tool=prefs.tools;persistState();
  }
  const originalDevelop = $('development-tools').onclick;
  $('development-tools').onclick = () => {showTools('all', false);originalDevelop();};
  const debugNav = action(doc, 'studio-debug-window', 'Debugger', 'bug', () => showTools('debug'));
  const designNav = action(doc, 'studio-design-window', 'Visual designer', 'design', () => setPerspective('design'));
  const binaryNav = action(doc, 'studio-binary-window', 'Binary compiler', 'box', () => setPerspective('binary'));
  for (const b of [debugNav, designNav, binaryNav]) {b.classList.add('studio-activity');doc.querySelector('.activity').insertBefore(b, doc.querySelector('.activity-bottom'));}
  const propertySearch = el('input', undefined, {id: 'studio-property-search', placeholder: 'Search properties', 'aria-label': 'Search designer properties'});
  groups.properties.querySelector('h3').after(propertySearch);
  function filterProperties() {const query = propertySearch.value.toLowerCase();for (const row of $('dev-properties').children) row.hidden = row.classList.contains('dev-property') && !row.firstElementChild?.textContent.toLowerCase().includes(query);}
  propertySearch.oninput = filterProperties;
  const propertyObserver = new MutationObserver(filterProperties);propertyObserver.observe($('dev-properties'), {childList: true});
  const toolbox = el('details', undefined, {class: 'studio-toolbox'});toolbox.append(el('summary', 'Toolbox · insert into selection'));
  const tiles = el('div', undefined, {class: 'studio-toolbox-tiles'});
  for (const option of $('dev-toolbox').options) {
    const b = action(doc, '', option.value, ['Grid', 'StackPanel', 'Canvas', 'Border'].includes(option.value) ? 'design' : 'box', () => {
      $('dev-toolbox').value = option.value;const insert = [...groups.hierarchy.querySelectorAll('button')].find(b => b.textContent === 'Insert');insert?.click();
    });tiles.append(b);
  }
  toolbox.append(tiles);groups.hierarchy.append(toolbox);
  const bottom = doc.querySelector('.bottom-panel'), bottomTabs = bottom.querySelector('.bottom-tabs');
  bottomTabs.setAttribute('role', 'tablist');bottomTabs.setAttribute('aria-label', 'Output and debugger windows');
  $('problems-tab').firstChild.textContent = 'Error List ';$('output-tab').textContent = 'Output';
  const bottomButtons = new Map([['problems', $('problems-tab')], ['output', $('output-tab')]]);
  const bottomPanels = new Map([['problems', $('problems')], ['output', $('output')]]);
  const debug = createDebugWindows({document: doc, development, active,
    open: (file, offset, line = 1, column = 1) => {if (Object.hasOwn(documents(), file)) {if (prefs.perspective === 'binary') setPerspective('split');else if (prefs.perspective === 'design') setPerspective('split', {enable: false});open(file, offset ?? lineOffset(documents()[file], line, column));}},
    notify, activate: name => activateBottom(name)});
  for (const [key, panel] of debug.panels) {
    const b = action(doc, 'studio-tab-' + key, {stack: 'Call Stack', locals: 'Locals', watch: 'Watch', breakpoints: 'Breakpoints'}[key], null, () => activateBottom(key));
    bottomTabs.insertBefore(b, $('build-summary'));bottomButtons.set(key, b);bottomPanels.set(key, panel);bottom.append(panel);
  }
  const errorBar = el('div', undefined, {id: 'studio-error-toolbar', class: 'studio-window-toolbar'});
  const errorFilter = el('input', undefined, {id: 'studio-diagnostic-search', placeholder: 'Search messages, codes or files', 'aria-label': 'Search diagnostics'}), severity = el('select', undefined, {id: 'studio-diagnostic-severity', 'aria-label': 'Diagnostic severity'});
  for (const value of ['all', 'error', 'warning']) severity.append(el('option', value === 'all' ? 'All severities' : value[0].toUpperCase() + value.slice(1) + 's', {value}));
  const count = el('span', '0 messages', {id: 'studio-diagnostic-count'});errorBar.append(severity, errorFilter, count);$('problems').before(errorBar);
  errorFilter.oninput = severity.onchange = () => filterDiagnostics();
  function filterDiagnostics() {
    const rows = $('problems').querySelectorAll('.diagnostic-row');let visible = 0;
    rows.forEach((row, i) => {row.hidden = !diagnosticMatches(diagnosticItems[i] ?? {message: row.textContent}, {query: errorFilter.value, severity: severity.value});if (!row.hidden) visible++;});count.textContent = `${visible} of ${rows.length} messages`;
  }
  function activateBottom(name, save = true) {
    prefs.bottom = studioPreferences({bottom: name}).bottom;
    for (const [key, p] of bottomPanels) {p.hidden = key !== prefs.bottom;p.setAttribute('role', 'tabpanel');p.setAttribute('aria-labelledby', bottomButtons.get(key).id);}
    for (const [key, b] of bottomButtons) {b.setAttribute('role', 'tab');b.classList.toggle('active', key === prefs.bottom);b.setAttribute('aria-selected', String(key === prefs.bottom));b.setAttribute('aria-controls', bottomPanels.get(key).id);b.tabIndex = key === prefs.bottom ? 0 : -1;}
    errorBar.hidden = prefs.bottom !== 'problems';if (save) persistState();
  }
  for (const [name, b] of bottomButtons) b.onclick = () => activateBottom(name);
  off.push(tabKeys(bottomTabs, b => b.click()));
  const liveBadge = el('span', 'Ready', {id: 'studio-session-badge'}), secure = el('span', 'LOCAL · ISOLATED', {class: 'studio-secure-label'});
  doc.querySelector('.statusbar').append(liveBadge, secure);
  function syncSession() {
    const state = development.state(), s = state.settings;
    mode.value = !s.enabled ? 'release' : s.cooperativeDebug ? 'cooperative' : s.nativeBreaks ? 'native' : 'design';
    hot.setAttribute('aria-pressed', String(s.hotReload));hot.disabled = !s.enabled;
    for (const k of ['over', 'into', 'out']) buttons[k].disabled = !state.paused;
    buttons.break.disabled = !s.enabled || !ready || !!state.paused;
    run.querySelector('span').textContent = state.paused ? 'Continue' : 'Start';run.setAttribute('aria-label', state.paused ? 'Continue application' : 'Start application');
    doc.body.classList.toggle('studio-debug-paused', !!state.paused);
    debug.refresh();
  }
  const unsubscribe = development.subscribe(message => {
    if (message.event === 'debug-paused') {liveBadge.textContent = 'Paused';liveBadge.dataset.state = 'paused';development.show();}
    else if (message.event === 'debug-resumed' || message.event === 'debug-completed') {liveBadge.textContent = ready ? 'Running' : 'Constructing';liveBadge.dataset.state = ready ? 'running' : 'building';}
    else if (message.event === 'session-stopped' || message.event === 'workspace-reset') {ready = false;liveBadge.textContent = 'Stopped';liveBadge.dataset.state = '';}
    else if (message.event === 'reloaded') {liveBadge.textContent = 'Reloaded · r' + message.payload.revision;liveBadge.dataset.state = 'running';}
    else if (message.event === 'tool-error' || message.event === 'reload-error') notify(message.payload.message);
    syncSession();
  });
  function keys(e) {
    if (e.defaultPrevented || e.isComposing || doc.querySelector('dialog[open]')) return;
    if (e.key === 'F9') {e.preventDefault();guard(() => development.toggleBreakpoint(active(), editorLine()));}
    else if (e.key === 'F5') {e.preventDefault();e.stopImmediatePropagation();guard(() => e.shiftKey ? ((e.ctrlKey || e.metaKey) ? compile(true) : $('stop').click()) : run.click());}
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {e.preventDefault();guard(() => closeDocument(active()));}
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {e.preventDefault();guard(reopenDocument);}
  }
  const editor = $('editor'), editorLine = () => editor.value.slice(0, editor.selectionStart).split('\n').length;
  doc.addEventListener('keydown', keys, true);
  const indent = e => {
    if (e.key !== 'Tab' || editor.readOnly || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();e.stopImmediatePropagation();const result = indentSource(editor.value, editor.selectionStart, editor.selectionEnd, e.shiftKey);
    editor.setRangeText(result.text, 0, editor.value.length, 'preserve');editor.setSelectionRange(result.start, result.end);editor.dispatchEvent(new Event('input'));editor.dispatchEvent(new Event('select'));
  };
  editor.addEventListener('keydown', indent, true);
  off.push(tabKeys($('tabs'), b => b.click()));
  if(shell?.registerCommands)off.push(shell.registerCommands([
    {label:'View: Visual designer',run:()=>setPerspective('design')},
    {label:'View: Binary Studio (IL / DLL / NuGet)',run:()=>setPerspective('binary')},
    {label:'View: Call Stack window',run:()=>activateBottom('stack')},
    {label:'View: Locals window',run:()=>activateBottom('locals')},
    {label:'View: Watch window',run:()=>activateBottom('watch')},
    {label:'View: Breakpoints window',run:()=>activateBottom('breakpoints')},
    {label:'Debug: Toggle source breakpoint',shortcut:'F9',run:()=>development.toggleBreakpoint(active(),editorLine())},
    {label:'Debug: Start in-IDE debug session',run:()=>{showTools('debug');development.mode('cooperative');}},
    {label:'Build: Toggle state-preserving hot reload',run:()=>development.hotReload(!development.options().hotReload)}
  ]));
  showTools('all', false);setPerspective('split', {save: false, enable: false});activateBottom('problems', false);syncSession();initializing = false;
  return {
    options: () => ({...prefs,design:designer.options()}),
    restore(value) {sourceHistory.reset();sourceTools.reset();prefs = studioPreferences(value);designer.restore(value?.design);showTools(prefs.tools, false);setPerspective(prefs.perspective, {save: false, enable: false});activateBottom(prefs.bottom, false);propertySearch.value = '';fontSize.value=String(prefs.fontSize);doc.body.style.setProperty('--studio-font-size',prefs.fontSize+'px');debug.refresh();},
    render() {sourceTools.changed();debug.refresh();},
    diagnostics(items) {diagnosticItems = items;filterDiagnostics();if (items.some(d => d.severity === 'error')) activateBottom('problems');},
    status(kind) {
      if (kind === 'building') {liveBadge.textContent = 'Building…';liveBadge.dataset.state = 'building';}
      else if (kind === 'ready') {ready = true;designer.ready();liveBadge.textContent = 'Running';liveBadge.dataset.state = 'running';if (waitingPick) {waitingPick = false;development.pick(true);}}
      else if (kind === 'failed') {liveBadge.textContent = 'Build failed';liveBadge.dataset.state = 'error';}
      else if (kind === 'error') {liveBadge.textContent = 'Runtime error';liveBadge.dataset.state = 'error';}
      syncSession();
    },
    dispose() {if (disposed) return;disposed = true;sourceHistory.dispose();sourceTools.dispose();designer.dispose();unsubscribe();debug.dispose();propertyObserver.disconnect();off.forEach(fn => fn());doc.removeEventListener('keydown', keys, true);editor.removeEventListener('keydown', indent, true);binary?.remove();fileDialog.remove();toolbar.remove();}
  };
}
