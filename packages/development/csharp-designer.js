import {parseCSharp} from '../csharp-compiler/index.js';
import {controlDefinitions, hasProperty, eventNames} from '../avalonia-runtime/schema.js';

const numeric=new Set('Width Height MinWidth MinHeight MaxWidth MaxHeight FontSize Opacity Spacing RowSpacing ColumnSpacing Value Minimum Maximum Increment TickFrequency ItemWidth ItemHeight LineHeight MaxLines MaxLength CaretIndex SelectionStart SelectionEnd SelectedIndex'.split(' '));
const boolean=new Set('IsVisible IsEnabled IsChecked IsThreeState IsReadOnly IsExpanded IsSelected IsDefault IsCancel AcceptsReturn AcceptsTab Focusable ClipToBounds UseLayoutRounding IsIndeterminate ShowProgressText IsSnapToTickEnabled LastChildFill ShowGridLines'.split(' '));
const string=new Set('Text Content Header Watermark Title FontFamily Tag'.split(' '));
export function literalValue(node){
  if(node?.kind==='literal')return {editable:node.value!==null,value:node.value};
  if(node?.kind==='unary'&&['-','+'].includes(node.op)&&node.argument?.kind==='literal'&&typeof node.argument.value==='number')return {editable:true,value:(node.op==='-'?-1:1)*node.argument.value};
  return {editable:false};
}
export function construction(text,file,offset){
  const parsed=parseCSharp(text,file),nodes=[];
  if(!parsed.ast||parsed.diagnostics.some(d=>d.severity==='error'))throw new Error('C# source must parse before designer edits');
  function visit(v){if(!v||typeof v!=='object')return;if(v.kind==='new')nodes.push(v);for(const x of Object.values(v)){if(Array.isArray(x))x.forEach(visit);else if(x&&typeof x==='object')visit(x);}}
  visit(parsed.ast);const node=nodes.find(n=>n.start===offset);
  if(!node)throw new Error('No C# construction at this source location');
  return {node,parsed,tokens:parsed.tokens.filter(t=>t.start>=node.start&&t.end<=node.end&&t.kind!=='eof')};
}
export function encodeLiteral(value,kind){
  if(kind==='number'){
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(String(value))||!Number.isFinite(Number(value)))throw new Error('Expected a finite numeric literal');
    return String(Number(value));
  }
  if(kind==='boolean'){if(!['true','false'].includes(String(value)))throw new Error('Expected true or false');return String(value);}
  if(kind==='char'){const text=String(value);if(text.length!==1)throw new Error('Expected one UTF-16 character');return "'"+JSON.stringify(text).slice(1,-1).replace(/'/g,"\\'")+"'";}
  if(kind==='string')return JSON.stringify(String(value)).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  throw new Error('Property needs a typed source expression, not a designer literal');
}
export function propertyKind(property){return numeric.has(property)?'number':boolean.has(property)?'boolean':string.has(property)?'string':property==='PasswordChar'?'char':null;}
export function validateProperty(node,property){
  const type=node.type?.name.split('.').at(-1);
  if(!Object.hasOwn(controlDefinitions,type)||!hasProperty(type,property)||eventNames.includes(property)||property==='Name'||!/^[A-Za-z_]\w*$/.test(property))throw new Error('Property is not a supported C# designer value');
}
/** Token edits preserve trivia, including comments between an initializer name and its value. */
export function editInitializer(text,file,offset,property,value){
  const {node,tokens}=construction(text,file,offset),type=node.type?.name.split('.').at(-1);
  if(!Object.hasOwn(controlDefinitions,type)||!hasProperty(type,property)||eventNames.includes(property)||property==='Name'||!/^[A-Za-z_]\w*$/.test(property))throw new Error('Property is not a supported C# designer value');
  if(node.items?.length)throw new Error('Collection initializers require explicit source editing');
  const members=node.members??[];
  if(new Set(members.map(m=>m.name)).size!==members.length)throw new Error('Duplicate initializer properties');
  const member=members.find(m=>m.name===property),old=literalValue(member?.value),edits=[];
  if(member&&!old.editable)throw new Error('Expression-based initializer values are protected');
  if(member){
    if(value==null){
      const at=tokens.findIndex(t=>t.start===member.value.start),start=at-2;
      if(start<0||tokens[start].value!==property||tokens[start+1].value!=='=')throw new Error('Initializer source does not match its AST');
      const used=tokens.filter(t=>t.start>=tokens[start].start&&t.end<=member.value.end);
      const after=tokens.find(t=>t.start>=member.value.end);
      if(after?.value===',')used.push(after);
      else if(tokens[start-1]?.value===',')used.push(tokens[start-1]);
      for(const t of used)edits.push([t.start,t.end,'']);
    }else edits.push([member.value.start,member.value.end,encodeLiteral(value,tokens.find(t=>t.start===member.value.start)?.kind==='char'?'char':typeof old.value)]);
  }else if(value!=null){
    const kind=numeric.has(property)?'number':boolean.has(property)?'boolean':string.has(property)?'string':property==='PasswordChar'?'char':null;
    const addition=property+' = '+encodeLiteral(value,kind);
    if(node.members==null)edits.push([node.end,node.end,' { '+addition+' }']);
    else {
      const close=tokens.at(-1);if(close?.value!=='}')throw new Error('Initializer delimiter is missing');
      const last=tokens.at(-2),comma=members.length&&last.value!==','?',':'';
      const eol=text.includes('\r\n')?'\r\n':'\n',multiline=text.slice(node.start,node.end).includes('\n');
      // Insert after the final token, before its trailing comment. Existing comments retain their attachment.
      const separator=multiline?eol+(/^\s*/.exec(text.slice(text.lastIndexOf('\n',node.start)+1,node.start))[0])+'    ':' ';
      edits.push([last.end,last.end,comma+separator+addition+(last.value===','?',':'')]);
    }
  }
  let after=text;for(const [a,b,replacement]of edits.sort((a,b)=>b[0]-a[0]))after=after.slice(0,a)+replacement+after.slice(b);
  construction(after,file,offset);return {file,before:text,after,selection:offset};
}
