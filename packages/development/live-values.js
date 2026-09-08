import {controlDefinitions} from '../avalonia-runtime/schema.js';
/** Reloadable value contracts. No arbitrary markup extensions or backward-only initialization. */
const scalar=v=>v==null||['string','boolean','number'].includes(typeof v);
export function liveValue(value) {
  if(scalar(value))return true;
  if(value.kind==='resource')return typeof value.key==='string'||value.key?.kind==='type';
  if(value.kind==='binding')return value.Mode!=='OneWayToSource'&&Object.entries(value).every(([key,v])=>
    key==='RelativeSource'?['Self','TemplatedParent'].includes(v?.mode):key==='Source'||key==='Converter'||key==='FallbackValue'||key==='TargetNullValue'?scalar(v)||v?.kind==='resource'||v?.kind==='reference':scalar(v));
  return value.kind==='reference'&&typeof value.name==='string';
}
const objects=new Set(['ResourceDictionary','String','Boolean','Int32','Double','Color','SolidColorBrush','Thickness','CornerRadius','FontFamily','Style','Styles','Setter','ControlTheme','ControlTemplate','DataTemplate','RowDefinitions','ColumnDefinitions','RowDefinition','ColumnDefinition']);
export function validateEnvironment(node,budget={left:2000},template=false) {
  if(!node)return;
  if(--budget.left<0)throw new Error('Live environment exceeds 2,000 source nodes');
  if(node.kind==='text')return;
  if(node.kind==='property') {for(const c of node.children)validateEnvironment(c,budget,template);return;}
  if(node.kind==='control'&&(!template||!Object.hasOwn(controlDefinitions,node.type)))throw new Error('Only builtin template parts may be constructed in a live environment');
  if(node.kind==='object'&&!objects.has(node.type))throw new Error('Environment object requires restart: '+node.type);
  for(const [key,v]of Object.entries(node.attributes??{}))if(!liveValue(v)&&v?.kind!=='type'&&v?.kind!=='templateBinding')throw new Error('Environment expression requires restart: '+key);
  for(const c of node.children??[])validateEnvironment(c,budget,template||['ControlTemplate','DataTemplate'].includes(node.type));
}
export const environmentProperties=new Set(['Resources','Styles','Template','ContentTemplate']);
