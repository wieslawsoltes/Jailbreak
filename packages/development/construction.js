import {Control,flushLayout} from '../avalonia-runtime/controls.js';
import {runtimeCss} from '../avalonia-runtime/styling.js';
/** Start a staged application through compiled constructor/XAML continuations.
 * The returned handle exists even while paused. The host is mounted only once
 * construction finishes; cancellation never replaces a previous running root.
 */
export function bootCooperative(api,manifest,host=globalThis.document?.body){
  const co=api.dev?.co;if(!co)throw new Error('Cooperative boot requires a development session');
  if(!host)throw new Error('A browser DOM host is required');
  const style=document.createElement('style');style.textContent=runtimeCss;host.append(style);
  const assets=manifest.assets??{};
  Control.assetResolver=source=>{const path=String(source??'').replace(/^avares:\/\/[^/]+\//,'');return assets[path]??assets[Object.keys(assets).find(k=>k.endsWith('/'+path))]??source;};
  Control.xamlLoader=api.loadXaml;Control.onRendererStatus=status=>api.onRendererStatus?.(status);
  let disposed=false,staged=null,mounted=false,task;
  const oldRoot=api.root,oldWindow=api.ApplicationLifetime.MainWindow;
  const handle={root:null,ready:null,taskId:null,dispose(){
    if(disposed)return;disposed=true;
    if(task&&co.state().some(t=>t.taskId===task.taskId))co.command(task.taskId,'cancel');
    try{staged?.Dispose();}finally{style.remove();if(api.root===staged){api.root=oldRoot;api.ApplicationLifetime.MainWindow=oldWindow;}}
  }};
  function* construct(){
    let completed=false;
    try{
      const Type=manifest.entryType?api.resolveType(manifest.entryType):null;
      staged=Type?(yield* co.construct(Type,[])):(yield* api.createFromXamlSteps(manifest.entryXaml));
      if(manifest.entryXaml&&!staged._xamlLoaded)yield* api.loadXamlSteps(staged,manifest.entryXaml);
      if(!(staged instanceof Control))throw new Error('Entry point must be a browser control');
      if(disposed)return null;
      staged.mount(host);mounted=true;flushLayout();
      if(staged.Title)document.title=staged.Title;
      api.root=staged;api.ApplicationLifetime.MainWindow=staged;handle.root=staged;
      completed=true;api.dev.refresh();return staged;
    }finally{
      if(!completed){try{staged?.Dispose();}finally{style.remove();if(mounted&&api.root===staged){api.root=oldRoot;api.ApplicationLifetime.MainWindow=oldWindow;}}}
    }
  }
  task=co.run(construct());handle.taskId=task.taskId;handle.ready=task.promise.then(root=>{if(!root&&!handle.root)handle.cancelled=true;return handle;});return handle;
}
