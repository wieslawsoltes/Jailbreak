import {solutionTree,fileKind} from './studio-state.js';
import {icon} from './icons.js';
const languageLabel={csharp:'C#',xaml:'<>',javascript:'JS',binary:'IL',project:'◇',file:'≡'};
export function renderSolution(container,{paths,active,filter='',open,collapsed=new Set(),readonly=()=>false}){
  const doc=container.ownerDocument,tree=solutionTree(paths);container.replaceChildren();container.setAttribute('role','tree');container.setAttribute('aria-label','Solution files');
  const query=filter.toLowerCase(),matches=n=>n.kind==='file'?n.path.toLowerCase().includes(query):n.children.some(matches);
  function walk(nodes,depth=0){for(const n of nodes){if(query&&!matches(n))continue;
    const b=doc.createElement('button');b.type='button';b.title=n.path;b.dataset.path=n.path;b.style.setProperty('--depth',depth);b.className='file-row'+(n.kind==='folder'?' folder-row':active===n.path?' active':'');b.setAttribute('role','treeitem');b.setAttribute('aria-level',String(depth+1));
    if(n.kind==='folder'){
      const expanded=!!query||!collapsed.has(n.path);b.setAttribute('aria-expanded',String(expanded));b.append(icon(expanded?'down':'chevron',doc),icon('folder',doc));const t=doc.createElement('span');t.textContent=n.label;b.append(t);
      b.onclick=()=>{if(collapsed.has(n.path))collapsed.delete(n.path);else collapsed.add(n.path);renderSolution(container,{paths,active,filter,open,collapsed,readonly});[...container.querySelectorAll('.folder-row')].find(e=>e.dataset.path===n.path)?.focus();};
      container.append(b);if(expanded)walk(n.children,depth+1);
    }else{
      b.dataset.kind=n.language;b.setAttribute('aria-selected',String(active===n.path));b.setAttribute('aria-label',n.path+(readonly(n.path)?' (verified read-only source)':''));
      const glyph=doc.createElement('span');glyph.className='file-icon '+n.language;glyph.textContent=languageLabel[n.language];const label=doc.createElement('span');label.textContent=n.label;b.append(glyph,label);if(readonly(n.path)){const badge=doc.createElement('span');badge.className='file-badge';badge.textContent='symbol';b.append(badge);}b.onclick=()=>open(n.path);container.append(b);
    }
  }}walk(tree.children);
  container.onkeydown=e=>{const rows=[...container.querySelectorAll('[role=treeitem]')],i=rows.indexOf(doc.activeElement);if(i<0)return;let j=i;
    if(e.key==='ArrowDown')j=Math.min(rows.length-1,i+1);else if(e.key==='ArrowUp')j=Math.max(0,i-1);else if(e.key==='Home')j=0;else if(e.key==='End')j=rows.length-1;else if(e.key==='ArrowRight'&&rows[i].getAttribute('aria-expanded')==='false'||e.key==='ArrowLeft'&&rows[i].getAttribute('aria-expanded')==='true'){e.preventDefault();rows[i].click();return;}else return;e.preventDefault();rows[j]?.focus();
  };
}
export function renderTabs(container,{paths,active,pinned=new Set(),changed=new Set(),open,close,pin}){
  const doc=container.ownerDocument;container.replaceChildren();
  for(const path of paths){const group=doc.createElement('div');group.className='studio-document'+(path===active?' selected':'')+(pinned.has(path)?' pinned':'');const tab=doc.createElement('button');tab.type='button';tab.className='studio-tab';tab.title=path;tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(path===active));tab.tabIndex=path===active?0:-1;tab.dataset.path=path;
    const glyph=doc.createElement('span');glyph.className='tab-icon '+fileKind(path);glyph.textContent=languageLabel[fileKind(path)];const label=doc.createElement('span');label.textContent=path==='jailbreak-app.js'?'Generated.js':path.split('/').at(-1);tab.append(glyph,label);
    if(changed.has(path)){const dot=doc.createElement('span');dot.className='studio-changed';dot.textContent='●';dot.title='Changed since the last build · saved locally';tab.append(dot);}if(pinned.has(path))tab.append(icon('pin',doc));tab.onclick=()=>open(path);
    const x=doc.createElement('button');x.type='button';x.className='studio-tab-close';x.setAttribute('aria-label','Close '+path);x.append(icon('close',doc));x.onclick=()=>close(path);group.append(tab,x);
    group.oncontextmenu=e=>{e.preventDefault();contextMenu(doc,e,[{label:pinned.has(path)?'Unpin tab':'Pin tab',run:()=>pin(path)},{label:'Close',run:()=>close(path)},{label:'Close other unpinned tabs',run:()=>paths.filter(p=>p!==path&&!pinned.has(p)).forEach(close)},{label:'Close tabs to the right',run:()=>paths.slice(paths.indexOf(path)+1).filter(p=>!pinned.has(p)).forEach(close)}]);};
    container.append(group);
  }
  container.onkeydown=e=>{const tabs=[...container.querySelectorAll('[role=tab]')],i=tabs.indexOf(doc.activeElement);if(i<0)return;let index;if(e.key==='ArrowRight')index=(i+1)%tabs.length;else if(e.key==='ArrowLeft')index=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=tabs.length-1;else if(e.key==='Delete'){e.preventDefault();close(tabs[i].dataset.path);return;}else return;e.preventDefault();tabs[index].click();container.querySelector('[aria-selected=true]')?.focus();};
}
export function contextMenu(doc,event,items){
  doc.getElementById('studio-context-menu')?.remove();const m=doc.createElement('div');m.id='studio-context-menu';m.className='studio-menu';m.setAttribute('role','menu');const focus=doc.activeElement;
  const cleanup=()=>{m.remove();doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('keydown',key,true);};const outside=e=>{if(!m.contains(e.target))cleanup();};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();cleanup();focus?.focus();}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const bs=[...m.querySelectorAll('button')],i=bs.indexOf(doc.activeElement);bs[e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length]?.focus();}};
  for(const item of items){const b=doc.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=item.label;b.disabled=!!item.disabled;if(item.shortcut){const k=doc.createElement('kbd');k.textContent=item.shortcut;b.append(k);}b.onclick=()=>{cleanup();item.run();};m.append(b);}doc.body.append(m);
  const box=m.getBoundingClientRect();m.style.left=Math.max(4,Math.min(event.clientX,doc.defaultView.innerWidth-box.width-4))+'px';m.style.top=Math.max(4,Math.min(event.clientY,doc.defaultView.innerHeight-box.height-4))+'px';
  doc.addEventListener('pointerdown',outside,true);doc.addEventListener('keydown',key,true);m.querySelector('button:not(:disabled)')?.focus();return {close:cleanup};
}
