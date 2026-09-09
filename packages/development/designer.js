import {inspectConstruction,editConstruction} from './imperative-designer.js';
import {construction,editInitializer,literalValue} from './csharp-designer.js';
import {parseMarkup} from '../xaml-compiler/index.js';
import {liveValue} from './live-values.js';
import {panelTypes,contentTypes} from './tree-slots.js';
import { parseXml } from '../compiler-core/xml.js';
import { SourceFile } from '../compiler-core/index.js';
import { controlDefinitions, hasProperty, eventNames } from '../avalonia-runtime/schema.js';

export const palette=['StackPanel','Grid','Canvas','Border','TextBlock','Button','TextBox','CheckBox','Slider','ProgressBar','ComboBox','ListBox'];
const xmlEscape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/\r/g,'&#13;').replace(/\n/g,'&#10;');
const localName=tag=>tag.split(':').at(-1);
function xml(text,file){const parsed=parseXml(text,file);if(parsed.diagnostics.length)throw new Error(parsed.diagnostics[0].message);return parsed;}
function flatten(node,parent=null,result=[]){if(node?.kind==='element'){result.push({node,parent});for(const c of node.children)flatten(c,node,result);}return result;}
function selected(text,file,offset){const {root}=xml(text,file),entry=flatten(root).find(e=>e.node.span.start===offset);if(!entry)throw new Error('Stale designer selection; refresh the visual tree');return {...entry,root};}
export function inspectSource(text,file,offset){
  if(file.endsWith('.cs')){
    return inspectConstruction(text,file,offset);
  }
  const {node}=selected(text,file,offset);return {type:localName(node.tag),language:'xaml',properties:Object.fromEntries(Object.entries(node.attributes).filter(([k])=>!k.startsWith('xmlns')).map(([k,v])=>[k,{value:v,editable:!v.startsWith('{')||v.startsWith('{}'),binding:v.startsWith('{')&&!v.startsWith('{}')}]))};
}
/** Return a full preimage transaction; the editor must reject edits to a changed document. */
export function editProperty(text,file,offset,property,value){return writeProperty(text,file,offset,property,value,false);}
function writeProperty(text,file,offset,property,value,expression){
  if(!/^[A-Za-z_][\w.:]*$/.test(property)||['__proto__','constructor','prototype'].includes(property)||property.startsWith('xmlns'))throw new Error('Invalid designer property');
  if(file.endsWith('.cs'))return editConstruction(text,file,offset,property,value);
  const {node}=selected(text,file,offset),type=localName(node.tag);
  if(!Object.hasOwn(controlDefinitions,type)||!hasProperty(type,property)||eventNames.includes(property)||property==='Name')throw new Error('Property is not a supported designer value');
  const old=node.attributes[property];if(!expression&&typeof old==='string'&&old.startsWith('{')&&!old.startsWith('{}'))throw new Error('Binding/resource expressions are protected; edit the expression in source');
  if(!expression&&typeof value==='string'&&value.startsWith('{')&&!value.startsWith('{}'))throw new Error('Designer property input accepts literals only');
  const span=node.attributeSpans[property];let next;
  if(span)next=text.slice(0,span.start)+(value==null?'':property+'="'+xmlEscape(value)+'"')+text.slice(span.end);
  else{const start=node.span.start+1+node.tag.length;next=text.slice(0,start)+(value==null?'':' '+property+'="'+xmlEscape(value)+'"')+text.slice(start);}
  xml(next,file);return {file,before:text,after:next,selection:offset};
}
export function insertControl(text,file,offset,type){
  if(!palette.includes(type))throw new Error('Control is not in the supported palette');
  const {node}=selected(text,file,offset),parentType=localName(node.tag);
  const panel=['StackPanel','Grid','Canvas','WrapPanel','DockPanel','Panel'].includes(parentType),single=['Border','UserControl','Window','ContentControl'].includes(parentType);
  if(!panel&&!single)throw new Error('Select a panel or empty content host');
  if(single&&node.children.some(c=>c.kind==='element'&&!localName(c.tag).includes('.')||c.kind==='text')||single&&Object.hasOwn(node.attributes,'Content'))throw new Error('This content host already has content');
  const eol=text.includes('\r\n')?'\r\n':'\n',lineStart=text.lastIndexOf('\n',node.span.start)+1,indent=/^\s*/.exec(text.slice(lineStart,node.span.start))[0],childIndent=indent+'  ';
  const prefix=node.tag.includes(':')?node.tag.split(':')[0]+':':'';
  const content=type==='TextBlock'?' Text="New text"':type==='Button'?' Content="New button"':type==='TextBox'?' Text=""':type==='CheckBox'?' Content="New option"':'';
  const used=new Set(flatten(xml(text,file).root).map(e=>e.node.attributes.Name??e.node.attributes['x:Name']));let n=1;while(used.has(type+n))n++;
  const position=parentType==='Canvas'?' Canvas.Left="24" Canvas.Top="24" Width="140" Height="44"':'';
  const child=`<${prefix}${type} Name="${type+n}"${content}${position} />`;let next,selection;
  if(text.slice(node.span.end-2,node.span.end)==='/>'){
    const start=node.span.end-2,added='>'+eol+childIndent+child+eol+indent+`</${node.tag}>`;
    selection=start+1+eol.length+childIndent.length;next=text.slice(0,start)+added+text.slice(node.span.end);
  }else{
    const end=text.lastIndexOf('</',node.span.end-1),trailing=/\s*$/.exec(text.slice(node.span.start,end))[0],start=end-trailing.length;
    selection=start+eol.length+childIndent.length;next=text.slice(0,start)+eol+childIndent+child+eol+indent+text.slice(end);
  }
  xml(next,file);return {file,before:text,after:next,selection};
}
export function removeControl(text,file,offset){
  const {node,parent}=selected(text,file,offset);if(!parent)throw new Error('The root control cannot be removed');
  if(!Object.hasOwn(controlDefinitions,localName(node.tag)))throw new Error('Select a visual control');
  const next=text.slice(0,node.span.start)+text.slice(node.span.end);xml(next,file);return {file,before:text,after:next,selection:parent.span.start};
}
/** Swap adjacent full element spans; all intervening comments and formatting are retained. */
export function moveControl(text,file,offset,direction){
  const {node,parent}=selected(text,file,offset);if(!parent||!['StackPanel','Grid','Canvas','WrapPanel','DockPanel','Panel'].includes(localName(parent.tag)))throw new Error('Only siblings in a panel can be reordered');
  const children=parent.children.filter(c=>c.kind==='element'&&!localName(c.tag).includes('.')),index=children.indexOf(node),other=children[index+(direction==='up'?-1:1)];
  if(!other)throw new Error('Already at the end of the sibling list');
  const a=node.span.start<other.span.start?node:other,b=a===node?other:node;
  const next=text.slice(0,a.span.start)+text.slice(b.span.start,b.span.end)+text.slice(a.span.end,b.span.start)+text.slice(a.span.start,a.span.end)+text.slice(b.span.end);
  xml(next,file);return {file,before:text,after:next,selection:node===b?a.span.start:a.span.start+(b.span.end-b.span.start)+(b.span.start-a.span.end)};
}
export class EditHistory {
  constructor(limit=100){this.limit=limit;this.undoStack=[];this.redoStack=[];}
  apply(files,transaction){if(files[transaction.file]!==transaction.before)throw new Error('Source changed since the designer edit was prepared');files[transaction.file]=transaction.after;this.undoStack.push(transaction);if(this.undoStack.length>this.limit)this.undoStack.shift();this.redoStack=[];return transaction;}
  undo(files){const t=this.undoStack.at(-1);if(!t)return null;if(files[t.file]!==t.after)throw new Error('Source changed after this edit; refusing to overwrite it');files[t.file]=t.before;this.undoStack.pop();this.redoStack.push(t);return t;}
  redo(files){const t=this.redoStack.at(-1);if(!t)return null;if(files[t.file]!==t.before)throw new Error('Source changed after undo');files[t.file]=t.after;this.redoStack.pop();this.undoStack.push(t);return t;}
}
export function sourceLocation(text,file,offset){return new SourceFile(file,text).location(offset);}

