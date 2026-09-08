import { BinaryError } from '../managed-pe/reader.js';

const contains=(r,p)=>r.start<=p&&p<r.end;
const encloses=(a,b)=>a.start<=b.start&&b.end<=a.end;
const overlap=(a,b)=>a.start<b.end&&b.start<a.end;

/** Validate lexical nesting and every protected-region transition before JS emission. */
export function verifyExceptionRegions(method,instructions,{maxExceptionClauses=1024,maxRegionWork=4000000}={}) {
  const input=method.body.exceptionClauses??[],clauses=[],scopes=[],groups=new Map();
  const error=(message,offset=0)=>{throw new BinaryError(message,offset,'JB6104');};
  if(method.body.hasExceptionSections&&!input.length)error('Exception sections are missing decoded clauses');
  if(input.length>maxExceptionClauses)error('Exception clause budget exceeded');
  const end=instructions.at(-1).next,starts=new Set(instructions.map(i=>i.offset)),boundaries=new Set([...starts,end]);
  function range(offset,length,role,id,clause){
    if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||length<=0||!starts.has(offset)||!boundaries.has(offset+length))error('Exception range is not aligned to instruction boundaries',offset);
    return {start:offset,end:offset+length,role,id,clause};
  }
  for(const [id,c] of input.entries()){
    if(!['catch','finally','fault'].includes(c.kind))error('Exception filters are not yet supported',c.tryOffset);
    const t=range(c.tryOffset,c.tryLength,'try','t'+c.tryOffset+':'+c.tryLength,id);
    const h=range(c.handlerOffset,c.handlerLength,c.kind,'h'+id,id);
    if(overlap(t,h))error('A handler overlaps its own protected block',h.start);
    if(c.kind==='catch'&&(!c.catchType?.assembly||!c.catchType?.name))error('Catch clause needs a resolved class type',h.start);
    const key=t.id,group=groups.get(key)??{scope:t,handlers:[]};
    if(!groups.has(key)){groups.set(key,group);scopes.push(t);}
    if(group.handlers.some(x=>overlap(x,h)))error('Sibling exception handlers overlap',h.start);
    if(group.handlers.length&&(c.kind!=='catch'||group.handlers[0].role!=='catch'))error('A protected block needs catch handlers OR one finally/fault',t.start);
    group.handlers.push(h);scopes.push(h);clauses.push({...c,id});
  }
  for(let i=0;i<scopes.length;i++)for(let j=i+1;j<scopes.length;j++){
    const a=scopes[i],b=scopes[j];
    if(overlap(a,b)&&(!encloses(a,b)&&!encloses(b,a)||a.start===b.start&&a.end===b.end))error('Exception regions partially overlap or alias',b.start);
  }
  // All parts of an inner EH construct must share the same containing outer scope.
  for(const g of groups.values())for(const s of scopes){
    if(s===g.scope||g.handlers.includes(s))continue;
    const all=[g.scope,...g.handlers];
    if(all.some(x=>encloses(s,x))&&!all.every(x=>encloses(s,x)))error('Exception construct crosses its enclosing region',g.scope.start);
  }
  if(scopes.length*instructions.length>maxRegionWork)error('Exception-region analysis budget exceeded');
  const membership=new Map(instructions.map(i=>[i.offset,scopes.filter(s=>contains(s,i.offset)).sort((a,b)=>(b.end-b.start)-(a.end-a.start))]));
  if(membership.get(instructions[0].offset).some(s=>s.role!=='try'))error('Method entry cannot enter an exception handler');
  function checkEdge(from,to,kind,stack=[]){
    if(!starts.has(to))error('Control flow target is not an instruction boundary',from);
    const source=membership.get(from)??[],target=membership.get(to),removed=source.filter(s=>!target.includes(s)),added=target.filter(s=>!source.includes(s));
    if(kind==='leave'){
      if(added.length||removed.some(s=>['finally','fault'].includes(s.role)))error('leave cannot enter a protected region or exit finally/fault',from);
    }else if(kind==='fallthrough'){
      if(removed.length||added.some(s=>s.role!=='try'||s.start!==to)||added.length&&stack.length)error('Illegal fallthrough across exception-region boundary',from);
    }else if(added.length||removed.length)error('Branch crosses exception-region boundary; use leave',from);
  }
  function checkTerminal(offset,op,stack){
    const all=membership.get(offset)??[],handlers=all.filter(s=>s.role!=='try'),inner=handlers.at(-1);
    if(op==='ret'&&all.length)error('ret cannot exit a protected region; use leave',offset);
    if(op==='rethrow'&&inner?.role!=='catch')error('rethrow is only valid within a catch handler',offset);
    if(op==='endfinally'&&(!['finally','fault'].includes(inner?.role)||all.at(-1)!==inner))error('endfinally must terminate the innermost finally/fault handler',offset);
    if(['rethrow','endfinally'].includes(op)&&stack.length)error(op+' requires an empty evaluation stack',offset);
  }
  return {clauses,scopes,membership,checkEdge,checkTerminal};
}
