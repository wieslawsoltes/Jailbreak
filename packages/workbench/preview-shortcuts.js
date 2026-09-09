/** Fixed navigation/debug commands only; no arbitrary key/event or filesystem operation relay. */
export function previewShortcut(e){
  if(e.isComposing||e.altKey)return null;
  const key=e.key.toLowerCase();
  if(e.ctrlKey||e.metaKey){if(key==='p')return e.shiftKey?'palette':'files';if(key==='f'&&e.shiftKey)return 'search';if(e.key==='F5'&&e.shiftKey)return 'restart';return null;}
  if(e.key==='F5')return e.shiftKey?'stop':'continue';
  if(e.key==='F8')return 'continue';if(e.key==='F10'&&!e.shiftKey)return 'over';if(e.key==='F11')return e.shiftKey?'out':'into';if(e.key==='F4')return 'properties';return null;
}
export function shortcutRelayScript(send,enabled){
  return `addEventListener('keydown',event=>{if(!event.isTrusted||!(${enabled}))return;const command=(${previewShortcut.toString()})(event);if(command){event.preventDefault();(${send})(command);}},true);`;
}
