/** Reusable build-profile editor and evaluation inspector. All workspace data is text, never HTML. */
export function createBuildProfileInspector({document:doc=globalThis.document,onApply=()=>{},onOpenFile=()=>{}}={}) {
  if(!doc)throw new Error('The profile inspector requires a document');
  const element=(tag,text='',className='')=>{const e=doc.createElement(tag);e.textContent=text;if(className)e.className=className;return e;};
  const button=element('button','Build profile · Debug','jb-profile-button');button.type='button';button.id='build-profile';
  const dialog=element('dialog','','jb-profile-dialog');dialog.id='build-profile-dialog';dialog.setAttribute('aria-label','Build profile and evaluated project');
  const style=element('style');style.textContent=`.jb-profile-dialog,.jb-profile-dialog *{box-sizing:border-box}.jb-profile-button{font:inherit}.jb-profile-dialog{color:var(--text,#e7e8f1);background:var(--panel,#1c1e2a);border:1px solid var(--line,#454859);border-radius:14px;padding:24px;max-width:min(780px,94vw);width:780px;max-height:88vh;overflow:auto;font:13px/1.6 system-ui,sans-serif}.jb-profile-dialog::backdrop{background:#11182799}.jb-profile-dialog h2{font-size:23px;margin:0 0 4px}.jb-profile-dialog p{color:var(--muted,#858b9d);margin:0 0 16px}.jb-profile-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.jb-profile-fields label{display:flex;flex-direction:column;gap:4px;min-width:0}.jb-profile-fields input,.jb-profile-dialog select{font:inherit;color:inherit;border:1px solid var(--line,#454859);background:var(--bg,#151620);border-radius:6px;padding:8px;min-width:0;width:100%}.jb-profile-fields label:last-child{grid-column:1/-1}.jb-profile-dialog button{font:inherit;padding:7px 12px;border-radius:6px;border:1px solid var(--line,#454859);background:var(--bg,#151620);color:inherit;cursor:pointer}.jb-profile-dialog button:focus-visible,.jb-profile-dialog input:focus-visible,.jb-profile-dialog select:focus-visible{outline:2px solid var(--accent,#a69bff);outline-offset:2px}.jb-profile-dialog footer{display:flex;justify-content:flex-end;gap:8px;margin:18px 0}.jb-profile-dialog [data-action=apply]{background:var(--accent,#6559e8);color:white}.jb-profile-dialog h3{font-size:14px;margin:16px 0 8px}.jb-profile-dialog details{border-bottom:1px solid var(--line,#454859);padding:8px 0}.jb-profile-dialog summary{cursor:pointer}.jb-profile-dialog pre{font:11px/1.6 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;padding:8px;background:var(--bg,#151620);border-radius:6px}.jb-profile-dialog .jb-profile-files{max-height:220px;overflow:auto;display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:8px 0}.jb-profile-dialog .jb-profile-files button{text-align:left;overflow-wrap:anywhere;white-space:normal}.jb-profile-note{font-size:11px}.jb-profile-dialog [role=alert]{color:var(--error,#ed9299)}@media(max-width:520px){.jb-profile-fields{grid-template-columns:1fr}.jb-profile-dialog{padding:16px}}`;
  const heading=element('h2','Build profile');const description=element('p','Choose the source configuration, then inspect exactly what the project evaluator selected.');
  const form=element('form');form.noValidate=true;const fields=element('div','','jb-profile-fields'),inputs={};
  for(const [name,label,placeholder]of [['configuration','Configuration','Debug'],['platform','Platform','AnyCPU'],['targetFramework','Target framework','Project default, e.g. net8.0'],['symbols','Additional C# symbols','BROWSER;EXPERIMENTAL']]) {
    const wrapper=element('label',label),input=doc.createElement('input');input.name=name;input.dataset.profileField=name;input.setAttribute('aria-label',label);input.placeholder=placeholder;input.maxLength=name==='symbols'?4096:128;input.autocomplete='off';inputs[name]=input;wrapper.append(input);fields.append(wrapper);
  }
  const datalist=element('datalist');datalist.id='jb-profile-configurations';for(const value of ['Debug','Release']){const option=element('option');option.value=value;datalist.append(option);}inputs.configuration.setAttribute('list',datalist.id);
  const note=element('p','No SDK, targets, tasks or NuGet restore is executed. Additional symbols apply to every source project.','jb-profile-note');
  const alert=element('div');alert.setAttribute('role','alert');const footer=element('footer'),close=element('button','Close'),apply=element('button','Apply & build');close.type='button';close.dataset.action='close';apply.type='submit';apply.dataset.action='apply';footer.append(close,apply);
  form.append(fields,datalist,note,alert,footer);
  const title=element('h3','Last evaluated build'),summary=element('p','Build a workspace to inspect its evaluation.'),projectSelect=element('select');projectSelect.id='profile-project';projectSelect.setAttribute('aria-label','Evaluated project');projectSelect.hidden=true;
  const output=element('div');dialog.append(style,heading,description,form,title,summary,projectSelect,output);doc.body.append(dialog);
  let value={configuration:'Debug',platform:'AnyCPU',targetFramework:'',symbols:[]},last=null,stale=false;
  function normalized(profile={}){return {configuration:String(profile.configuration??'Debug').trim()||'Debug',platform:String(profile.platform??'AnyCPU').trim()||'AnyCPU',targetFramework:String(profile.targetFramework??'').trim(),symbols:typeof profile.symbols==='string'?profile.symbols.split(/[;,\s]+/).filter(Boolean):Array.from(profile.symbols??[],String)};}
  function updateButton(){button.textContent=`Build profile · ${value.configuration}${value.targetFramework?' / '+value.targetFramework:''}`;}
  function render(){
    output.replaceChildren();const projects=last?.buildProfiles??last?.projects??[];
    summary.textContent=last?`${stale?'Out of date — rebuild to refresh. ':''}${projects.length} evaluated project${projects.length===1?'':'s'} · ${(last.files??[]).length} selected source files.`:'Build a workspace to inspect its evaluation.';
    projectSelect.hidden=!projects.length;if(!projects.length)return;
    const project=projects.find(p=>(p.path??p.file)===projectSelect.value)??projects[0];
    const section=(label,text,open=false)=>{const details=element('details');details.open=open;details.append(element('summary',label),element('pre',text));output.append(details);};
    section('Conditional symbols',(project.symbols??[]).join('\n')||'(none)',true);
    section('Evaluated properties',JSON.stringify(project.properties??{},null,2));
    section('Imported project files',JSON.stringify(project.imports??[],null,2));
    section('References and packages',JSON.stringify({references:project.references??[],packages:project.packages??[]},null,2));
    const details=element('details'),files=element('div','','jb-profile-files');details.append(element('summary',`Source files (${project.sources?.length??0})`),files);details.open=true;
    for(const path of project.sources??[]){const item=element('button',path);item.type='button';item.addEventListener('click',()=>{dialog.close();onOpenFile(path);});files.append(item);}output.append(details);
    section('Evaluated items and metadata',JSON.stringify(project.items??{},null,2));
  }
  button.addEventListener('click',()=>{for(const [name,input]of Object.entries(inputs))input.value=name==='symbols'?value.symbols.join(';'):value[name];alert.textContent='';render();dialog.showModal();inputs.configuration.focus();});
  close.addEventListener('click',()=>dialog.close());projectSelect.addEventListener('change',render);
  form.addEventListener('submit',event=>{event.preventDefault();const next=normalized(Object.fromEntries(Object.entries(inputs).map(([name,input])=>[name,input.value])));
    if(next.symbols.some(s=>!/^[A-Za-z_]\w*$/.test(s)||['true','false'].includes(s))){alert.textContent='Symbols must be C# identifiers, separated by semicolons, commas or spaces.';inputs.symbols.focus();return;}
    value=next;stale=true;updateButton();dialog.close();onApply(api.options());
  });
  const api={button,dialog,
    options(){return {...value,symbols:[...value.symbols],targetFramework:value.targetFramework||undefined};},
    set(profile={}){value=normalized(profile);last=null;stale=false;updateButton();render();},
    invalidate(){stale=true;render();},
    update(result){last=result;stale=false;const selected=projectSelect.value;projectSelect.replaceChildren();for(const p of result?.buildProfiles??result?.projects??[]){const option=element('option',p.path??p.file);option.value=p.path??p.file;projectSelect.append(option);}if([...projectSelect.options].some(o=>o.value===selected))projectSelect.value=selected;render();},
    dispose(){button.remove();dialog.remove();}
  };
  return api;
}
