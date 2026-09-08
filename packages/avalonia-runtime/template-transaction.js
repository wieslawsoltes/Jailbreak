/** Retain old template parts until a whole live-update transaction has succeeded. */
export function beginTemplateTransaction(controls) {
  const snapshots=new Map(),retired=new Set();
  const fields=['_templateInstance','_appliedTemplate','_contentTemplateRoot','_contentTemplate','_contentData','_themeKeys','_styleValues'];
  for(const c of controls){
    snapshots.set(c,Object.fromEntries(fields.map(k=>[k,c[k]])));
    if(c._templateTransaction)throw new Error('Nested template transaction');
    c._templateTransaction={retire:value=>{if(value)retired.add(value);}};
  }
  const root=v=>v?.root??v;
  const cleanup=(value,warn)=>{try{root(value)?.Dispose();value?.names?.clear();}catch(e){warn(e.message);}};
  return {
    rollback(){
      const keep=new Set([...snapshots.values()].flatMap(s=>[s._templateInstance,s._contentTemplateRoot]).filter(Boolean));
      for(const [c,s]of snapshots){
        for(const v of [c._templateInstance,c._contentTemplateRoot])if(v&&!keep.has(v))retired.add(v);
        Object.assign(c,s);delete c._templateTransaction;c.invalidate('*');
      }
      for(const v of retired)if(!keep.has(v))cleanup(v,()=>{});
    },
    finalize(warn=()=>{}){
      const keep=new Set([...snapshots.keys()].flatMap(c=>[c._templateInstance,c._contentTemplateRoot]).filter(Boolean));
      for(const c of snapshots.keys())delete c._templateTransaction;
      for(const v of retired)if(!keep.has(v))cleanup(v,warn);
    }
  };
}
