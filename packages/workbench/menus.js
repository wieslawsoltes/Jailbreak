import {element} from './studio-ui.js';
/** Keyboard and pointer menubar over the same live commands used by the palette. */
export function createMenuBar({document:doc=globalThis.document,host,commands,notify=()=>{}}) {
  const el=(tag,text,attrs)=>element(doc,tag,text,attrs),groups=['File','Edit','View','Project','Build','Debug','Refactor','Tools','Window','Help'];
  host.replaceChildren();host.setAttribute('role','menubar');host.setAttribute('aria-label','Main menu');
  let active=-1,previous=null,sub=null,popup=null,typeahead='',typeTimer=null;
  const entries=()=>commands().filter(c=>!c.hidden);
  const enabled=c=>{try{return c.enabled?!!c.enabled():true;}catch{return false;}};
  const buttons=groups.map((group,index)=>{const b=el('button',group,{id:'wb-menu-'+group.toLowerCase(),type:'button',role:'menuitem','aria-haspopup':'menu','aria-expanded':'false',tabindex:index===0?'0':'-1'});b.onclick=()=>active===index?close():open(index);b.onpointerenter=()=>{if(active>=0&&active!==index)open(index,false);};b.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='Enter'||e.key===' '){e.preventDefault();open(index);}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();buttons[(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length].focus();}};host.append(b);return b;});
  function close(restore=true){popup?.remove();sub?.remove();popup=sub=null;active=-1;buttons.forEach(b=>b.setAttribute('aria-expanded','false'));if(restore)previous?.focus?.();}
  function position(menu,anchor,nested=false){const r=anchor.getBoundingClientRect(),w=doc.defaultView;menu.style.left=Math.max(4,Math.min(nested?r.right-2:r.left,w.innerWidth-menu.offsetWidth-4))+'px';menu.style.top=Math.max(4,Math.min(nested?r.top:r.bottom,w.innerHeight-menu.offsetHeight-4))+'px';}
  function execute(command){if(!enabled(command))return;close();try{const value=command.run();if(value?.catch)value.catch(e=>notify(e.message));}catch(e){notify(e.message);}}
  function populate(menu,items,isSub=false){
    const nested=new Map();
    for(const command of items){const group=command.menuGroup;if(group&&!isSub){if(!nested.has(group)){nested.set(group,[]);const b=el('button',undefined,{type:'button',role:'menuitem','aria-label':group,'aria-haspopup':'menu','aria-expanded':'false'});b.append(el('span',group),el('span','›',{class:'menu-arrow'}));const show=()=>{sub?.remove();sub=el('div',undefined,{class:'desktop-popup desktop-submenu',role:'menu','aria-label':group});populate(sub,nested.get(group),true);doc.body.append(sub);position(sub,b,true);b.setAttribute('aria-expanded','true');};b.onclick=()=>{show();sub.querySelector('button:not(:disabled)')?.focus();};b.onpointerenter=show;menu.append(b);}nested.get(group).push(command);continue;}
      const b=el('button',undefined,{type:'button',role:command.checked?'menuitemcheckbox':'menuitem'});b.disabled=!enabled(command);b.setAttribute('aria-label',command.menuLabel??command.label.replace(/^[^:]+:\s*/,''));
      if(command.checked)b.setAttribute('aria-checked',String(!!command.checked()));
      b.append(el('span',command.checked?.()?'✓':'',{class:'menu-check'}),el('span',command.menuLabel??command.label.replace(/^[^:]+:\s*/,''),{class:'menu-label'}));
      if(command.shortcut)b.append(el('kbd',command.shortcut));b.onclick=()=>execute(command);b.onpointerenter=()=>{b.focus({preventScroll:true});if(!isSub){sub?.remove();sub=null;}};menu.append(b);
    }
    if(!menu.children.length)menu.append(el('div','No commands in this context',{class:'menu-empty'}));
    menu.addEventListener('keydown',e=>{
      const list=[...menu.querySelectorAll('button:not(:disabled)')],index=list.indexOf(doc.activeElement);
      if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();list[e.key==='Home'?0:e.key==='End'?list.length-1:(index+(e.key==='ArrowDown'?1:-1)+list.length)%list.length]?.focus();}
      else if(e.key==='Escape'){e.preventDefault();close();}
      else if(e.key==='ArrowRight'){e.preventDefault();if(doc.activeElement.getAttribute('aria-haspopup')==='menu')doc.activeElement.click();else open((active+1)%groups.length);}
      else if(e.key==='ArrowLeft'){e.preventDefault();if(isSub){sub?.remove();sub=null;popup?.querySelector('[aria-expanded=true]')?.focus();}else open((active+groups.length-1)%groups.length);}
      else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){typeahead+=e.key.toLowerCase();clearTimeout(typeTimer);typeTimer=setTimeout(()=>typeahead='',600);const match=list.find(b=>(b.querySelector('.menu-label')?.textContent??b.textContent).toLowerCase().startsWith(typeahead));if(match){e.preventDefault();match.focus();}}
      else if(e.key==='Tab')close(false);
    });
  }
  function open(index,focus=true){if(active<0)previous=doc.activeElement;close(false);active=index;const group=groups[index];buttons[index].setAttribute('aria-expanded','true');popup=el('div',undefined,{class:'desktop-popup desktop-main-menu',role:'menu','aria-label':group+' menu'});populate(popup,entries().filter(c=>(c.menuCategory??c.label.split(':')[0])===group));doc.body.append(popup);position(popup,buttons[index]);if(focus)popup.querySelector('button:not(:disabled)')?.focus();}
  const onPointer=e=>{if(popup&&!popup.contains(e.target)&&!sub?.contains(e.target)&&!host.contains(e.target))close(false);};doc.addEventListener('pointerdown',onPointer);
  const onKeys=e=>{if(e.isComposing||doc.querySelector('dialog[open]'))return;if(e.key==='F10'&&e.shiftKey){e.preventDefault();open(0);return;}if(e.altKey&&!e.ctrlKey&&!e.metaKey){const keys={f:0,e:1,v:2,p:3,b:4,d:5,t:7,w:8,h:9};const i=keys[e.key.toLowerCase()];if(i!==undefined){e.preventDefault();e.stopImmediatePropagation();open(i);}}};doc.addEventListener('keydown',onKeys,true);
  return {close,dispose(){close(false);clearTimeout(typeTimer);doc.removeEventListener('pointerdown',onPointer);doc.removeEventListener('keydown',onKeys,true);host.replaceChildren();}};
}
