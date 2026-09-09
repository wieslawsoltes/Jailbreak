/** UI-only state. Nothing here executes user code or changes compilation semantics. */
export class DocumentTabs {
  constructor(limit=200){ this.limit=limit; this.items=[]; this.pinned=new Set(); this.closed=[]; }
  restore(items=[],pinned=[]){
    this.items=[...new Set(items.filter(x=>typeof x==='string'))].slice(0,this.limit);
    this.pinned=new Set(pinned.filter(x=>this.items.includes(x))); this.closed=[]; return this.ordered();
  }
  ordered(){return [...this.items.filter(x=>this.pinned.has(x)),...this.items.filter(x=>!this.pinned.has(x))];}
  open(path){if(!this.items.includes(path)){if(this.items.length>=this.limit){const victim=this.items.find(x=>!this.pinned.has(x));if(!victim)throw new Error('All open tabs are pinned; close a tab first');this.close(victim);}this.items.push(path);}return this.ordered();}
  close(path){const index=this.ordered().indexOf(path);this.items=this.items.filter(x=>x!==path);this.pinned.delete(path);if(index>=0){this.closed=this.closed.filter(x=>x!==path);this.closed.push(path);if(this.closed.length>30)this.closed.shift();}const order=this.ordered();return order[Math.min(Math.max(index-1,0),order.length-1)]??null;}
  pin(path,value=!this.pinned.has(path)){this.open(path);if(value)this.pinned.add(path);else this.pinned.delete(path);return this.ordered();}
  reopen(available){let path;while((path=this.closed.pop())!==undefined){if(available(path)){this.open(path);return path;}}return null;}
}
export function solutionTree(paths){
  const root={kind:'folder',path:'',label:'',children:[]},folders=new Map([['',root]]);
  for(const path of [...new Set(paths)].sort()){
    if(typeof path!=='string')continue;const parts=path.split('/');let prefix='',parent=root;
    for(const part of parts.slice(0,-1)){prefix+=(prefix?'/':'')+part;if(!folders.has(prefix)){const folder={kind:'folder',path:prefix,label:part,children:[]};parent.children.push(folder);folders.set(prefix,folder);}parent=folders.get(prefix);}
    parent.children.push({kind:'file',path,label:parts.at(-1),language:fileKind(path)});
  }
  const sort=node=>{node.children.sort((a,b)=>(a.kind==='folder'?0:1)-(b.kind==='folder'?0:1)||a.label.localeCompare(b.label));node.children.filter(n=>n.kind==='folder').forEach(sort);};sort(root);return root;
}
export function fileKind(path){return /\.binary\.json$/i.test(path)?'binary':/\.cs$/i.test(path)?'csharp':/\.a?xaml$/i.test(path)?'xaml':/\.(csproj|sln|slnx|props|targets)$/i.test(path)?'project':/\.js$/i.test(path)?'javascript':'file';}
export function propertyCategory(name){return /^(Width|Height|Min|Max|Margin|Padding|Spacing|Orientation|Horizontal|Vertical|Grid\.|Canvas\.|DockPanel\.)/.test(name)?'Layout':/^(Background|Foreground|Border|Font|Opacity|Corner|Theme)/.test(name)?'Appearance':/^(Is|Value|Minimum|Maximum|Selected|Watermark)/.test(name)?'Behavior':'Content';}
export function displayValue(value){if(value===undefined)return '[undefined]';if(value===null)return 'null';if(typeof value==='string')return JSON.stringify(value);if(typeof value==='object')return Array.isArray(value)?`Array (${value.length})`:`Object (${Object.keys(value).length})`;return String(value);}
export function valueType(value){return value===null?'null':Array.isArray(value)?'array':typeof value;}
/** Display already-serialized debugger records; do not invoke getters or follow prototypes. */
export function inspectorRows(value,expanded=new Set(),{maxRows=400,maxDepth=8}={}){
  const rows=[],seen=new Set();
  function walk(object,parent='',depth=0){if(!object||typeof object!=='object'||seen.has(object)||depth>maxDepth)return;seen.add(object);
    for(const key of Object.keys(object)){if(rows.length>=maxRows)break;const d=Object.getOwnPropertyDescriptor(object,key);if(!d||!Object.hasOwn(d,'value'))continue;
      const path=parent?`${parent}.${key}`:key,v=d.value,children=!!v&&typeof v==='object'&&Object.keys(v).length>0;
      rows.push({key,path,value:displayValue(v),type:valueType(v),depth,children,expanded:expanded.has(path)});if(children&&expanded.has(path))walk(v,path,depth+1);
    }seen.delete(object);
  }walk(value);return rows;
}
export function visibleLines(scrollTop,height,lineHeight,lineCount,padding=16){
  const first=Math.max(1,Math.floor((Math.max(0,scrollTop)-padding)/lineHeight)+1),last=Math.min(lineCount,Math.ceil((scrollTop+height-padding)/lineHeight)+1);
  return {first,last:Math.max(first,last)};
}
export function breakpointState(points,file,line,{sites=[],enabled=true,sourceCurrent=true}={}){
  const matches=points.filter(p=>p.file===file&&p.line===line),b=matches[0];if(!b)return null;
  return {enabled:b.enabled!==false,log:!!b.log,bound:enabled&&sourceCurrent&&sites.some(p=>p.file===file&&p.line===line),conditional:!!b.condition,breakpoint:b};
}
