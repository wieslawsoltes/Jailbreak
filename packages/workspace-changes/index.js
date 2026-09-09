/** Reusable, synchronous source-edit transactions. No filesystem, network or eval.
 * Offsets are original UTF-16 indices. The caller publishes the returned files
 * map once; errors leave both the supplied source map and history unchanged.
 */
const DEFAULTS = Object.freeze({maxFiles:2000,maxCharacters:16000000,maxMatches:10000});
const isWord = value => !!value && /[\p{L}\p{N}_]/u.test(value);
let serial = 0;

function budget(value, fallback, ceiling, label) {
  const n = value ?? fallback;
  if (!Number.isSafeInteger(n) || n < 1 || n > ceiling) throw new RangeError('Invalid '+label+' budget');
  return n;
}
function entries(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new TypeError('Expected a source files map');
  if (files instanceof Map) return [...files];
  const proto = Object.getPrototypeOf(files);
  if (proto !== null && proto !== Object.prototype) throw new TypeError('Source map must be plain data');
  return Object.keys(files).map(name => {
    const descriptor = Object.getOwnPropertyDescriptor(files,name);
    if (!Object.hasOwn(descriptor,'value')) throw new TypeError('Source map getters are not supported');
    return [name,descriptor.value];
  });
}
function fileName(name) {
  if (typeof name !== 'string' || !name || name.length > 2048 || name.includes('\0')) throw new TypeError('Invalid source name');
  return name;
}
function patterns(value, fallback) {
  const list = Array.isArray(value) ? value : String(value ?? fallback).split(/[,\n]/);
  const normalized = list.map(p => String(p).trim().replace(/\\/g,'/')).filter(Boolean);
  if (normalized.length > 16 || normalized.some(p => p.length > 256)) throw new RangeError('File-pattern budget exceeded');
  return normalized;
}
/** Glob wildcards use iterative matching rather than regex backtracking. */
export function matchesFilePattern(name, pattern) {
  name = String(name).replace(/\\/g,'/'); pattern = String(pattern).replace(/\\/g,'/');
  if (name.length > 2048 || pattern.length > 256) throw new RangeError('File-pattern budget exceeded');
  let previous = new Uint8Array(name.length+1); previous[0]=1;
  for (let p=0;p<pattern.length;p++) {
    let kind=pattern[p];
    if (kind==='*' && pattern[p+1]==='*') {
      while (pattern[p+1]==='*')p++;
      if (pattern[p+1]==='/') { kind='directory';p++; } else kind='recursive';
    }
    const next=new Uint8Array(name.length+1);
    if (kind==='*'||kind==='recursive') {
      next[0]=previous[0];
      for(let i=1;i<=name.length;i++)next[i]=previous[i] || (next[i-1] && (kind==='recursive'||name[i-1]!=='/')) ? 1:0;
    } else if (kind==='directory') {
      let reachable=0;
      for(let i=0;i<=name.length;i++){next[i]=previous[i] || (reachable&&i>0&&name[i-1]==='/') ? 1:0;reachable ||= previous[i];}
    } else {
      for(let i=1;i<=name.length;i++)next[i]=previous[i-1] && (kind==='?' ? name[i-1]!=='/' : name[i-1]===kind) ? 1:0;
    }
    previous=next;
  }
  return previous[name.length]===1;
}
function characterBefore(text,offset) {
  if(!offset)return '';
  const low=text.charCodeAt(offset-1);
  return text.slice(low>=0xdc00&&low<=0xdfff ? Math.max(0,offset-2) : offset-1,offset);
}
function immutableChange(file,before,after,matches=[]) {
  fileName(file);
  if(typeof before!=='string'||typeof after!=='string')throw new TypeError('Changes must contain original and replacement source text');
  return Object.freeze({file,before,after,matches:Object.freeze(matches.map(m=>Object.freeze({...m})))});
}
/** A general transaction constructor, also usable by rename and designer clients. */
export function createChangeSet(changes,{label='Workspace edit',maxCharacters=32000000}={}) {
  if(!Array.isArray(changes)||changes.length>DEFAULTS.maxFiles)throw new RangeError('Invalid change set');
  maxCharacters=budget(maxCharacters,32000000,64000000,'history size');
  const names=new Set();let characters=0;
  const normalized=[];
  for(const change of changes){
    if(names.has(change.file))throw new Error('Duplicate file in transaction: '+change.file);names.add(change.file);
    const value=immutableChange(change.file,change.before,change.after,change.matches);
    if(value.before===value.after)continue;
    characters+=value.before.length+value.after.length;
    if(characters>maxCharacters)throw new RangeError('Workspace change exceeds its source-size budget');
    normalized.push(value);
  }
  return Object.freeze({format:'jailbreak-workspace-change-v1',id:'change-'+(++serial),label:String(label).slice(0,200),characters,changes:Object.freeze(normalized)});
}
/** Literal workspace replace. A truncated scan is an error, never a partial edit. */
export function planWorkspaceReplace(files,options={}) {
  const {query,replacement='',caseSensitive=false,wholeWord=false,readOnly=[]}=options;
  if(typeof query!=='string'||!query||query.length>2000)throw new TypeError('Enter nonempty literal search text (at most 2000 characters)');
  if(typeof replacement!=='string'||replacement.length>1000000)throw new TypeError('Invalid replacement text');
  const maxFiles=budget(options.maxFiles,DEFAULTS.maxFiles,10000,'file count');
  const maxCharacters=budget(options.maxCharacters,DEFAULTS.maxCharacters,32000000,'source size');
  const maxMatches=budget(options.maxMatches,DEFAULTS.maxMatches,100000,'match count');
  const include=patterns(options.include,'**/*.cs,**/*.axaml,**/*.xaml'),exclude=patterns(options.exclude,'**/bin/**,**/obj/**');
  const protectedFiles=new Set(readOnly),all=entries(files);
  if(all.length>maxFiles)throw new RangeError('Workspace file-count budget exceeded');
  const expression=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),caseSensitive?'gu':'giu');
  let scannedCharacters=0,totalMatches=0;const changes=[];
  for(const [file,text] of all.sort(([a],[b])=>String(a).localeCompare(String(b)))){
    fileName(file);
    if(protectedFiles.has(file)||/\.binary\.json$/i.test(file)||!include.some(p=>matchesFilePattern(file,p))||exclude.some(p=>matchesFilePattern(file,p)))continue;
    if(typeof text!=='string')throw new TypeError('Source must be text: '+file);
    scannedCharacters+=text.length;if(scannedCharacters>maxCharacters)throw new RangeError('Workspace source-size budget exceeded');
    expression.lastIndex=0;const matches=[],parts=[];let match,last=0,scanned=0,line=1,lastNewline=-1;
    while((match=expression.exec(text))){
      const start=match.index,end=start+match[0].length;
      const afterCharacter=end<text.length?String.fromCodePoint(text.codePointAt(end)):'';
      if(wholeWord&&(isWord(characterBefore(text,start))||isWord(afterCharacter)))continue;
      if(++totalMatches>maxMatches)throw new RangeError('Too many replacements; refine the query or file filters');
      for(;scanned<start;scanned++)if(text[scanned]==='\n'){line++;lastNewline=scanned;}
      matches.push({start,end,line,column:start-lastNewline,text:match[0]});
      parts.push(text.slice(last,start),replacement);last=end;
    }
    if(matches.length){parts.push(text.slice(last));changes.push({file,before:text,after:parts.join(''),matches});}
  }
  const plan=createChangeSet(changes,{label:'Replace '+JSON.stringify(query),maxCharacters:maxCharacters*2});
  return Object.freeze({...plan,query,replacement,matchCount:totalMatches,scannedCharacters});
}
function selectedChanges(plan,selection) {
  if(plan?.format!=='jailbreak-workspace-change-v1'||!Array.isArray(plan.changes))throw new TypeError('Invalid workspace change');
  const chosen=selection===undefined?new Set(plan.changes.map(c=>c.file)):new Set(selection);
  const known=new Set(plan.changes.map(c=>c.file));
  for(const file of chosen)if(!known.has(file))throw new Error('Unknown selected source file: '+file);
  return plan.changes.filter(c=>chosen.has(c.file));
}
function applyChecked(files,changes,readOnly=[]) {
  const source=new Map(entries(files)),protectedFiles=new Set(readOnly),seen=new Set();
  for(const c of changes){
    fileName(c.file);
    if(seen.has(c.file)||typeof c.before!=='string'||typeof c.after!=='string')throw new TypeError('Invalid transaction member');seen.add(c.file);
    if(protectedFiles.has(c.file)||/\.binary\.json$/i.test(c.file))throw new Error('Source is read-only: '+c.file);
    if(!source.has(c.file)||source.get(c.file)!==c.before)throw new Error('Source changed after preview: '+c.file);
  }
  if(!changes.length)return files;
  for(const c of changes)source.set(c.file,c.after);
  return files instanceof Map?source:Object.fromEntries(source);
}
export function applyWorkspaceChange(files,plan,{selection,readOnly=[]}={}) {
  return applyChecked(files,selectedChanges(plan,selection),readOnly);
}
/** Bounded transactional history. Ordinary intervening edits must never be overwritten. */
export class WorkspaceChangeHistory {
  constructor({limit=30,maxCharacters=32000000}={}) {
    this.limit=budget(limit,30,500,'history count');this.maxCharacters=budget(maxCharacters,32000000,64000000,'history size');
    this.undoStack=[];this.redoStack=[];
  }
  apply(files,plan,options={}) {
    const changes=selectedChanges(plan,options.selection);
    const transaction=createChangeSet(changes,{label:plan.label,maxCharacters:this.maxCharacters});
    const next=applyChecked(files,transaction.changes,options.readOnly);
    if(next===files)return files;
    this.undoStack.push(transaction);this.redoStack=[];
    let total=this.undoStack.reduce((n,t)=>n+t.characters,0);
    while(this.undoStack.length>this.limit||total>this.maxCharacters)total-=this.undoStack.shift().characters;
    return next;
  }
  undo(files,options={}) {
    const transaction=this.undoStack.at(-1);if(!transaction)return files;
    const inverse=transaction.changes.map(c=>({file:c.file,before:c.after,after:c.before}));
    const next=applyChecked(files,inverse,options.readOnly);
    this.undoStack.pop();this.redoStack.push(transaction);return next;
  }
  redo(files,options={}) {
    const transaction=this.redoStack.at(-1);if(!transaction)return files;
    const next=applyChecked(files,transaction.changes,options.readOnly);
    this.redoStack.pop();this.undoStack.push(transaction);return next;
  }
  clear(){this.undoStack=[];this.redoStack=[];}
  get state(){return {undo:this.undoStack.length,redo:this.redoStack.length,nextUndo:this.undoStack.at(-1)?.label??null,nextRedo:this.redoStack.at(-1)?.label??null};}
}
