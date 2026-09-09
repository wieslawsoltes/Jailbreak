import {element, action} from './studio-ui.js';
import {visibleLines, valueText} from './studio-model.js';

/** A debugger client: all values are runtime snapshots from the authenticated preview. */
export function createDebugWindows({document: doc, development, active, open, notify, activate}) {
  const el = (tag, text, attrs) => element(doc, tag, text, attrs), editor = doc.getElementById('editor');
  const panels = new Map(), frames = [];
  let paused = null, frame = null, currentPoint = null, scheduled = false, cachedText = null, lineCount = 1;
  const guard = fn => {try {fn();} catch (error) {notify(error.message);}};
  for (const name of ['stack', 'locals', 'watch', 'breakpoints']) {
    const panel = el('section', undefined, {id: 'studio-' + name, class: 'studio-debug-window', role: 'tabpanel', hidden: ''});
    panels.set(name, panel);
  }
  function empty(node, text) {node.replaceChildren(el('p', text, {class: 'studio-empty-state'}));}
  function table(headers) {
    const t = el('table', undefined, {class: 'studio-data-table'}), head = el('thead'), row = el('tr');
    for (const h of headers) row.append(el('th', h, {scope: 'col'}));head.append(row);t.append(head);
    const body = el('tbody');t.append(body);return {table: t, body};
  }
  function sourceJump(point) {
    if (!point?.file) return;
    open(point.file, point.offset ?? null, point.line, point.column);
  }
  function renderStack() {
    const host = panels.get('stack');
    if (!paused) return empty(host, 'Start a debug session and pause at a breakpoint to inspect the call stack.');
    const t = table(['', 'Call frame', 'Source', 'Line']);
    for (const f of frames) {
      const row = el('tr', undefined, {'aria-selected': String(f.id === frame?.id)});
      row.append(el('td', f.id === frame?.id ? '➜' : ''));
      const method = el('td'), b = action(doc, 'studio-frame-' + f.id, f.method, null, () => guard(() => {development.inspectFrame(f.id);sourceJump(f.point);}));
      method.append(b);row.append(method, el('td', f.point?.file ?? 'Runtime'), el('td', f.point?.line ?? '—'));t.body.append(row);
    }
    host.replaceChildren(t.table);
  }
  function appendValues(body, object, prefix = '', depth = 0) {
    if (depth > 4 || !object || typeof object !== 'object') return;
    for (const [name, value] of Object.entries(object).slice(0, 100)) {
      const row = el('tr'), label = el('td'), cell = el('td', undefined, {class: 'studio-value'}), type = el('td', value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);
      label.style.paddingLeft = (10 + depth * 16) + 'px';
      if (value && typeof value === 'object') {
        const b = action(doc, '', name, 'chevron', () => {
          const expanded = b.getAttribute('aria-expanded') === 'true';b.setAttribute('aria-expanded', String(!expanded));
          const marker = row.dataset.valuePath;
          if (expanded) for (const next of [...body.rows]) {if (next.dataset.ancestor?.split('|').includes(marker)) next.remove();}
          else {
            const fragment = doc.createElement('tbody');appendValues(fragment, value, marker, depth + 1);
            let after = row;for (const item of [...fragment.rows]) {item.dataset.ancestor = [row.dataset.ancestor, marker].filter(Boolean).join('|');after.after(item);after = item;}
          }
        });b.setAttribute('aria-expanded', 'false');label.append(b);
      } else label.textContent = name;
      row.dataset.valuePath = prefix ? prefix + '.' + name : name;
      cell.textContent = valueText(value);
      if (!depth && paused && frame?.editable?.includes(name)) {
        const edit = action(doc, '', 'Edit ' + name, null, () => editLocal(name, value));edit.className = 'studio-edit-value';cell.append(edit);
      }
      row.append(label, cell, type);body.append(row);
    }
  }
  function renderLocals() {
    const host = panels.get('locals');
    if (!frame) return empty(host, 'No frame selected. Local values appear here when execution is paused.');
    const t = table(['Name', 'Value', 'Type']);appendValues(t.body, frame.locals);host.replaceChildren(t.table);
  }
  const watchesInput = el('input', undefined, {id: 'studio-watch-input', placeholder: 'this.count, result, i', 'aria-label': 'Watch expressions'});
  const watchBody = el('div'), watchBar = el('div', undefined, {class: 'studio-window-toolbar'});
  watchBar.append(el('label', 'Property paths', {for: 'studio-watch-input'}), watchesInput,
    action(doc, 'studio-evaluate-watches', 'Evaluate', null, () => guard(() => development.watch(watchesInput.value.split(',').map(s => s.trim()).filter(Boolean)))));
  panels.get('watch').append(watchBar, watchBody);
  function renderWatches(values) {
    if (!values?.length) return empty(watchBody, 'Add a property path to inspect it. Calls, getters, and prototype access are not evaluated.');
    const t = table(['Expression', 'Value']);for (const item of values) {const row = el('tr');row.append(el('td', item.path), el('td', item.error ?? valueText(item.value), {class: item.error ? 'studio-error' : 'studio-value'}));t.body.append(row);}watchBody.replaceChildren(t.table);
  }
  function renderBreakpoints() {
    const host = panels.get('breakpoints'), points = development.options().breakpoints;
    if (!points.length) return empty(host, 'Click the editor gutter or press F9 to toggle a source breakpoint. Conditions and logpoints are available in the debugger inspector.');
    const t = table(['State', 'Source', 'Line', 'Condition', 'Action']);
    for (const point of points) {
      const bound = development.breakpointBound(point.file, point.line), row = el('tr');
      row.append(el('td', bound ? '● Bound' : '○ Unbound', {class: 'studio-breakpoint'}));
      const path = el('td');path.append(action(doc, '', point.file, null, () => sourceJump(point)));
      const last = el('td');last.append(action(doc, '', 'Remove breakpoint', 'close', () => guard(() => development.toggleBreakpoint(point.file, point.line))));
      row.append(path, el('td', point.line), el('td', [point.condition, point.log ? 'Logpoint' : '', point.hitCount ? 'Hits ≥ ' + point.hitCount : ''].filter(Boolean).join(' · ')), last);t.body.append(row);
    }
    host.replaceChildren(t.table, action(doc, 'studio-clear-breakpoints', 'Remove all breakpoints', 'close', () => development.clearBreakpoints()));
  }
  const localDialog = el('dialog', undefined, {id: 'studio-local-dialog', class: 'studio-dialog', 'aria-labelledby': 'studio-local-title'});
  const localTitle = el('h2', 'Edit local value', {id: 'studio-local-title'}), localInput = el('input', undefined, {id: 'studio-local-input', 'aria-label': 'New local value as JSON'}), localError = el('p', '', {role: 'alert'});
  let localName = '', focusBefore = null;
  localDialog.append(localTitle, el('p', 'Enter a JSON scalar of the existing type. The runtime validates its managed range.'), localInput, localError,
    action(doc, 'studio-local-cancel', 'Cancel', null, () => localDialog.close()),
    action(doc, 'studio-local-apply', 'Apply value', 'check', () => {try {development.setLocal(localName, JSON.parse(localInput.value));localDialog.close();} catch (error) {localError.textContent = error.message;}}));
  localDialog.addEventListener('close', () => focusBefore?.focus?.());doc.body.append(localDialog);
  function editLocal(name, value) {localName = name;focusBefore = doc.activeElement;localTitle.textContent = 'Edit local · ' + name;localInput.value = JSON.stringify(value);localError.textContent = '';localDialog.showModal();localInput.focus();localInput.select();}
  const gutter = el('div', undefined, {id: 'studio-breakpoint-gutter', 'aria-label': 'Source breakpoints'}), execution = el('div', undefined, {id: 'studio-execution-line', 'aria-hidden': 'true', hidden: ''});
  doc.getElementById('editor-wrap').append(gutter, execution);
  function renderGutter() {
    scheduled = false;const css = getComputedStyle(editor), h = parseFloat(css.lineHeight), padding = parseFloat(css.paddingTop) || 0;
    const file = active(), bps = development.options().breakpoints;
    if(cachedText !== editor.value){cachedText=editor.value;lineCount=cachedText.split('\n').length;}
    const count = lineCount;
    gutter.replaceChildren();
    for (const {line, top} of visibleLines(count, editor.scrollTop, editor.clientHeight, h, padding)) {
      const point = bps.find(b => b.file === file && b.line === line), b = el('button', '', {type: 'button', class: 'studio-gutter-point', 'aria-label': 'Toggle breakpoint at line ' + line, 'aria-pressed': String(!!point), title: point ? (development.breakpointBound(file, line) ? 'Bound breakpoint' : 'Unbound breakpoint') + ' · F9 to remove' : 'Toggle breakpoint · F9'});
      b.dataset.line = line;b.dataset.bound = String(!!point && development.breakpointBound(file, line));b.style.top = top + 'px';b.style.height = h + 'px';
      if (point) b.append(el('span', '●'));if (currentPoint?.file === file && currentPoint.line === line) {b.classList.add('executing');b.append(el('span', '➜'));}
      b.onclick = () => guard(() => development.toggleBreakpoint(file, line));gutter.append(b);
    }
    const top = padding + ((currentPoint?.line ?? 1) - 1) * h - editor.scrollTop;
    execution.hidden = !currentPoint || currentPoint.file !== file || top < -h || top > editor.clientHeight;
    execution.style.top = top + 'px';execution.style.height = h + 'px';
  }
  function refresh() {if (!scheduled) {scheduled = true;requestAnimationFrame(renderGutter);}}
  for (const event of ['scroll', 'input']) editor.addEventListener(event, refresh);
  const observer = new ResizeObserver(refresh);observer.observe(editor);
  function receive({event, payload}) {
    if (event === 'debug-paused') {paused = payload;frames.splice(0, frames.length, ...payload.frames);frame = frames[0] ?? null;currentPoint = payload.point;sourceJump(currentPoint);renderStack();renderLocals();activate('locals');if (development.options().watches.length) development.inspectFrame(frame.id);}
    else if (event === 'debug-frame') {frame = payload;currentPoint = payload.point;renderStack();renderLocals();renderWatches(payload.watches);}
    else if (event === 'debug-hit' && !paused) {frame = {locals: payload.locals, editable: []};renderLocals();renderWatches(payload.watches);}
    else if (event === 'watches') renderWatches(payload);
    else if (event === 'debug-resumed' || event === 'debug-completed') {if (paused?.taskId === payload.taskId) {paused = null;frame = null;currentPoint = null;renderStack();renderLocals();renderWatches([]);}}
    else if (['workspace-reset', 'session-starting', 'session-stopped'].includes(event)) {paused = null;frame = null;currentPoint = null;frames.length = 0;renderStack();renderLocals();renderWatches([]);}
    watchesInput.value = development.options().watches.join(', ');
    if(['settings','workspace-reset','session-starting','session-stopped','reloaded'].includes(event))renderBreakpoints();refresh();
  }
  const unsubscribe = development.subscribe(receive);
  renderStack();renderLocals();renderWatches([]);renderBreakpoints();refresh();
  return {panels, refresh, dispose() {unsubscribe();observer.disconnect();for (const event of ['scroll', 'input']) editor.removeEventListener(event, refresh);gutter.remove();execution.remove();localDialog.remove();}};
}
