/** Shared shorthand grid semantics. Sizes are logical pixels, Auto or weighted stars. */
export function parseGridTracks(value, {maxTracks=256}={}) {
  if (!Number.isInteger(maxTracks) || maxTracks<1 || maxTracks>4096) throw new RangeError('Invalid grid track budget');
  if (Array.isArray(value)) value=value.map(v=>typeof v==='object' ? v.Height??v.Width??'*' : v).join(',');
  if (value==null || String(value).trim()==='') return [{unit:'star',value:1,text:'*'}];
  const parts=String(value).split(',');
  if (parts.length>maxTracks) throw new RangeError('Grid track budget exceeded');
  return parts.map(part=>{
    const text=part.trim();
    if (/^auto$/i.test(text)) return {unit:'auto',value:0,text:'Auto'};
    const m=/^((?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)?(\*)?$/.exec(text);
    if (!m || !m[1]&&!m[2]) throw new Error('Grid tracks require Auto, nonnegative pixels or weighted stars');
    const n=m[1]===undefined?1:Number(m[1]);
    if (!Number.isFinite(n) || n<0 || n>1e9) throw new RangeError('Grid track size exceeds bounds');
    return {unit:m[2]?'star':'pixel',value:n,text:m[2]?(n===1?'*':n+'*'):String(n)};
  });
}
export function gridCss(value) {
  return parseGridTracks(value).map(t=>t.unit==='auto'?'max-content':t.unit==='star'?`minmax(0,${t.value}fr)`:`${t.value}px`).join(' ');
}
export function gridRange(index, span, count) {
  const integer=(value,fallback)=>Number.isFinite(Number(value))?Math.max(fallback,Math.trunc(Number(value))):fallback;
  const start=Math.min(Math.max(1,count)-1,integer(index,0));
  return {start,span:Math.min(integer(span??1,1),Math.max(1,count)-start)};
}
export function applyGridPlacement(control) {
  if (!control.element) return;
  for (const [axis,definitions] of [['Row','RowDefinitions'],['Column','ColumnDefinitions']]) {
    let css='';
    if (control.parent?.type==='Grid') {
      const count=parseGridTracks(control.parent[definitions]).length;
      const range=gridRange(control.GetValue('Grid.'+axis),control.GetValue('Grid.'+axis+'Span'),count);
      css=`${range.start+1} / span ${range.span}`;
    }
    control.element.style['grid'+axis]=css;
  }
}
