import { observePath, writePath } from './properties.js';
import { defaultTwoWay } from './schema.js';
import { StringApi } from '../dotnet-runtime/index.js';
/** A disposable path binding. Subscription graphs are rebuilt when intermediate objects change. */
export function bind(target,property,spec,scope,resolveValue=x=>x){
  let busy=false,offPath=()=>{},source=null,disposed=false,hasValue=false;
  let path=spec.path??'',negate=false,elementName=spec.ElementName;
  if(path.startsWith('!')){negate=true;path=path.slice(1);}
  if(path.startsWith('#')){const dot=path.indexOf('.');elementName=path.slice(1,dot<0?undefined:dot);path=dot<0?'':path.slice(dot+1);}
  const mode=spec.Mode&&spec.Mode!=='Default'?spec.Mode:defaultTwoWay.has(target.type+'.'+property)?'TwoWay':'OneWay';
  const converter=spec.Converter?resolveValue(spec.Converter,target):null;
  function forward(value){if(busy||disposed)return;if(value===undefined&&Object.hasOwn(spec,'FallbackValue'))value=resolveValue(spec.FallbackValue,target);if(value===null&&Object.hasOwn(spec,'TargetNullValue'))value=resolveValue(spec.TargetNullValue,target);
    if(converter)value=converter.Convert(value,null,spec.ConverterParameter,null);if(negate)value=!value;if(spec.StringFormat)value=StringApi.Format(spec.StringFormat,value);
    busy=true;try{target.SetValue(property,value);}finally{busy=false;}
  }
  function backward(){if(busy||disposed||source==null)return;let value=target.GetValue(property);if(negate)value=!value;if(converter){if(typeof converter.ConvertBack!=='function')throw new Error('TwoWay converter has no ConvertBack');value=converter.ConvertBack(value,null,spec.ConverterParameter,null);}busy=true;try{writePath(source,path,value);}finally{busy=false;}}
  function refresh(){if(disposed||(mode==='OneTime'&&hasValue))return;offPath();source=Object.hasOwn(spec,'Source')?resolveValue(spec.Source,target):elementName?scope.names.get(elementName):target.DataContext;
    if(mode==='OneWayToSource'){backward();return;}
    offPath=observePath(source,path,forward);if(mode==='OneTime'&&source!=null){hasValue=true;offPath();}
  }
  const offTarget=target.PropertyChanged.add((sender,e)=>{if(e.PropertyName==='DataContext'&&!elementName&&!Object.hasOwn(spec,'Source'))refresh();if(e.PropertyName===property&&(mode==='TwoWay'||mode==='OneWayToSource'))backward();});
  refresh();const dispose=()=>{disposed=true;offPath();offTarget();};target.track(dispose);return dispose;
}
