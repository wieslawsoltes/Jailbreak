/** Side-effect-free property-path watches. No eval, calls, getters or prototype traversal. */
const forbidden=new Set(['__proto__','prototype','constructor']);
export function readWatch(root,path,{maxDepth=16}={}){
  if(typeof path!=='string'||path.length>512)throw new Error('Invalid watch path');
  const text=path.trim(),tokens=[];let at=0;
  const first=/^[A-Za-z_$][\w$]*/.exec(text);if(!first)throw new Error('Use a property path, for example this.count');
  tokens.push(first[0]);at=first[0].length;
  while(at<text.length){const m=/^(?:\.([A-Za-z_$][\w$]*)|\[(\d+)\])/.exec(text.slice(at));if(!m)throw new Error('Watch expressions only support property paths and array indices');tokens.push(m[1]??m[2]);at+=m[0].length;}
  if(tokens.length>maxDepth||tokens.some(t=>forbidden.has(t)))throw new Error('Watch path is not allowed');
  let value=root;
  for(const key of tokens){if(value==null)return undefined;const d=Object.getOwnPropertyDescriptor(Object(value),key);if(!d)return undefined;if(!Object.hasOwn(d,'value'))throw new Error('Watch would invoke a getter; inspect it explicitly in DevTools');value=d.value;}
  return value;
}
export function snapshot(value,{depth=2,maxEntries=40,maxString=1000}={},seen=new Set()){
  if(value===undefined)return '[undefined]';if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number')return Number.isFinite(value)?value:String(value);
  if(typeof value==='bigint')return value.toString()+'n';if(typeof value==='string')return value.slice(0,maxString);
  if(typeof value==='function')return '[function]';if(typeof value==='symbol')return String(value);
  if(seen.has(value))return '[circular]';if(depth<=0)return '[object]';seen.add(value);
  const result=Array.isArray(value)?[]:{};
  for(const key of Object.keys(value).filter(k=>!forbidden.has(k)).slice(0,maxEntries)){
    const d=Object.getOwnPropertyDescriptor(value,key);result[key]=d&&Object.hasOwn(d,'value')?snapshot(d.value,{depth:depth-1,maxEntries,maxString},seen):'[getter]';
  }
  seen.delete(value);return result;
}
