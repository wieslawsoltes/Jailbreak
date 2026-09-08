/** Logical ownership slots supported by live tree edits; templates are separate scopes. */
export const panelTypes = new Set(['Panel','StackPanel','WrapPanel','Grid','Canvas','DockPanel']);
export const contentTypes = new Set(['Border','ContentControl','UserControl','Window','ScrollViewer','Button','ToggleButton','TabItem','Expander','GroupBox','ContentPage']);
export function childSlot(node) {
  if (!node || node.kind !== 'control') return null;
  const kind = panelTypes.has(node.type) ? 'children' : contentTypes.has(node.type) ? 'content' : null;
  if (!kind) return null;
  const property = kind === 'children' ? ['Children'] : ['Content','Child'];
  const wrappers = node.children.filter(n => n.kind === 'property' && property.includes(n.property));
  const direct = node.children.filter(n => n.kind !== 'property');
  if (wrappers.length > 1 || wrappers.length && direct.length) return null;
  const children = wrappers.length ? wrappers[0].children : direct;
  if (children.some(n => n.kind !== 'control') || kind === 'content' && children.length > 1) return null;
  if (Object.hasOwn(node.attributes, 'Content') || Object.hasOwn(node.attributes, 'Child')) return null;
  return {kind, children, rest:node.children.filter(n => n.kind === 'property' && !property.includes(n.property))};
}
export function logicalIndex(root) {
  const names = new Map(), nodes = new Set(), parents = new Map();
  function visit(node, parent = null) {
    if (nodes.has(node)) throw new Error('Cyclic source tree');
    nodes.add(node); parents.set(node,parent);
    const name = node.attributes?.Name;
    if (name) { if (names.has(name)) throw new Error('Duplicate logical name: '+name); names.set(name,node); }
    for (const child of childSlot(node)?.children ?? []) visit(child,node);
  }
  visit(root); return {names,nodes,parents};
}
