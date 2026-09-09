/** Reusable, finite vector/brush models. Source values never contain DOM or URLs. */
export const vectorProperties={
  LinearGradientBrush:['StartPoint','EndPoint','GradientStops','Opacity','SpreadMethod'],
  GradientStop:['Offset','Color'],PathGeometry:['Figures','FillRule'],
  PathFigure:['StartPoint','IsClosed','IsFilled','Segments'],LineSegment:['Point'],
  QuadraticBezierSegment:['Point1','Point2'],BezierSegment:['Point1','Point2','Point3']
};
export const vectorChildren={LinearGradientBrush:'GradientStops',PathGeometry:'Figures',PathFigure:'Segments'};
export class VectorCollection extends Array {Add(item){if(this.length>=100000)throw new Error('Vector collection budget exceeded');this.push(item);}get Count(){return this.length;}}
export class GradientStop {constructor(color='Transparent',offset=0){this.Color=color;this.Offset=offset;}}
export class LinearGradientBrush {constructor(){this.StartPoint='0%,0%';this.EndPoint='100%,0%';this.Opacity=1;this.SpreadMethod='Pad';this.GradientStops=new VectorCollection();}}
export class PathGeometry {constructor(){this.Figures=new VectorCollection();this.FillRule='EvenOdd';}toString(){return pathData(this);}ToString(){return this.toString();}}
export class PathFigure {constructor(){this.StartPoint='0,0';this.IsClosed=false;this.IsFilled=true;this.Segments=new VectorCollection();}}
export class LineSegment {constructor(point='0,0'){this.Point=point;}}
export class QuadraticBezierSegment {constructor(){this.Point1='0,0';this.Point2='0,0';}}
export class BezierSegment {constructor(){this.Point1='0,0';this.Point2='0,0';this.Point3='0,0';}}
export const vectorTypes={LinearGradientBrush,GradientStop,PathGeometry,PathFigure,LineSegment,QuadraticBezierSegment,BezierSegment};
export function finiteVector(value){const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>1e9)throw new Error('Vector coordinate must be finite and bounded');return n;}
export function pointValues(value){const a=typeof value==='object'&&value!==null?[value.X,value.Y]:String(value).trim().split(/[,\s]+/);if(a.length!==2)throw new Error('Expected two point coordinates');return a.map(finiteVector);}
export function relativePoint(value){const a=String(value).trim().split(/[,\s]+/);if(a.length!==2)throw new Error('Expected a relative point');const percent=a.map(n=>n.endsWith('%'));if(percent[0]!==percent[1])throw new Error('Mixed point units are not supported');return {units:percent[0]?'objectBoundingBox':'userSpaceOnUse',values:a.map(n=>finiteVector(n.replace(/%$/,''))/(percent[0]?100:1))};}
export function pathData(geometry){
  if(!(geometry instanceof PathGeometry)){
    const d=String(geometry??'');if(d.length>1000000||!/^[\s,\d.eE+\-MmLlHhVvCcSsQqTtAaZz]*$/.test(d))throw new Error('Unsupported or oversized path data');return d;
  }
  const commands=[];let budget=0;
  for(const figure of geometry.Figures){if(!(figure instanceof PathFigure)||figure.IsFilled===false||figure.IsFilled==='False')throw new Error('This path profile requires filled PathFigures');commands.push('M '+pointValues(figure.StartPoint).join(','));
    for(const s of figure.Segments){if(++budget>100000)throw new Error('Path segment budget exceeded');if(s instanceof LineSegment)commands.push('L '+pointValues(s.Point).join(','));else if(s instanceof QuadraticBezierSegment)commands.push('Q '+pointValues(s.Point1).join(',')+' '+pointValues(s.Point2).join(','));else if(s instanceof BezierSegment)commands.push('C '+[s.Point1,s.Point2,s.Point3].map(p=>pointValues(p).join(',')).join(' '));else throw new Error('Unsupported path segment');}
    if(figure.IsClosed===true||String(figure.IsClosed).toLowerCase()==='true')commands.push('Z');
  }return commands.join(' ');
}
export function pointList(value){if(Array.isArray(value)){if(value.length>100000)throw new Error('Point count exceeded');return value.map(v=>pointValues(v).join(',')).join(' ');}const data=String(value??'');if(!data.trim())return '';if(data.length>1000000)throw new Error('Point data budget exceeded');const a=data.trim().split(/[,\s]+/).map(finiteVector);if(a.length%2)throw new Error('Point list requires coordinate pairs');return a.map((v,i)=>v+(i%2?'':',')).join(' ').replace(/, /g,',');}
/** Validated XAML object construction using the same public models as compiled C#. */
export function vectorObject(node,build,resolve){
  const Type=vectorTypes[node.type];if(!Type)return undefined;const value=new Type();
  for(const [key,v]of Object.entries(node.attributes)){if(!vectorProperties[node.type].includes(key)||key===vectorChildren[node.type])throw new Error('Unsupported vector property '+node.type+'.'+key);const resolved=resolve(v);if(resolved&&typeof resolved==='object'&&resolved.kind)throw new Error('Vector object bindings require explicit invalidation support');value[key]=resolved;}
  for(const child of node.children.filter(n=>n.kind!=='text')){
    if(child.kind==='property'){if(child.property!==vectorChildren[node.type])throw new Error('Unsupported vector property element');for(const n of child.children.filter(n=>n.kind!=='text'))value[child.property].Add(build(n));}
    else{const name=vectorChildren[node.type];if(!name)throw new Error('Unexpected child of '+node.type);value[name].Add(build(child));}
  }return value;
}
