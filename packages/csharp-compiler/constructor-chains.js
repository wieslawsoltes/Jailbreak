/** Compile-time constructor graph for the current arity-resolved C# profile.
 * The plan evaluates forwarding arguments once, then runs bodies inside-out.
 * No runtime constructor replay or temporary application object is involved.
 */
export function constructorGraph(constructors, report) {
  const entries = constructors.map((m, index) => ({m, index,
    min:m.parameters.filter(p=>!p.value&&!p.rest).length,
    max:m.parameters.some(p=>p.rest)?Infinity:m.parameters.length, target:null}));
  for (const e of entries) {
    if (e.m.mods.includes('static')) report('JB2262','Static constructors require static-initializer lowering',e.m);
    for (const other of entries) if (other.index<e.index && Math.max(e.min,other.min)<=Math.min(e.max,other.max))
      report('JB2263','Constructor overloads with overlapping argument counts require type-based resolution',e.m);
    if (e.m.initializer?.target==='this') {
      const n=e.m.initializer.args.length, matches=entries.filter(c=>n>=c.min&&n<=c.max);
      if (matches.length!==1) report('JB2264','Delegating constructor has no unique matching target',e.m);
      else e.target=matches[0].index;
    }
  }
  for (const entry of entries) {
    const seen=new Set();let current=entry;
    while(current) {
      if(seen.has(current.index)){report('JB2265','Constructor delegation cycle',entry.m);break;}
      seen.add(current.index);
      if(seen.size>128){report('JB2266','Constructor chain exceeds the supported depth',entry.m);break;}
      current=current.target===null?null:entries[current.target];
    }
  }
  return entries;
}
/** Prevent references to an unallocated instance in constructor initializer arguments. */
export function checkInitializer(m, instanceNames, report) {
  const parameters=new Set(m.parameters.map(p=>p.name));
  function visit(node) {
    if(!node||typeof node!=='object')return;
    if(node.kind==='identifier' && (['this','base'].includes(node.name) || instanceNames.has(node.name)&&!parameters.has(node.name)))
      report('JB2267','Constructor initializer cannot access the instance being constructed',node);
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
  }
  for(const arg of m.initializer?.args??[])visit(arg);
}
