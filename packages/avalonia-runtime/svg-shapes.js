import {LinearGradientBrush,GradientStop,PathGeometry,pathData,pointValues,pointList,relativePoint,finiteVector} from './vector-model.js';
import {brush} from './styling.js';
export const shapeTags={Rectangle:'rect',Ellipse:'ellipse',Path:'path',Line:'line',Polygon:'polygon',Polyline:'polyline'};
const svg=(doc,name)=>doc.createElementNS('http://www.w3.org/2000/svg',name);
const attrs=(node,values)=>{for(const [k,v]of Object.entries(values))node.setAttribute(k,String(v));return node;};
/** Native SVG is the retained vector backend. WebGPU remains the primitive-surface backend. */
export function renderShape(control){
  const {element,shape,type}=control,doc=element.ownerDocument;
  let defs=element.querySelector('defs');if(!defs){defs=svg(doc,'defs');element.prepend(defs);}else defs.replaceChildren();
  function paint(value,key){if(!(value instanceof LinearGradientBrush))return brush(value)||'none';
    const a=relativePoint(value.StartPoint),b=relativePoint(value.EndPoint);if(a.units!==b.units)throw new Error('Gradient endpoints require matching units');
    const spread={Pad:'pad',Reflect:'reflect',Repeat:'repeat'}[value.SpreadMethod];if(!spread)throw new Error('Unsupported gradient spread');
    if(value.GradientStops.length>4096)throw new Error('Gradient stop budget exceeded');
    const gradient=attrs(svg(doc,'linearGradient'),{id:control.uid+'-'+key,gradientUnits:a.units,x1:a.values[0],y1:a.values[1],x2:b.values[0],y2:b.values[1],spreadMethod:spread});
    for(const stop of value.GradientStops){if(!(stop instanceof GradientStop))throw new Error('Invalid gradient stop');const color=brush(stop.Color);if(!color)throw new Error('Invalid gradient color');gradient.append(attrs(svg(doc,'stop'),{offset:Math.min(1,Math.max(0,finiteVector(stop.Offset))),'stop-color':color,'stop-opacity':Math.min(1,Math.max(0,finiteVector(value.Opacity)))}));}
    defs.append(gradient);return 'url(#'+gradient.id+')';
  }
  const explicit=n=>n!==null&&n!==undefined&&n!=='Auto'&&Number.isFinite(Number(n))&&Number(n)>=0;
  const w=explicit(control.Width)?finiteVector(control.Width):100,h=explicit(control.Height)?finiteVector(control.Height):100;
  attrs(shape,{fill:paint(control.Fill,'fill'),stroke:paint(control.Stroke,'stroke'),'stroke-width':Math.max(0,finiteVector(control.StrokeThickness??1))});
  if(type==='Rectangle')attrs(shape,{width:w,height:h,rx:Math.max(0,finiteVector(control.RadiusX??0)),ry:Math.max(0,finiteVector(control.RadiusY??control.RadiusX??0))});
  if(type==='Ellipse')attrs(shape,{cx:w/2,cy:h/2,rx:w/2,ry:h/2});
  if(type==='Path'){attrs(shape,{d:pathData(control.Data)});const fill=control.Data instanceof PathGeometry?control.Data.FillRule:'EvenOdd';if(!['EvenOdd','NonZero'].includes(fill))throw new Error('Unsupported fill rule');shape.setAttribute('fill-rule',fill==='EvenOdd'?'evenodd':'nonzero');}
  if(type==='Polygon'||type==='Polyline')shape.setAttribute('points',pointList(control.Points));
  if(type==='Line'){const a=pointValues(control.StartPoint??'0,0'),b=pointValues(control.EndPoint??'0,0');attrs(shape,{x1:a[0],y1:a[1],x2:b[0],y2:b[1]});}
  const bounds=shape.getBBox(),width=explicit(control.Width)?w:Math.max(1,bounds.x+bounds.width),height=explicit(control.Height)?h:Math.max(1,bounds.y+bounds.height),stretch=control.Stretch??'None';
  if(!['None','Fill','Uniform','UniformToFill'].includes(stretch))throw new Error('Unsupported vector stretch');
  attrs(element,{width,height,viewBox:stretch==='None'?`0 0 ${Math.max(1,width)} ${Math.max(1,height)}`:`${bounds.x} ${bounds.y} ${Math.max(1,bounds.width)} ${Math.max(1,bounds.height)}`,preserveAspectRatio:stretch==='Fill'?'none':stretch==='UniformToFill'?'xMidYMid slice':'xMidYMid meet'});
  element.style.overflow=control.ClipToBounds?'hidden':'visible';
  if(control.OpacityMask!=null){
    const mask=attrs(svg(doc,'mask'),{id:control.uid+'-mask',maskUnits:'objectBoundingBox',maskContentUnits:'objectBoundingBox',x:0,y:0,width:1,height:1});mask.style.maskType='alpha';
    mask.append(attrs(svg(doc,'rect'),{x:0,y:0,width:1,height:1,fill:paint(control.OpacityMask,'mask-paint')}));defs.append(mask);shape.setAttribute('mask','url(#'+mask.id+')');
  }else shape.removeAttribute('mask');
}
