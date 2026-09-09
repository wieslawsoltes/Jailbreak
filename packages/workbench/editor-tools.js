import {visibleLines,breakpointState} from './studio-state.js';
/** Viewport-sized breakpoint gutter; the textarea remains the accessible input. */
export function installEditorTools({doc=globalThis.document,active,breakpoints,sites,sourceCurrent,toggle,notify=()=>{}}){
  const editor=doc.getElementById('editor'),wrap=doc.getElementById('editor-wrap'),gutter=doc.createElement('div');gutter.id='studio-gutter';gutter.setAttribute('aria-label','Source breakpoints');wrap.prepend(gutter);
  const execution=doc.createElement('div');execution.id='studio-execution-line';execution.hidden=true;wrap.append(execution);
  let point=null,frame=0;
  function paint(){frame=0;const style=doc.defaultView.getComputedStyle(editor),lh=parseFloat(style.lineHeight)||21,pad=parseFloat(style.paddingTop)||16,lines=editor.value.split('\n').length,file=active();
    const {first,last}=visibleLines(editor.scrollTop,editor.clientHeight,lh,lines,pad);gutter.replaceChildren();
    const bs=breakpoints(),sp=sites();for(let line=first;line<=last;line++){const b=doc.createElement('button');b.type='button';b.dataset.line=line;b.setAttribute('aria-label',`Toggle breakpoint at line ${line}`);b.title=`Line ${line} · toggle breakpoint (F9)`;b.style.top=(pad+(line-1)*lh-editor.scrollTop)+'px';b.style.height=lh+'px';const state=breakpointState(bs,file,line,{sites:sp,enabled:true,sourceCurrent:sourceCurrent(file)});b.className='gutter-line'+(state?' breakpoint'+(state.bound?' bound':' unbound')+(state.log?' logpoint':'')+(state.enabled?'':' disabled'):'')+(point?.file===file&&point.line===line?' current':'');b.setAttribute('aria-pressed',String(!!state));b.onclick=()=>toggle(file,line);b.textContent=point?.file===file&&point.line===line?'➜':state?.log?'◆':'●';gutter.append(b);}
    const y=point?.file===file?pad+(point.line-1)*lh-editor.scrollTop:-100;execution.hidden=y<0||y>editor.clientHeight||!point;execution.style.top=y+'px';execution.style.height=lh+'px';
  }
  const refresh=()=>{if(!frame)frame=doc.defaultView.requestAnimationFrame(paint);};
  const keyboard=e=>{if(e.key==='F9'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();const line=editor.value.slice(0,editor.selectionStart).split('\n').length;toggle(active(),line);notify('Breakpoint toggled at '+active()+':'+line);}
    if(e.target!==editor||editor.readOnly||e.isComposing)return;
    if(e.key==='Enter'&&!e.ctrlKey&&!e.metaKey){const start=editor.selectionStart,prefix=editor.value.slice(0,start),line=prefix.slice(prefix.lastIndexOf('\n')+1),indent=/^\s*/.exec(line)[0],extra=/[\{\[]\s*$/.test(line)?'    ':'';e.preventDefault();editor.setRangeText('\n'+indent+extra,start,editor.selectionEnd,'end');editor.dispatchEvent(new Event('input'));}
    if(e.key==='Tab'&&e.shiftKey){e.preventDefault();e.stopImmediatePropagation();const start=editor.value.lastIndexOf('\n',editor.selectionStart-1)+1,end=editor.value.indexOf('\n',editor.selectionEnd),last=end<0?editor.value.length:end,text=editor.value.slice(start,last);editor.setRangeText(text.replace(/^( {1,4}|\t)/gm,''),start,last,'select');editor.dispatchEvent(new Event('input'));}
  };
  editor.addEventListener('scroll',refresh);editor.addEventListener('input',refresh);doc.addEventListener('keydown',keyboard,true);const resize=new ResizeObserver(refresh);resize.observe(editor);refresh();
  return {refresh,execution(value){point=value;refresh();},dispose(){resize.disconnect();gutter.remove();execution.remove();editor.removeEventListener('scroll',refresh);editor.removeEventListener('input',refresh);doc.removeEventListener('keydown',keyboard,true);if(frame)cancelAnimationFrame(frame);}};
}
