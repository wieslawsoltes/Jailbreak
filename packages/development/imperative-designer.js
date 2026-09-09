import {construction, editInitializer, literalValue, encodeLiteral, propertyKind, validateProperty} from './csharp-designer.js';
import {eventNames} from '../avalonia-runtime/schema.js';

/** Conservative, flow-ordered provenance for a local construction in one direct block.
 * It follows local aliases, kills reassigned aliases, and never executes source.
 * Branches, captures and unknown escapes block edits rather than guessing a write.
 */
export function analyzeConstruction(text, file, offset) {
  if (typeof text !== 'string' || text.length > 1000000) throw new Error('Designer analysis source budget exceeded');
  const {node, parsed} = construction(text, file, offset), parents = new Map();
  function visit(value, parent) {
    if (!value || typeof value !== 'object') return;
    parents.set(value, parent);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(item => visit(item, value));
      else if (child && typeof child === 'object') visit(child, value);
    }
  }
  visit(parsed.ast, null);
  const writes = new Map((node.members ?? []).map(member => [member.name, {
    name:member.name, value:member.value, kind:'initializer', writes:1
  }]));
  const variable = parents.get(node), statement = parents.get(variable), block = parents.get(statement);
  const localInit = variable?.init === node && statement?.kind === 'local';
  const localAssignment = variable?.kind === 'assignment' && variable.right === node && variable.op === '=' && variable.left.kind === 'identifier' &&
    statement?.kind === 'expressionStatement' && block?.kind === 'block' && block.statements.some(s => s.kind === 'local' && s.start < statement.start && s.variables.some(v => v.name === variable.left.name));
  // Inline construction has no local alias to analyze. Preserve the initializer ABI.
  if ((!localInit && !localAssignment) || block?.kind !== 'block') {
    return {node, writes, aliases:[], analyzed:false, reason:null};
  }
  if (localInit && statement.variables.length !== 1) return {node,writes,aliases:[],analyzed:true,reason:'Multiple declarators require explicit source editing'};
  const member=parents.get(block);
  if (!['constructor','method'].includes(member?.kind) || member.body !== block) return {node,writes,aliases:[],analyzed:true,reason:'Construction in nested control flow or a callback requires explicit source editing'};
  const aliases = new Set([localInit ? variable.name : variable.left.name]), reasons = new Set();
  const isAlias = value => value?.kind === 'identifier' && aliases.has(value.name);
  function uses(value) {
    if (!value || typeof value !== 'object') return false;
    if (isAlias(value)) return true;
    return Object.values(value).some(child => Array.isArray(child) ? child.some(uses) : child && typeof child === 'object' && uses(child));
  }
  for (const current of block.statements.slice(block.statements.indexOf(statement) + 1)) {
    if (current.kind === 'local') {
      for (const local of current.variables) {
        const alias = isAlias(local.init);
        if (!alias && uses(local.init)) reasons.add('A local expression reads or captures the selected object');
        aliases.delete(local.name);
        if (alias) aliases.add(local.name);
      }
      continue;
    }
    const expr = current.kind === 'expressionStatement' ? current.expression : null;
    if (expr?.kind === 'assignment') {
      const left = expr.left;
      if (left.kind === 'identifier') {
        const alias = isAlias(expr.right);
        // A direct assignment can only introduce an alias to an existing local.
        const locals = block.statements.filter(s => s.kind === 'local' && s.start < current.start).flatMap(s => s.variables.map(v => v.name));
        if (alias && !locals.includes(left.name)) reasons.add('The selected object escapes into a field or property');
        if (!alias && uses(expr.right)) reasons.add('Unknown assignment reads the selected object');
        aliases.delete(left.name);
        if (alias && locals.includes(left.name)) aliases.add(left.name);
        continue;
      }
      if (left.kind === 'member' && isAlias(left.object)) {
        if (uses(expr.right)) reasons.add('Self-dependent or captured assignment needs explicit source editing');
        if (eventNames.includes(left.name) && ['+=','-='].includes(expr.op) && expr.right.kind === 'identifier') continue;
        const previous = writes.get(left.name);
        writes.set(left.name, {name:left.name, value:expr.right, kind:'assignment', statement:current, op:expr.op, writes:(previous?.writes ?? 0)+1});
        continue;
      }
    }
    // A single reference passed to a Children.Add call is an ownership operation,
    // not an arbitrary helper invocation. Namespace/type validation stays in build.
    if (expr?.kind === 'call' && expr.callee.kind === 'member' && expr.callee.name === 'Add' &&
        ['member','identifier'].includes(expr.callee.object.kind) && expr.callee.object.name === 'Children' &&
        !uses(expr.callee) && expr.args.length === 1 && isAlias(expr.args[0])) continue;
    if (current.kind === 'return' && isAlias(current.expression)) continue;
    if (uses(current)) reasons.add('Control flow, a callback, or an unknown call can change the selected object');
  }
  return {node,writes,aliases:[...aliases],analyzed:true,reason:[...reasons].join('; ') || null};
}

export function inspectConstruction(text,file,offset) {
  const analysis = analyzeConstruction(text,file,offset);
  return {type:analysis.node.type?.name,language:'csharp',provenance:analysis.analyzed?'local-flow':'initializer',reason:analysis.reason,
    properties:Object.fromEntries([...analysis.writes].map(([name,write])=>{
      const literal=literalValue(write.value);
      return [name,{value:text.slice(write.value.start,write.value.end),literal:literal.value,
        editable:!analysis.reason && literal.editable && (write.kind!=='assignment'||write.op==='='),
        origin:write.kind,offset:write.value.start,writes:write.writes,reason:analysis.reason ?? (!literal.editable?'Expression is protected':write.op&&write.op!=='='?'Compound assignment is protected':null)}];
    }))};
}

export function editConstruction(text,file,offset,property,value) {
  const analysis=analyzeConstruction(text,file,offset);
  validateProperty(analysis.node,property);
  if (analysis.reason) throw new Error(analysis.reason);
  const write=analysis.writes.get(property);
  if (!write || write.kind==='initializer') return editInitializer(text,file,offset,property,value);
  const old=literalValue(write.value);
  if (write.op!=='='||!old.editable) throw new Error('Expression-based or compound assignments are protected');
  // Removing the last assignment can expose an older value: explicit source editing only.
  if (value==null) throw new Error('Removing an imperative write may expose earlier state; edit source explicitly');
  const kind=propertyKind(property) ?? typeof old.value;
  const replacement=encodeLiteral(value,kind),after=text.slice(0,write.value.start)+replacement+text.slice(write.value.end);
  const updated=analyzeConstruction(after,file,offset);
  if (updated.reason) throw new Error('Edit changed construction provenance');
  return {file,before:text,after,selection:offset};
}
