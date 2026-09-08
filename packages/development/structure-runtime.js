/** Atomic logical tree ownership changes. Removed objects are disposed only after commit. */
import { validateNewSubtree } from './structure.js';
import { panelTypes, contentTypes } from './tree-slots.js';
export function prepareStructure(JB, edits, controls, origin) {
  const groups=[], fragments=[], names=new Map(), owners=new Map(), index=new Map(), parents=new Map();
  for(const c of controls){const s=origin(c);if(!s)continue;const k=JSON.stringify([s.file,s.offset]);if(!index.has(k))index.set(k,[]);index.get(k).push(c);}
  const find=(file,offset)=>{
    const found=index.get(JSON.stringify([file,offset]))??[];
    if(found.length!==1)throw new Error('Structural target is absent or repeated (template): '+file+':'+offset);
    return found[0];
  };
  const captureOwner=(owner,key)=>{if(!owners.has(owner))owners.set(owner,new Map());const map=owners.get(owner);if(!map.has(key))map.set(key,Object.getOwnPropertyDescriptor(owner,key));};
  const captureParent=c=>{if(!parents.has(c))parents.set(c,{parent:c.parent,resource:c._resourceParent});};
  const disposeNew=()=>{for(const f of fragments)try{f.root.Dispose();}catch{}};
  const retained=new Set(), removed=new Set(), finalParents=new Map();
  try {
    // Resolve every source host first so moves are independent of source traversal order.
    for(const edit of edits??[]){
      const parent=find(edit.file,edit.offset),kind=edit.kind??'children';
      const supported=kind==='children'?panelTypes.has(parent.type):kind==='content'&&contentTypes.has(parent.type);
      if(!supported||parent.TemplatedParent||parent._templateInstance||parent.Template||parent.ContentTemplate)
        throw new Error('Structural target must be an untemplated logical host');
      if(kind==='children'&&parent.Content!=null)throw new Error('Panel has application-owned content');
      const expected=edit.before.map(o=>find(edit.file,o));
      const current=kind==='children'?[...parent.Children]:parent.Content==null?[]:[parent.Content];
      if(expected.some((c,i)=>c!==current[i])||new Set(current).size!==current.length||kind==='content'&&current.length!==expected.length)
        throw new Error('Runtime child order/content changed; restart before editing structure');
      const scope=parent._nameScope;let owner=parent;
      while(owner.parent&&owner.parent._nameScope===scope)owner=owner.parent;
      if(!(scope instanceof Map))throw new Error('Structural target has no namescope');
      if(!names.has(scope))names.set(scope,new Map(scope));
      for(const c of expected)captureParent(c);
      groups.push({edit,parent,kind,scope,owner,current,expected,extras:current.slice(expected.length),content:parent._values.get('Content')&&new Map(parent._values.get('Content')),appRoot:parent.root});
    }
    const expectedAll=new Set(groups.flatMap(g=>g.expected));
    for(const g of groups){
      g.next=g.edit.children.map(item=>{
        if(item.offset!=null){
          const c=find(g.edit.file,item.offset);
          if(!expectedAll.has(c)||c._nameScope!==g.scope||c.TemplatedParent)throw new Error('Move crosses an unedited host or namescope');
          if(retained.has(c))throw new Error('A control cannot have multiple owners');
          retained.add(c);finalParents.set(c,g.parent);return c;
        }
        validateNewSubtree(item.node);
        const f=JB.prepareXamlFragment(item.node,g.parent,g.owner);fragments.push(f);
        for(const [key]of f.names){
          captureOwner(g.owner,key);
          if(g.scope.has(key)||key in g.owner)throw new Error('New name collides with a live object: '+key);
          if(fragments.some(other=>other!==f&&other.scope===g.scope&&other.names.has(key)))throw new Error('Duplicate staged XAML name: '+key);
        }
        finalParents.set(f.root,g.parent);return f.root;
      });
      if(g.kind==='content'&&g.next.length>1)throw new Error('Content host accepts one child');
      g.next.push(...g.extras);
      if(new Set(g.next).size!==g.next.length)throw new Error('Duplicate structural child');
      for(const key of g.edit.removedNames)captureOwner(g.owner,key);
    }
    for(const c of expectedAll)if(!retained.has(c)){removed.add(c);finalParents.set(c,null);}
    for(const [c]of finalParents){const seen=new Set([c]);for(let p=finalParents.get(c);p;p=finalParents.has(p)?finalParents.get(p):p.parent){if(seen.has(p))throw new Error('Structural edit would create an ownership cycle');seen.add(p);}}
  } catch(error){disposeNew();throw error;}
  const focus=globalThis.document?.activeElement;let selection;
  try{if(typeof focus?.selectionStart==='number')selection=[focus.selectionStart,focus.selectionEnd,focus.selectionDirection];}catch{}
  const restoreFocus=()=>{if(focus?.isConnected)try{focus.focus({preventScroll:true});if(selection)focus.setSelectionRange(...selection);}catch{}};
  function put(g,children,saved=false){
    if(g.kind==='children')g.parent.Children.splice(0,g.parent.Children.length,...children);
    else if(saved){if(g.content)g.parent._values.set('Content',new Map(g.content));else g.parent._values.delete('Content');}
    else {const values=new Map(g.parent._values.get('Content'));values.set(1000,children[0]??null);g.parent._values.set('Content',values);}
    g.parent.invalidate('children');
  }
  return {
    added:fragments.reduce((n,f)=>n+f.created.length,0),removed:removed.size,groups:groups.length,
    apply(){
      for(const g of groups)put(g,g.next);
      for(const [c,p]of finalParents){c.parent=p;c._resourceParent=p;}
      for(const g of groups)for(const key of g.edit.removedNames){g.scope.delete(key);delete g.owner[key];}
      for(const f of fragments)f.attach();
      for(const f of fragments)f.activate();
      for(const [c,saved]of parents)if(c.parent!==saved.parent){c.inheritChanged('DataContext');c.inheritChanged('IsEnabled');JB.refreshXamlSubscriptions?.(c);}
    },
    rollback(){
      for(const [scope,saved]of names){scope.clear();for(const entry of saved)scope.set(...entry);}
      for(const [owner,props]of owners)for(const [key,d]of props){if(d)Object.defineProperty(owner,key,d);else delete owner[key];}
      for(const g of groups)put(g,g.current,true);
      for(const [c,saved]of parents){c.parent=saved.parent;c._resourceParent=saved.resource;}
      disposeNew();
      for(const [c]of parents)try{c.inheritChanged('DataContext');c.inheritChanged('IsEnabled');JB.refreshXamlSubscriptions?.(c);}catch{}
    },
    settle:restoreFocus,
    finalize(warn){
      for(const c of removed){
        const appRoot=groups.find(g=>g.expected.includes(c))?.appRoot;
        const prune=v=>{appRoot?._radios?.delete(v);for(const child of v.visualChildren??[])prune(child);};prune(c);
        try{c.Dispose();}catch(error){warn('Removed control cleanup: '+error.message);}
      }
      for(const g of groups)if(g.kind==='children')try{g.parent.Children.changed('Reset');}catch(error){warn('Collection observer: '+error.message);}
      restoreFocus();
    }
  };
}
