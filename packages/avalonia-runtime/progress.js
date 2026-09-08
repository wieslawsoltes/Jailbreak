/** Range normalization and the documented percentage-format subset for ProgressBar. */
export function progressState(minimum,maximum,value){
  const min=Number(minimum??0),max=Math.max(min,Number(maximum??100)),v=Math.min(max,Math.max(min,Number(value??0)));
  if(![min,max,v].every(Number.isFinite))throw new Error('ProgressBar range must be finite');
  const range=max-min,ratio=range>0?(v-min)/range:0;return {minimum:min,maximum:max,value:v,ratio,percentage:ratio*100};
}
export function formatProgressText(format,percentage){
  format=String(format??'{0:0}%');let result='';
  for(let i=0;i<format.length;){
    if(format.startsWith('{{',i)){result+='{';i+=2;continue;}if(format.startsWith('}}',i)){result+='}';i+=2;continue;}
    if(format[i]==='{'){const m=/^\{0(?::(0(?:\.0{1,8})?|[Ff]\d))?\}/.exec(format.slice(i));if(!m)throw new Error('Unsupported ProgressTextFormat; use {0}, {0:0}, {0:0.00} or {0:F2}');
      const f=m[1];result+=f?percentage.toFixed(/^[Ff]/.test(f)?Number(f.slice(1)):(f.split('.')[1]?.length??0)):String(percentage);i+=m[0].length;
    }else if(format[i]==='}')throw new Error('Unescaped closing brace in ProgressTextFormat');else result+=format[i++];
  }return result;
}
export function renderProgress(control){
  const e=control.element,state=progressState(control.Minimum,control.Maximum,control.Value),vertical=control.Orientation==='Vertical',indeterminate=!!control.IsIndeterminate;
  if(!control._progress){control._progress=document.createElement('progress');control._progress.setAttribute('aria-hidden','true');control._progressLabel=document.createElement('span');control._progressLabel.className='jb-progress-text';e.replaceChildren(control._progress,control._progressLabel);e.setAttribute('role','progressbar');}
  const native=control._progress,label=control._progressLabel;native.max=1;if(indeterminate)native.removeAttribute('value');else native.value=state.ratio;
  e.setAttribute('aria-valuemin',String(state.minimum));e.setAttribute('aria-valuemax',String(state.maximum));e.setAttribute('aria-orientation',vertical?'vertical':'horizontal');
  if(indeterminate)e.removeAttribute('aria-valuenow');else e.setAttribute('aria-valuenow',String(state.value));
  const text=formatProgressText(control.ProgressTextFormat,state.percentage);label.textContent=text;label.hidden=!control.ShowProgressText||indeterminate;
  if(indeterminate)e.removeAttribute('aria-valuetext');else e.setAttribute('aria-valuetext',text);
  e.style.height=control.Height!=null?control.Height+'px':vertical?'160px':control.ShowProgressText?'28px':'8px';
  e.style.width=control.Width!=null?control.Width+'px':vertical?'40px':'100%';e.style.minWidth=vertical?'24px':'100px';
  Object.assign(native.style,{position:'absolute',left:'50%',top:'50%',width:vertical?e.style.height:'100%',height:vertical?'16px':'100%',transform:vertical?'translate(-50%,-50%) rotate(-90deg)':'translate(-50%,-50%)'});
  Object.assign(label.style,{position:'relative',display:label.hidden?'none':'block',textAlign:'center',fontSize:'12px',lineHeight:e.style.height});
  return state;
}
