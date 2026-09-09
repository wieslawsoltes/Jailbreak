import test from 'node:test';
import assert from 'node:assert/strict';
import {previewShortcut,shortcutRelayScript} from '../packages/workbench/preview-shortcuts.js';
const key=(key,props={})=>previewShortcut({key,altKey:false,metaKey:false,ctrlKey:false,shiftKey:false,isComposing:false,...props});
test('preview shortcuts relay only fixed navigation and debugger commands',()=>{
  assert.equal(key('p',{ctrlKey:true,shiftKey:true}),'palette');assert.equal(key('p',{metaKey:true}),'files');assert.equal(key('f',{ctrlKey:true,shiftKey:true}),'search');
  assert.equal(key('F5'),'continue');assert.equal(key('F5',{shiftKey:true}),'stop');assert.equal(key('F5',{ctrlKey:true,shiftKey:true}),'restart');assert.equal(key('F10'),'over');assert.equal(key('F11'),'into');assert.equal(key('F11',{shiftKey:true}),'out');assert.equal(key('F4'),'properties');
  for(const k of ['s','o','h','g','a','c','v','/','Enter'])assert.equal(key(k,{ctrlKey:true}),null);
  assert.equal(key('F10',{shiftKey:true}),null);assert.equal(key('F5',{altKey:true}),null);assert.equal(key('F5',{isComposing:true}),null);
});
test('serialized shortcut relay requires an enabled host and a trusted browser gesture',()=>{
  const output=[],callbacks=[];const code=shortcutRelayScript('command=>sent.push(command)','hosted');
  new Function('addEventListener','sent','hosted',code)((event,fn,capture)=>{assert.equal(event,'keydown');assert.equal(capture,true);callbacks.push(fn);},output,true);
  let prevented=0;const event={key:'F5',isTrusted:false,preventDefault(){prevented++;}};callbacks[0](event);assert.equal(output.length,0);
  callbacks[0]({...event,isTrusted:true});assert.deepEqual(output,['continue']);assert.equal(prevented,1);
  const disabled=[];new Function('addEventListener','sent','hosted',code)((_,fn)=>disabled.push(fn),output,false);disabled[0]({...event,isTrusted:true});assert.equal(output.length,1);
});
