import {parseXml} from '../compiler-core/xml.js';
import {parseGridTracks,gridRange} from '../avalonia-runtime/grid-layout.js';
import {editProperty} from './designer.js';
const tag=n=>n.tag?.split(':').at(-1),own=(n,p)=>Object.hasOwn(n.attributes,p);
const propertyAxis={rows:['RowDefinitions','Grid.Row'],columns:['ColumnDefinitions','Grid.Column']};
function parse(text,file){const r=parseXml(text,file);if(r.diagnostics.length)throw new Error(r.diagnostics[0].message);return r.root;}
function entries(root){const out=[];const walk=(node,parent)=>{if(node.kind!=='element')return;out.push({node,parent});for(const c of node.children)walk(c,node);};walk(root,null);return out;}
function literal(node,key,fallback){const value=node.attributes[key]??fallback;if(typeof value==='string'&&value.startsWith('{'))throw new Error('Grid binding/resource expressions are protected: '+key);return value;}
function integer(value,min=0,max=1000000){const n=Number(value);if(value===''||!Number.isSafeInteger(n)||n<min||n>max)throw new Error('Grid index/span is outside its allowed range');return n;}
/** Source-only direct-child context. Runtime template instances are excluded by the caller. */
export function gridContext(text,file,offset){
  if(!/\.a?xaml$/i.test(file))throw new Error('Grid editing requires XAML source');
  const all=entries(parse(text,file)),selected=all.find(e=>e.node.span.start===offset);
  if(!selected)throw new Error('Stale Grid designer source position');
  let grid=selected.node,child=null,parent=selected.parent;
  if(tag(grid)!=='Grid'){
    child=grid;if(tag(parent)?.endsWith('.Children'))parent=all.find(e=>e.node===parent)?.parent;
    if(tag(parent)!=='Grid')throw new Error('Select a Grid or one of its direct children');grid=parent;
  }
  for(let p=grid;p;p=all.find(e=>e.node===p)?.parent)if(['ControlTemplate','DataTemplate','TreeDataTemplate'].includes(tag(p)))throw new Error('Template Grid edits require explicit source editing');
  for(const name of ['RowDefinitions','ColumnDefinitions'])if(grid.children.some(c=>tag(c)?.endsWith('.'+name)))throw new Error('Expanded Grid definitions are protected; edit their source explicitly');
  const wrappers=grid.children.filter(c=>tag(c)?.endsWith('.Children'));
  if(wrappers.length>1)throw new Error('Ambiguous Grid child ownership');
  const direct=grid.children.filter(c=>c.kind==='element'&&!tag(c).includes('.'));
  if(wrappers.length&&direct.length)throw new Error('Mixed implicit and explicit Grid children');
  const children=wrappers.length?wrappers[0].children.filter(c=>c.kind==='element'&&!tag(c).includes('.')):direct;
  const rows=parseGridTracks(literal(grid,'RowDefinitions','*'),{maxTracks:128}),columns=parseGridTracks(literal(grid,'ColumnDefinitions','*'),{maxTracks:128});
  const placements=children.map(node=>({node,row:gridRange(integer(literal(node,'Grid.Row',0)),integer(literal(node,'Grid.RowSpan',1),1),rows.length),column:gridRange(integer(literal(node,'Grid.Column',0)),integer(literal(node,'Grid.ColumnSpan',1),1),columns.length)}));
  return {grid,child,rows,columns,placements,rowSpacing:literal(grid,'RowSpacing',0),columnSpacing:literal(grid,'ColumnSpacing',0)};
}
export function inspectGrid(text,file,offset){
  const c=gridContext(text,file,offset),p=c.placements.find(p=>p.node===c.child);
  return {gridOffset:c.grid.span.start,name:c.grid.attributes.Name??c.grid.attributes['x:Name']??'Grid',rows:c.rows.map(t=>t.text),columns:c.columns.map(t=>t.text),rowSpacing:c.rowSpacing,columnSpacing:c.columnSpacing,child:!!c.child,cell:p?{row:p.row.start,column:p.column.start,rowSpan:p.row.span,columnSpan:p.column.span}:null,placements:c.placements.map(p=>({name:p.node.attributes.Name??p.node.attributes['x:Name']??tag(p.node),row:p.row.start,column:p.column.start,rowSpan:p.row.span,columnSpan:p.column.span,selected:p.node===c.child}))};
}
/** Track and child-index changes are a single preimage-checked designer transaction. */
export function editGrid(text,file,offset,request){
  const c=gridContext(text,file,offset),changes=new Map();
  const put=(node,key,value)=>{let row=changes.get(node.span.start);if(!row){row={node,properties:{}};changes.set(node.span.start,row);}row.properties[key]=String(value);};
  if(['tracks','insert','remove'].includes(request.kind)){
    const pair=propertyAxis[request.axis];if(!pair)throw new Error('Choose rows or columns');const [property,attached]=pair;
    const previous=c[request.axis];let next=previous.map(t=>t.text),at;
    if(request.kind==='tracks')next=parseGridTracks(request.value,{maxTracks:128}).map(t=>t.text);
    else{
      at=integer(request.index,0,request.kind==='insert'?next.length:next.length-1);
      if(request.kind==='insert'){if(next.length>=128)throw new Error('Grid track budget exceeded');const t=parseGridTracks(request.value??'*');if(t.length!==1)throw new Error('Insert one track at a time');next.splice(at,0,t[0].text);}
      else{if(next.length===1)throw new Error('The final Grid track cannot be removed');next.splice(at,1);}
    }
    put(c.grid,property,next.join(','));
    for(const p of c.placements){
      const old=attached==='Grid.Row'?p.row:p.column;let start=old.start,span=old.span;
      if(request.kind==='insert'){if(start>=at)start++;else if(start+span>at)span++;}
      if(request.kind==='remove'){if(start>at)start--;else if(start+span>at)span=Math.max(1,span-1);}
      const value=gridRange(start,span,next.length);
      // Clamp explicitly present out-of-range spans too. A default index must become
      // explicit when an inserted first track moves that formerly default child.
      if(value.start!==Number(p.node.attributes[attached]??0))put(p.node,attached,value.start);
      if(value.span!==Number(p.node.attributes[attached+'Span']??1))put(p.node,attached+'Span',value.span);
    }
  }else if(request.kind==='cell'){
    if(!c.child)throw new Error('Select a direct Grid child to edit its cell');
    const row=integer(request.row,0,c.rows.length-1),column=integer(request.column,0,c.columns.length-1);
    put(c.child,'Grid.Row',row);put(c.child,'Grid.Column',column);
    put(c.child,'Grid.RowSpan',integer(request.rowSpan??1,1,c.rows.length-row));put(c.child,'Grid.ColumnSpan',integer(request.columnSpan??1,1,c.columns.length-column));
  }else if(request.kind==='spacing'){
    for(const [p,value]of [['RowSpacing',request.rowSpacing],['ColumnSpacing',request.columnSpacing]]){const n=Number(value);if(value===''||!Number.isFinite(n)||n<0||n>10000)throw new Error('Grid spacing requires nonnegative pixels');put(c.grid,p,n);}
  }else throw new Error('Unknown Grid edit');
  let after=text;
  for(const [at,row]of [...changes].sort(([a],[b])=>b-a))for(const [key,value]of Object.entries(row.properties))after=editProperty(after,file,at,key,value).after;
  parse(after,file);return {file,before:text,after,selection:c.grid.span.start,label:'Edit Grid '+request.kind};
}
