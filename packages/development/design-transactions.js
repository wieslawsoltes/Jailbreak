import {editProperty} from './designer.js';
/** One undoable source transaction for the entire selection; no partial file writes. */
export function editSelectionProperties(files,selection,edits){
  if(!Array.isArray(selection)||!Array.isArray(edits)||!edits.length||edits.length>128)throw new Error('Invalid selection edit budget');
  const selected=new Map(selection.map(i=>[i.id,i])),seen=new Set(),records=[];let file=null;
  for(const edit of edits){const target=selected.get(edit.id),source=target?.source;
    if(!source||target.template||source.language!=='xaml'||!Number.isSafeInteger(source.offset)||source.offset<0)throw new Error('Selection has no editable literal XAML origin');
    if(file&&file!==source.file)throw new Error('Batch edits require one source document');file=source.file;
    if(seen.has(source.offset))throw new Error('Several runtime instances share this source; edit it explicitly');seen.add(source.offset);
    if(!edit.values||Array.isArray(edit.values)||typeof edit.values!=='object'||!Object.keys(edit.values).length||Object.keys(edit.values).length>16)throw new Error('Invalid property edit');
    for(const [key,value]of Object.entries(edit.values))if(!['Canvas.Left','Canvas.Top','Width','Height'].includes(key)||typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1000000||['Width','Height'].includes(key)&&value<=0)throw new Error('Invalid layout literal');
    records.push({source,values:edit.values});
  }
  const before=files[file];if(typeof before!=='string')throw new Error('Source file is unavailable');let after=before;
  // Descending source positions keep preceding origin offsets unchanged.
  for(const {source,values}of records.sort((a,b)=>b.source.offset-a.source.offset))for(const [property,value]of Object.entries(values))after=editProperty(after,file,source.offset,property,String(value)).after;
  return {file,before,after,selection:Math.min(...records.map(r=>r.source.offset))};
}
