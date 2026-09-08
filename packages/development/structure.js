/** Conservative source-tree reconciliation. Named siblings are keys, never array indices. */
import { controlDefinitions, eventNames } from '../avalonia-runtime/schema.js';
export const reloadPanels = new Set(['Panel', 'StackPanel', 'WrapPanel', 'Grid', 'Canvas', 'DockPanel']);
const scalar = v => v == null || ['string', 'boolean', 'number'].includes(typeof v);
export function semanticNode(node) {
  if (Array.isArray(node)) return node.map(semanticNode);
  if (!node || typeof node !== 'object') return node;
  return Object.fromEntries(Object.keys(node).filter(k => !['span', 'source'].includes(k)).sort().map(k => [k, semanticNode(node[k])]));
}
const signature = n => JSON.stringify(semanticNode(n));
const name = n => n.attributes?.Name;
/** Ambiguous anonymous deletions/replacements are restart-required, not guessed identities. */
export function matchChildren(before, after) {
  const used = new Set(), pairs = new Map();
  const bucket = (items, key) => { const groups=new Map();for(const item of items){const k=key(item);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(item);}return groups; };
  const match = (old, next) => { if(used.has(old))throw new Error('Duplicate sibling identity');used.add(old);pairs.set(next,old); };
  const named=bucket(before.filter(name),name), nextNamed=bucket(after.filter(name),name);
  for(const entries of [...named.values(),...nextNamed.values()])if(entries.length>1)throw new Error('Duplicate named sibling');
  for (const next of after.filter(name)) {
    const old = named.get(name(next))?.[0];
    if (old) { if (old.type !== next.type) throw new Error('Named control type changed: ' + name(next)); match(old, next); }
  }
  const aGroups=bucket(before.filter(n=>!name(n)),signature), bGroups=bucket(after.filter(n=>!name(n)),signature);
  for (const [key,a] of aGroups) {
    const b=bGroups.get(key)??[];
    if(a.length>1&&a.length!==b.length&&b.length)throw new Error('Ambiguous anonymous siblings; add unique x:Name values before editing');
    for(let i=0;i<Math.min(a.length,b.length);i++)match(a[i],b[i]);
  }
  const oldTypes=bucket(before.filter(n=>!name(n)&&!used.has(n)),n=>n.type), newTypes=bucket(after.filter(n=>!name(n)&&!pairs.has(n)),n=>n.type);
  for(const [type,a] of oldTypes){const b=newTypes.get(type)??[];
    if(a.length===1&&b.length===1)match(a[0],b[0]);
    else if(a.length&&b.length)throw new Error('Ambiguous anonymous edits for '+type+'; use unique x:Name values');
  }
  return {pairs, removed: before.filter(n => !used.has(n))};
}
/** New subtrees use the real XAML loader, limited to builtin literals/events this round. */
export function validateNewSubtree(node, count = {value: 0}) {
  if (++count.value > 1000) throw new Error('A structural patch exceeds 1,000 new controls');
  if (node.kind !== 'control' || !Object.hasOwn(controlDefinitions, node.type)) throw new Error('New subtrees require builtin controls');
  if (node.key != null) throw new Error('Resource instances require restart');
  for (const [key, value] of Object.entries(node.attributes ?? {})) {
    if (!scalar(value) || ['Theme', 'Template', 'ContentTemplate', 'ItemTemplate', 'DataContext'].includes(key)) throw new Error('New subtree property requires restart: ' + key);
    if (eventNames.includes(key) && typeof value !== 'string') throw new Error('Event handler name must be a string');
    if (key === 'Name' && (!/^[A-Za-z_][\w]*$/.test(value) || ['constructor','prototype','__proto__'].includes(value))) throw new Error('Unsafe new XAML name');
  }
  for (const child of node.children ?? []) validateNewSubtree(child, count);
}
export function namedNodes(node, result = new Set()) {
  if (name(node)) result.add(name(node));
  for (const child of node.children ?? []) namedNodes(child, result);
  return result;
}
/** Build panel edits alongside property patches using the caller's recursive visitor. */
export function reconcilePanel(a, b, file, visit, structures) {
  if (!reloadPanels.has(a.type) || a.children.some(n => n.kind !== 'control') || b.children.some(n => n.kind !== 'control')) return false;
  const {pairs, removed} = matchChildren(a.children, b.children);
  const changed = a.children.length !== b.children.length || b.children.some((n, i) => pairs.get(n) !== a.children[i]);
  for (const n of b.children) {
    const old = pairs.get(n);
    if (old) visit(old, n, file); else validateNewSubtree(n);
  }
  if (changed) structures.push({file, offset: a.span.start, before: a.children.map(n => n.span.start),
    children: b.children.map(n => pairs.has(n) ? {offset: pairs.get(n).span.start} : {node: n}),
    removedNames: [...new Set(removed.flatMap(n => [...namedNodes(n)]))]});
  return true;
}
