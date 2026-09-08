/** Stage additions detached, preserve retained instances, and dispose removals only after commit. */
import { reloadPanels, validateNewSubtree } from './structure.js';
export function prepareStructure(JB, edits, controls, origin) {
  const groups = [], fragments = [], names = new Map(), owners = new Map(), index = new Map();
  for(const control of controls){const source=origin(control);if(!source)continue;const key=JSON.stringify([source.file,source.offset]);if(!index.has(key))index.set(key,[]);index.get(key).push(control);}
  const find = (file, offset) => {
    const matches = index.get(JSON.stringify([file,offset]))??[];
    if (matches.length !== 1) throw new Error('Structural target is absent or repeated (template): ' + file + ':' + offset);
    return matches[0];
  };
  const captureOwner = (owner, key) => {
    let map = owners.get(owner); if (!map) owners.set(owner, map = new Map());
    if (!map.has(key)) map.set(key, Object.getOwnPropertyDescriptor(owner, key));
  };
  const disposeNew = () => { for (const f of fragments) { try { f.root.Dispose(); } catch {} } };
  try {
    for (const edit of edits ?? []) {
      const parent = find(edit.file, edit.offset);
      if (!reloadPanels.has(parent.type) || parent.TemplatedParent || parent._templateInstance || parent.Content != null) throw new Error('Structural target is not an untemplated panel');
      const expected = edit.before.map(offset => find(edit.file, offset)), current = [...parent.Children];
      if (expected.some((c, i) => current[i] !== c) || new Set(current).size !== current.length) throw new Error('Runtime child order changed; restart before editing structure');
      // Preserve C#-created trailing children. Interleaved application-owned children are not guessed.
      const extras = current.slice(expected.length), scope = parent._nameScope;
      let owner = parent;
      while (owner.parent && owner.parent._nameScope === scope) owner = owner.parent;
      if (!(scope instanceof Map)) throw new Error('Structural target has no namescope');
      if (!names.has(scope)) names.set(scope, new Map(scope));
      const next = edit.children.map(item => {
        if (item.offset != null) {
          const child = find(edit.file, item.offset);
          if (!expected.includes(child)) throw new Error('Reparenting existing controls requires restart');
          return child;
        }
        validateNewSubtree(item.node);
        const f = JB.prepareXamlFragment(item.node, parent, owner);
        fragments.push(f);
        for (const [key, value] of f.names) {
          captureOwner(owner, key);
          if (scope.has(key) || key in owner) throw new Error('New name collides with a live object: ' + key);
          // Reserve across all staged fragments in the same namescope, before touching the real map.
          if (fragments.some(other => other !== f && other.scope === scope && other.names.has(key))) throw new Error('Duplicate staged XAML name: ' + key);
        }
        return f.root;
      });
      if (new Set(next).size !== next.length) throw new Error('Duplicate structural child');
      const removed = expected.filter(c => !next.includes(c));
      for (const key of edit.removedNames) captureOwner(owner, key);
      groups.push({parent, appRoot:parent.root, scope, owner, current, next: [...next, ...extras], removed, removedNames: edit.removedNames});
    }
  } catch (error) { disposeNew(); throw error; }
  const focus = globalThis.document?.activeElement;
  let selection = null;
  try { if (focus && typeof focus.selectionStart === 'number') selection = [focus.selectionStart, focus.selectionEnd, focus.selectionDirection]; } catch {}
  const restoreFocus = () => { if (focus?.isConnected) { try { focus.focus({preventScroll: true}); if (selection) focus.setSelectionRange(...selection); } catch {} } };
  function rollback() {
    for (const [scope, saved] of names) { scope.clear(); for (const [key, value] of saved) scope.set(key, value); }
    for (const [owner, props] of owners) for (const [key, descriptor] of props) { if (descriptor) Object.defineProperty(owner, key, descriptor); else delete owner[key]; }
    for (const g of groups) {
      g.parent.Children.splice(0, g.parent.Children.length, ...g.current);
      for (const c of g.current) c.parent = g.parent;
      g.parent.invalidate('children');
    }
    disposeNew();
  }
  return {
    added: fragments.reduce((n, f) => n + f.created.length, 0), removed: groups.reduce((n, g) => n + g.removed.length, 0), groups: groups.length,
    apply() {
      for (const g of groups) {
        g.parent.Children.splice(0, g.parent.Children.length, ...g.next);
        for (const c of g.next) c.parent = g.parent;
        for (const c of g.removed) c.parent = null;
        for (const key of g.removedNames) { g.scope.delete(key); delete g.owner[key]; }
        g.parent.invalidate('children');
      }
      for (const f of fragments) f.attach();
    },
    rollback,
    settle: restoreFocus,
    finalize(warn) {
      for (const g of groups) {
        for (const c of g.removed) { const prune=value=>{g.appRoot._radios?.delete(value);for(const child of value.visualChildren??[])prune(child);};prune(c);try { c.Dispose(); } catch (error) { warn('Removed control cleanup: ' + error.message); } }
        try { g.parent.Children.changed('Reset'); } catch (error) { warn('Collection observer: ' + error.message); }
      }
      restoreFocus();
    }
  };
}