/** Duplicate a literal subtree without duplicating names or rewriting unrelated source. */
export function duplicateControl(text,file,offset){
  if(file.endsWith('.cs'))throw new Error('Duplicate currently requires a XAML control');
  const {node,parent,root}=selected(text,file,offset);
  if(!parent||!['Panel','StackPanel','Grid','Canvas','WrapPanel','DockPanel'].includes(localName(parent.tag)))throw new Error('Duplicate requires a control inside a panel');
  const used=new Set(flatten(root).flatMap(({node})=>Object.entries(node.attributes).filter(([key])=>key==='Name'||key==='x:Name').map(([,value])=>value)));
  const edits=[];let hasRootName=false;
  for(const {node:child}of flatten(node))for(const [key,value]of Object.entries(child.attributes)){
    if(value.startsWith('{')&&!value.startsWith('{}'))throw new Error('Duplicate with bindings/resources requires explicit source editing');
    if(key==='Name'||key==='x:Name'){
      if(child===node)hasRootName=true;
      let next=value+'Copy',n=2;while(used.has(next))next=value+'Copy'+n++;used.add(next);
      const span=child.attributeSpans[key];edits.push([span.start-node.span.start,span.end-node.span.start,`${key}="${next}"`]);
    }
  }
  let copy=text.slice(node.span.start,node.span.end);
  for(const [start,end,value]of edits.sort((a,b)=>b[0]-a[0]))copy=copy.slice(0,start)+value+copy.slice(end);
  if(!hasRootName){let n=1;const base=localName(node.tag);while(used.has(base+n))n++;const start=1+node.tag.length;copy=copy.slice(0,start)+` Name="${base+n}"`+copy.slice(start);}
  const eol=text.includes('\r\n')?'\r\n':'\n',lineStart=text.lastIndexOf('\n',node.span.start)+1;
  const leading=text.slice(lineStart,node.span.start),separator=/^\s*$/.test(leading)?eol+leading:'';
  const next=text.slice(0,node.span.end)+separator+copy+text.slice(node.span.end);
  xml(next,file);return {file,before:text,after:next,selection:node.span.end+separator.length};
}

