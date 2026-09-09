/** Serializable tool-window layout. Only registered IDs and finite geometry survive restore. */
export const DOCK_ZONES = Object.freeze(['left', 'right', 'right-lower', 'bottom', 'bottom-right']);
export const DOCK_MODES = Object.freeze(['docked', 'auto-hide', 'floating', 'hidden']);
const finite = (value, fallback, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
const own = (object, key) => object && Object.hasOwn(object, key) ? object[key] : undefined;
export function dockSizes(input = {}) {
  input = input && typeof input === 'object' ? input : {};
  return {
    left: finite(input.left, 242, 170, 600), right: finite(input.right, 302, 230, 650),
    bottom: finite(input.bottom, 215, 100, 600), rightRatio: finite(input.rightRatio, 48, 20, 80),
    bottomRatio: finite(input.bottomRatio, 52, 20, 80), split: finite(input.split, 52, 20, 80)
  };
}
export function floatRect(input = {}, viewport = {width: 1600, height: 900}) {
  input = input && typeof input === 'object' ? input : {};
  viewport = viewport && typeof viewport === 'object' ? viewport : {};
  const vw = finite(viewport.width, 1600, 240, 20000), vh = finite(viewport.height, 900, 180, 20000);
  const width = finite(input.width, 420, Math.min(230, vw), vw), height = finite(input.height, 320, Math.min(140, vh), vh);
  return {x: finite(input.x, 90, 0, Math.max(0, vw - width)), y: finite(input.y, 50, 0, Math.max(0, vh - height)), width, height};
}
export function restoreDockLayout(input, definitions, viewport) {
  const source = input?.version === 1 ? input : {}, windows = {};
  for (const definition of definitions) {
    const id = definition.id;
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(id) || Object.hasOwn(windows, id)) throw new TypeError('Invalid or duplicate tool-window ID');
    const saved = own(source.windows, id) ?? {};
    windows[id] = {
      zone: DOCK_ZONES.includes(saved.zone) ? saved.zone : definition.zone ?? 'right',
      mode: DOCK_MODES.includes(saved.mode) ? saved.mode : definition.mode ?? 'docked',
      order: finite(saved.order, definition.order ?? Object.keys(windows).length, 0, 1000),
      rect: floatRect(saved.rect, viewport)
    };
    if (!DOCK_ZONES.includes(windows[id].zone)) throw new TypeError('Invalid default docking zone');
  }
  const active = {};
  for (const zone of DOCK_ZONES) {
    const candidates = Object.keys(windows).filter(id => windows[id].zone === zone && windows[id].mode === 'docked').sort((a,b) => windows[a].order - windows[b].order);
    active[zone] = candidates.includes(own(source.active, zone)) ? source.active[zone] : candidates[0] ?? null;
  }
  return {version: 1, sizes: dockSizes(source.sizes), windows, active};
}
export class DockLayout {
  constructor(definitions, saved = {}, viewport) {
    if (!Array.isArray(definitions) || definitions.length > 64) throw new RangeError('Tool-window definition budget exceeded');
    this.definitions = definitions.map(d => ({...d}));
    this.state = restoreDockLayout(saved, this.definitions, viewport);
  }
  snapshot() {return structuredClone(this.state);}
  restore(saved, viewport) {this.state = restoreDockLayout(saved, this.definitions, viewport);return this.snapshot();}
  window(id) {if (!Object.hasOwn(this.state.windows, id)) throw new Error('Unknown tool window: ' + id);return this.state.windows[id];}
  activate(id) {
    const w = this.window(id);if (w.mode === 'hidden') w.mode = 'docked';
    if (w.mode === 'docked') this.state.active[w.zone] = id;
  }
  move(id, zone, before = null) {
    if (!DOCK_ZONES.includes(zone)) throw new TypeError('Invalid docking target');
    const w = this.window(id), old = w.zone;w.zone = zone;w.mode = 'docked';
    const ids = this.inZone(zone).filter(x => x !== id), index = ids.indexOf(before);
    ids.splice(index < 0 ? ids.length : index, 0, id);ids.forEach((key, i) => this.window(key).order = i);
    this.reconcile(old);this.state.active[zone] = id;
  }
  setMode(id, mode, viewport) {
    if (!DOCK_MODES.includes(mode)) throw new TypeError('Invalid tool-window mode');
    const w = this.window(id);w.mode = mode;w.rect = floatRect(w.rect, viewport);this.reconcile(w.zone);
    if (mode === 'docked') this.state.active[w.zone] = id;
  }
  resize(key, value) {if (!Object.hasOwn(this.state.sizes, key) || !Number.isFinite(value)) throw new TypeError('Invalid splitter size');this.state.sizes = dockSizes({...this.state.sizes, [key]: value});}
  floating(id, rect, viewport) {this.window(id).rect = floatRect(rect, viewport);}
  inZone(zone) {return Object.keys(this.state.windows).filter(id => this.window(id).zone === zone && this.window(id).mode === 'docked').sort((a,b) => this.window(a).order - this.window(b).order);}
  reconcile(zone) {const ids = this.inZone(zone);if (!ids.includes(this.state.active[zone])) this.state.active[zone] = ids[0] ?? null;}
  preset(name) {
    if (!['code', 'design', 'debug', 'binary'].includes(name)) throw new TypeError('Unknown workspace layout');
    this.restore({});
    for (const id of Object.keys(this.state.windows)) {
      const w = this.window(id);
      if (['outline','toolbox','properties','layout','stack','locals','watch','breakpoints','tasks','debug-settings','debug-console'].includes(id)) w.mode = 'hidden';
    }
    const place = (id, zone, mode = 'docked') => {if (!Object.hasOwn(this.state.windows, id)) return;this.move(id, zone);this.setMode(id, mode);};
    place('solution','right');place('properties','right-lower');place('problems','bottom');place('output','bottom');place('toolbox','left','auto-hide');
    if (name === 'design') {place('outline','right');place('properties','right-lower');place('layout','right-lower');place('toolbox','left');this.activate('outline');this.activate('properties');}
    if (name === 'debug') {place('stack','bottom');place('locals','bottom-right');place('watch','bottom-right');place('breakpoints','right-lower');place('tasks','bottom');place('debug-console','bottom');this.activate('stack');this.activate('locals');}
    if (name === 'binary') {place('properties','right-lower','hidden');place('solution','right','auto-hide');place('output','bottom');}
    if (name === 'code' || name === 'design') this.activate('problems');
    for (const zone of DOCK_ZONES) this.reconcile(zone);
  }
}
