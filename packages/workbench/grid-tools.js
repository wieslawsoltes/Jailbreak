import {inspectGrid,editGrid} from '../development/grid-editor.js';
/** Source-backed Grid inspector. Owns no live controls; edits use the existing session gate. */
export function createGridTools({document:doc=globalThis.document,development,notify}) {
  const el=(tag,text,attrs={})=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
  const root=el('section',undefined,{id:'grid-designer','aria-label':'Grid layout designer',hidden:''});
  const title=el('div',undefined,{class:'grid-heading'}),badge=el('span','',{id:'grid-dimensions'});
  title.append(el('strong','▦  GRID LAYOUT'),badge);
  const message=el('p','',{id:'grid-message',role:'status'}),body=el('div');root.append(title,message,body);
  const parent=doc.getElementById('dev-property-panel');parent.insertBefore(root,parent.children[1]??null);
  let model=null,disposed=false,sourceIdentity=null;
  const input=(id,label,value,type='text')=>{const e=el('input',undefined,{id,'aria-label':label,type});e.value=String(value);return e;};
  const apply=request=>{try{development.editSource((text,file,offset)=>editGrid(text,file,offset,request));}catch(error){message.textContent=error.message;notify(error.message);}};
  const button=(id,label,fn)=>{const b=el('button',label,{id,type:'button'});b.onclick=fn;return b;};
  function refresh(){
    if(disposed)return;
    try{
      const source=development.sourceForSelection();
      if(!source){root.hidden=true;model=null;sourceIdentity=null;return;}
      // Selection snapshots can arrive more than once after a reload. Do not
      // replace focused inputs (and lose typed values) for an identical source.
      if(sourceIdentity&&sourceIdentity.file===source.file&&sourceIdentity.offset===source.offset&&sourceIdentity.text===source.text){root.hidden=false;return;}
      model=inspectGrid(source.text,source.file,source.offset);
      sourceIdentity={file:source.file,offset:source.offset,text:source.text};
      root.hidden=false;body.replaceChildren();
    }catch(error){root.hidden=true;model=null;sourceIdentity=null;return;}
    badge.textContent=model.name+' · '+model.rows.length+' × '+model.columns.length;
    message.textContent=model.child?'Choose a cell or edit placement. Track changes preserve child identities.':'Select a direct child to place it. Track edits update affected indices and spans.';
    for(const axis of ['rows','columns']){
      const card=el('div',undefined,{class:'grid-track-card'}),spec=input('grid-'+axis,axis+' definitions',model[axis].join(',')),index=input('grid-'+axis+'-index',axis+' track index',0,'number'),value=input('grid-'+axis+'-size','New '+axis+' track size','*');index.min='0';index.max=String(model[axis].length);
      const heading=el('label',axis==='rows'?'Rows':'Columns');heading.htmlFor=spec.id;
      const line=el('div',undefined,{class:'grid-track-spec'});line.append(heading,spec,button('grid-apply-'+axis,'Apply',()=>apply({kind:'tracks',axis,value:spec.value})));
      const chips=el('div',undefined,{class:'grid-track-chips'});model[axis].forEach((size,i)=>{const chip=button('grid-'+axis+'-track-'+i,i+': '+size,()=>{index.value=String(i);value.value=size;});chip.title='Select track '+i;chips.append(chip);});
      const controls=el('div',undefined,{class:'grid-track-actions'});controls.append(el('span','At'),index,value,button('grid-insert-'+axis,'+ Track',()=>apply({kind:'insert',axis,index:index.value,value:value.value})),button('grid-remove-'+axis,'− Track',()=>apply({kind:'remove',axis,index:index.value})));
      card.append(line,chips,controls);body.append(card);
    }
    if(model.child){
      const cell=el('div',undefined,{class:'grid-cell-fields'}),fields={};
      for(const key of ['row','column','rowSpan','columnSpan']){const labels={row:'Row',column:'Column',rowSpan:'Row span',columnSpan:'Column span'},e=input('grid-'+key,labels[key],model.cell[key],'number');e.min=key.endsWith('Span')?'1':'0';const label=el('label',labels[key]);label.append(e);cell.append(label);fields[key]=e;}
      body.append(cell,button('grid-apply-cell','Apply cell & spans',()=>apply({kind:'cell',...Object.fromEntries(Object.entries(fields).map(([k,e])=>[k,e.value]))})));
      if(model.rows.length*model.columns.length<=144){
        const matrix=el('div',undefined,{class:'grid-cell-map',role:'group','aria-label':'Choose Grid cell'});matrix.style.gridTemplateColumns=`repeat(${model.columns.length},minmax(0,1fr))`;
        for(let row=0;row<model.rows.length;row++)for(let column=0;column<model.columns.length;column++){
          const b=button('grid-cell-'+row+'-'+column,`${row},${column}`,()=>apply({kind:'cell',row,column,rowSpan:Math.min(model.cell.rowSpan,model.rows.length-row),columnSpan:Math.min(model.cell.columnSpan,model.columns.length-column)}));
          b.setAttribute('aria-label',`Place in row ${row}, column ${column}`);b.setAttribute('aria-pressed',String(row===model.cell.row&&column===model.cell.column));
          b.title=model.placements.filter(p=>row>=p.row&&row<p.row+p.rowSpan&&column>=p.column&&column<p.column+p.columnSpan).map(p=>p.name).join(', ')||'Empty cell';matrix.append(b);
        }body.append(matrix);
      }
    }
    const gaps=el('div',undefined,{class:'grid-track-actions'}),rowGap=input('grid-row-gap','Row gap',model.rowSpacing,'number'),columnGap=input('grid-column-gap','Column gap',model.columnSpacing,'number');rowGap.min=columnGap.min='0';
    for(const [label,field]of [['Row gap',rowGap],['Column gap',columnGap]]){const l=el('label',label);l.append(field);gaps.append(l);}
    gaps.append(button('grid-apply-gaps','Apply gaps',()=>apply({kind:'spacing',rowSpacing:rowGap.value,columnSpacing:columnGap.value})));body.append(gaps);
  }
  const unsubscribe=development.subscribe(({event})=>{if(['selected','reloaded'].includes(event))refresh();else if(['workspace-reset','session-starting','session-stopped'].includes(event)){root.hidden=true;model=null;sourceIdentity=null;}});
  return {refresh,dispose(){disposed=true;unsubscribe();root.remove();}};
}