/** Explicit expression edit: ordinary literal edits continue to protect bindings. */
export function editExpression(text,file,offset,property,value){
  if(file.endsWith('.cs'))throw new Error('Binding editing currently requires XAML');
  if(value!=null){const parsed=parseMarkup(String(value));if(!parsed||typeof parsed!=='object'||!liveValue(parsed))throw new Error('Use a supported Binding, StaticResource or DynamicResource expression');}
  return writeProperty(text,file,offset,property,value,true);
}
/** Move the existing element bytes; source and destination must share namespace mappings. */
export function reparentControl(text,file,offset,targetName){
  if(file.endsWith('.cs'))throw new Error('Moving between hosts currently requires XAML');
  const {node,parent,root}=selected(text,file,offset),entries=flatten(root);
  const targets=entries.filter(e=>(e.node.attributes.Name??e.node.attributes['x:Name'])===targetName);
  if(targets.length!==1)throw new Error('Choose a unique named destination host');
  const target=targets[0].node;
  if(!Object.hasOwn(controlDefinitions,localName(node.tag)))throw new Error('Select a visual control, not a resource');
  if(!parent||target===node||target.span.start>=node.span.start&&target.span.end<=node.span.end)throw new Error('Cannot move a root or create an ownership cycle');
  if(!panelTypes.has(localName(target.tag))&&!contentTypes.has(localName(target.tag)))throw new Error('Destination is not a supported host');
  if(parent===target)throw new Error('Control is already in this host');
  const owner=n=>entries.find(e=>e.node===n)?.parent;
  const namespaceMap=n=>{const chain=[];for(let p=n;p;p=owner(p))chain.unshift(p);const result={};for(const p of chain)for(const [k,v]of Object.entries(p.attributes))if(k==='xmlns'||k.startsWith('xmlns:'))result[k]=v;return JSON.stringify(Object.entries(result).sort());};
  if(namespaceMap(node)!==namespaceMap(target))throw new Error('Move would change XML namespace resolution');
  for(let p=parent;p;p=owner(p))if(['ControlTemplate','DataTemplate','TreeDataTemplate'].includes(localName(p.tag)))throw new Error('Move across template scopes requires source editing');
  for(let p=target;p;p=owner(p))if(['ControlTemplate','DataTemplate','TreeDataTemplate'].includes(localName(p.tag)))throw new Error('Move across template scopes requires source editing');
  const wrappers=target.children.filter(c=>c.kind==='element'&&['Children','Child','Content'].includes(localName(c.tag).split('.')[1]));
  if(wrappers.length>1)throw new Error('Destination has ambiguous content properties');
  const host=wrappers[0]??target,visual=host.children.filter(c=>c.kind==='element'&&!localName(c.tag).includes('.')||c.kind==='text');
  if(!panelTypes.has(localName(target.tag))&&(visual.length||'Content'in target.attributes||'Child'in target.attributes))throw new Error('Destination content host is not empty');
  const child=text.slice(node.span.start,node.span.end),eol=text.includes('\r\n')?'\r\n':'\n';
  let start,end,replacement;
  if(text.slice(host.span.end-2,host.span.end)==='/>'){start=host.span.end-2;end=host.span.end;replacement='>'+eol+'  '+child+eol+'</'+host.tag+'>';}
  else{start=end=text.lastIndexOf('</',host.span.end-1);replacement=eol+'  '+child+eol;}
  let after=text;for(const [a,b,v]of [[node.span.start,node.span.end,''],[start,end,replacement]].sort((a,b)=>b[0]-a[0]))after=after.slice(0,a)+v+after.slice(b);
  xml(after,file);return {file,before:text,after,selection:start-(node.span.start<start?node.span.end-node.span.start:0)};
}
