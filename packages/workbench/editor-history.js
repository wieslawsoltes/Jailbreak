import {SourceHistory} from './edit-history.js';
/** One source undo stack per document, including IME, completion, replace and rename.
 * Capture precedes the application's input listener; the file map is the preimage.
 */
export function installEditorHistory({document:doc=globalThis.document,active,documents,notify}){
  const editor=doc.getElementById('editor'),history=new SourceHistory();let applying=false,selection=null,composing=false;
  const mark=()=>{selection={file:active(),start:editor.selectionStart,end:editor.selectionEnd};};
  const input=event=>{if(applying||editor.readOnly)return;const file=active(),before=documents()[file];if(typeof before!=='string')return;
    const pos=selection?.file===file?selection:{start:editor.selectionStart,end:editor.selectionEnd};
    history.record(file,before,editor.value,{...pos,inputType:composing?'insertCompositionText':event.inputType??'transaction'});selection=null;
  };
  function apply(direction){if(editor.readOnly)return;try{const edit=history.apply(active(),editor.value,direction);if(!edit)return;
    applying=true;try{editor.value=edit.text;editor.setSelectionRange(Math.min(edit.start,edit.text.length),Math.min(edit.end,edit.text.length));editor.dispatchEvent(new Event('input'));editor.dispatchEvent(new Event('select'));editor.focus();}finally{applying=false;}
  }catch(error){notify(error.message);}}
  const before=event=>{if(['historyUndo','historyRedo'].includes(event.inputType)){event.preventDefault();apply(event.inputType==='historyUndo'?'undo':'redo');}else mark();};
  const keys=event=>{if(doc.activeElement!==editor||event.isComposing||!(event.ctrlKey||event.metaKey)||event.altKey)return;const key=event.key.toLowerCase();if(!['z','y'].includes(key))return;event.preventDefault();event.stopImmediatePropagation();apply(key==='y'||event.shiftKey?'redo':'undo');};
  const compositionStart=()=>{composing=true;},compositionEnd=()=>{composing=false;};
  editor.addEventListener('beforeinput',before,true);editor.addEventListener('input',input,true);editor.addEventListener('compositionstart',compositionStart);editor.addEventListener('compositionend',compositionEnd);doc.addEventListener('keydown',keys,true);
  return {undo:()=>apply('undo'),redo:()=>apply('redo'),reset(){history.clear();selection=null;},dispose(){editor.removeEventListener('beforeinput',before,true);editor.removeEventListener('input',input,true);editor.removeEventListener('compositionstart',compositionStart);editor.removeEventListener('compositionend',compositionEnd);doc.removeEventListener('keydown',keys,true);history.clear();}};
}
