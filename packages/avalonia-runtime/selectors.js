const cache=new Map();
/** Strict subset: type, class, name, pseudo, descendant, child, and /template/ axes. */
export function parseSelector(selector){
  if(typeof selector!=='string'||!selector.trim()||selector.length>4096)throw new Error('Invalid or overlong selector');
  if(cache.has(selector))return cache.get(selector);
  const alternatives=selector.split(',').map(s=>{
    const text=s.trim(),tokens=text.split(/\s*(\/template\/|>)\s*|\s+/).filter(Boolean),steps=[];let axis='descendant',expect=true;
    for(const token of tokens){if(token==='>'||token==='/template/'){if(expect)throw new Error('Unexpected selector combinator');axis=token;expect=true;continue;}
      if(!/^(?:[A-Za-z_]\w*|\*)?(?:[.#:][A-Za-z_][\w-]*)*$/.test(token)||!token)throw new Error('Unsupported selector '+token);
      steps.push({part:token,axis:steps.length?axis:null});axis='descendant';expect=false;
    }
    if(expect||!steps.length)throw new Error('Incomplete selector');return steps;
  });
  if(cache.size>512)cache.clear();cache.set(selector,alternatives);return alternatives;
}
function partMatches(control,part){if(!control)return false;const type=/^[A-Za-z_]\w*/.exec(part)?.[0];if(type&&type!==control.type&&type!==control.constructor?.$fullName?.split('.').at(-1))return false;
  for(const [,prefix,name]of part.matchAll(/([.#:])([\w-]+)/g)){
    if(prefix==='.'&&!String(control.Classes??'').split(/\s+/).includes(name))return false;
    if(prefix==='#'&&control.Name!==name)return false;
    if(prefix===':'){const states={disabled:!control.effectiveEnabled,checked:control.IsChecked===true,unchecked:control.IsChecked===false,indeterminate:control.IsChecked===null,selected:control.IsSelected===true};if(Object.hasOwn(states,name)?!states[name]:!control.pseudos?.has(name))return false;}
  }return true;
}
export function matches(control,selector){return parseSelector(selector).some(steps=>{
  function match(current,i){if(!partMatches(current,steps[i].part))return false;if(!i)return true;const axis=steps[i].axis;
    if(axis==='/template/')return match(current.TemplatedParent,i-1);
    if(axis==='>')return current.parent!==current.TemplatedParent&&match(current.parent,i-1);
    for(let p=current.parent;p;p=p.parent){if(current.TemplatedParent&&p===current.TemplatedParent)break;if(match(p,i-1))return true;}return false;
  }return match(control,steps.length-1);
});}
