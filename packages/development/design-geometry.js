/** Pure layout math in unzoomed design pixels. No DOM, source execution or mutation. */
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1000000;
const round=n=>Math.round(n*1000)/1000;
export function validateSelection(items,{minimum=1}={}) {
  if(!Array.isArray(items)||items.length<minimum||items.length>128||new Set(items.map(i=>i.id)).size!==items.length)throw new Error('Select '+minimum+' to 128 distinct visuals');
  for(const i of items)if(!i.movable||!i.parent?.id||i.parent.type!=='Canvas'||!i.source||i.source.language!=='xaml'||i.template||!['x','y','width','height'].every(k=>finite(i.layout?.[k]))||i.layout.width<=0||i.layout.height<=0)throw new Error('Layout actions require untransformed, literal XAML children of a Canvas with no margin or opposing anchors');
  if(items.some(i=>i.parent.id!==items[0].parent.id||i.source.file!==items[0].source.file))throw new Error('Select siblings in the same Canvas and source document');
  return items;
}
export function selectionBounds(items) {
  const x=Math.min(...items.map(i=>i.layout.x)),y=Math.min(...items.map(i=>i.layout.y));
  return {x,y,width:Math.max(...items.map(i=>i.layout.x+i.layout.width))-x,height:Math.max(...items.map(i=>i.layout.y+i.layout.height))-y};
}
export function moveSelection(items,dx,dy,{snap=0}={}) {
  validateSelection(items);
  if(!finite(dx)||!finite(dy)||!finite(snap)||snap<0||snap>256)throw new Error('Invalid design movement');
  const first=items[0].layout;
  if(snap){dx=Math.round((first.x+dx)/snap)*snap-first.x;dy=Math.round((first.y+dy)/snap)*snap-first.y;}
  return items.map(i=>({id:i.id,values:{'Canvas.Left':round(i.layout.x+dx),'Canvas.Top':round(i.layout.y+dy)}}));
}
export function arrangeSelection(items,command) {
  validateSelection(items,{minimum:command.startsWith('distribute-')?3:2});
  const bounds=selectionBounds(items),result=[];
  const patch=(i,p,v)=>result.push({id:i.id,values:{[p]:round(v)}});
  if(command==='distribute-x'||command==='distribute-y'){
    const x=command==='distribute-x',axis=x?'x':'y',size=x?'width':'height',prop=x?'Canvas.Left':'Canvas.Top',ordered=[...items].sort((a,b)=>a.layout[axis]-b.layout[axis]);
    const gap=(bounds[size]-items.reduce((n,i)=>n+i.layout[size],0))/(items.length-1);
    let position=ordered[0].layout[axis];for(const i of ordered){patch(i,prop,position);position+=i.layout[size]+gap;}return result;
  }
  for(const i of items){const r=i.layout;
    switch(command){
      case 'left':patch(i,'Canvas.Left',bounds.x);break;
      case 'center-x':patch(i,'Canvas.Left',bounds.x+(bounds.width-r.width)/2);break;
      case 'right':patch(i,'Canvas.Left',bounds.x+bounds.width-r.width);break;
      case 'top':patch(i,'Canvas.Top',bounds.y);break;
      case 'center-y':patch(i,'Canvas.Top',bounds.y+(bounds.height-r.height)/2);break;
      case 'bottom':patch(i,'Canvas.Top',bounds.y+bounds.height-r.height);break;
      case 'same-width':patch(i,'Width',items[0].layout.width);break;
      case 'same-height':patch(i,'Height',items[0].layout.height);break;
      default:throw new Error('Unknown layout action: '+command);
    }
  }
  return result;
}
export function snapGuides(items,others,dx,dy,tolerance=5) {
  validateSelection(items);if(!finite(dx)||!finite(dy)||!finite(tolerance)||tolerance<0||tolerance>32)throw new Error('Invalid guide movement');
  const b=selectionBounds(items),guides=[];
  function axis(axis,size,delta){let best=tolerance+1,out=delta,line=null;
    for(const other of others.slice(0,500)){
      if(other.parent?.id!==items[0].parent.id||items.some(i=>i.id===other.id)||!other.layout||!finite(other.layout[axis])||!finite(other.layout[size]))continue;
      for(const fraction of [0,.5,1])for(const target of [0,.5,1]){
        const position=other.layout[axis]+other.layout[size]*target,correction=position-(b[axis]+delta+b[size]*fraction);
        if(Math.abs(correction)<best){best=Math.abs(correction);out=delta+correction;line=position;}
      }
    }
    if(best<=tolerance){guides.push({axis,position:line});return out;}return delta;
  }
  return {dx:axis('x','width',dx),dy:axis('y','height',dy),guides};
}
