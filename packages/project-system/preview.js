import { mappedScript, updateGeneratedLocations } from '../development/source-map.js';
import { developmentBridge } from '../development/preview.js';
import {executable} from './index.js';
function inline(text){return text.replace(/<\/script/gi,'<\\/script');}
/** Opaque-origin iframe document: compiled code has no access to IDE storage or network. */
export function previewDocument(result,runtime,{channel='',title='Jailbreak application',development=null,sources={}}={}){
  if(development&&result.debug)updateGeneratedLocations(result.code,result.debug);
  const bridge=`const channel=${JSON.stringify(channel)};const report=(kind,message)=>parent.postMessage({jailbreak:true,channel,kind,message},'*');addEventListener('error',e=>report('error',e.message));addEventListener('unhandledrejection',e=>report('error',String(e.reason?.message??e.reason)));const log=console.log.bind(console);console.log=(...a)=>{log(...a);report('log',a.map(String).join(' '));};`;
  let boot=`try{${development?developmentBridge(development,result.debug):''}Jailbreak.onRendererStatus=s=>report('renderer',s);globalThis.appHandle=${executable(result)};report('ready','Application is running');}catch(e){report('error',e.stack??e.message);document.getElementById('error').textContent=e.stack??e.message;}`;
  if(development&&result.debug){
    boot=mappedScript('\n'+boot,result.debug,sources);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>${title.replace(/[<>&"]/g,'')}</title><style>html,body{margin:0;min-height:100%;font-family:Segoe UI,system-ui,sans-serif;background:#fff;color:#202329}#app{min-height:100vh}#error{white-space:pre-wrap;color:#b42318;padding:16px}#error:empty{display:none}</style></head><body><main id="app"></main><pre id="error"></pre><script>${inline(bridge)}</script><script>${inline(runtime)}</script><script>${inline(boot)}</script></body></html>`;
}
