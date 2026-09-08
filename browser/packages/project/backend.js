import {runtimeModulePaths,createApplicationHtml} from './export.js';
export {runtimeModulePaths,createApplicationHtml};
import {parseXml,elements,textContent,diagnostic,failure} from '../core/index.js';
import {compileXaml} from '../xaml/index.js';
import {compileCSharp,Parser} from '../csharp/index.js';

export function normalizePath(path){
  const parts=[];for(const p of String(path).replaceAll('\\','/').split('/')){if(!p||p==='.')continue;if(p==='..'){if(!parts.length)throw new Error('Path leaves workspace');parts.pop();}else parts.push(p);}
  if(/^[a-z]:/i.test(parts[0]||'')||String(path).startsWith('/'))throw new Error('Absolute paths are not supported');
  return parts.join('/');
}
export class Workspace {
  constructor(files={}){this.files=new Map();for(const[path,content]of Object.entries(files))this.set(path,content);}
  set(path,content){path=normalizePath(path);if(!path)throw new Error('Empty file path');if(typeof content!=='string')throw new TypeError('Workspace files must be text');this.files.set(path,content);return this;}
  get(path){return this.files.get(normalizePath(path));}
  paths(){return [...this.files.keys()].sort();}
  toJSON(){return Object.fromEntries(this.files);}
}
const dirname=p=>p.includes('/')?p.slice(0,p.lastIndexOf('/')+1):'';
const join=(base,path)=>normalizePath(dirname(base)+path);
function glob(pattern,path){
  const parts=pattern.replaceAll('\\','/').split('/');const expression=parts.map((p,i)=>p==='**'?(i===parts.length-1?'.*':'(?:.*/)?'):p.replace(/[.+^${}()|[\]\\]/g,'\\$&').replaceAll('*','[^/]*').replaceAll('?','[^/]')+(i<parts.length-1?'/':'')).join('');
  return new RegExp('^'+expression+'$').test(path);
}
export function readSolution(source,{file='app.sln'}={}){
  const projects=[];const rx=/Project\("\{[^}]+\}"\)\s*=\s*"([^"]+)",\s*"([^"]+\.csproj)"/gi;let m;
  while((m=rx.exec(source)))projects.push({name:m[1],path:join(file,m[2])});
  return {projects,diagnostics:projects.length?[]:[diagnostic('JB3001','No C# projects found in solution',file)]};
}
export function readProject(source,{file='app.csproj',workspace}={}){
  const result={file,properties:{},sources:[],references:[],packages:[],diagnostics:[]};
  const report=(message,node,severity='error')=>result.diagnostics.push(diagnostic('JB3002',message,file,severity,node));
  try{
    const xml=parseXml(source,{file});if(xml.tag!=='Project')throw new Error('Expected MSBuild Project root');
    const include=[],remove=[];const walk=node=>{
      if(node.attrs.Condition)report(`MSBuild Condition needs an evaluator: ${node.attrs.Condition}`,node);
      if(['Import','Target','UsingTask','Choose'].includes(node.tag))report(`MSBuild ${node.tag} is not executed in the browser`,node);
      if(node.tag==='PropertyGroup')for(const p of elements(node))result.properties[p.tag]=textContent(p).trim();
      if(node.tag==='ProjectReference'&&node.attrs.Include)result.references.push(join(file,node.attrs.Include));
      if(node.tag==='PackageReference'){const name=node.attrs.Include||node.attrs.Update;result.packages.push(name);report(`NuGet package ${name} is not restored; only mapped browser APIs are available`,node,'warning');}
      if(['Compile','AvaloniaResource','Page'].includes(node.tag)){
        if(node.attrs.Include)for(const p of node.attrs.Include.split(';'))include.push(p);
        if(node.attrs.Remove)for(const p of node.attrs.Remove.split(';'))remove.push(p);
        if(node.attrs.Exclude)report('MSBuild Exclude metadata is not evaluated',node);
      }
      for(const child of elements(node))walk(child);
    };walk(xml);
    const base=dirname(file),paths=workspace.paths().filter(p=>p.startsWith(base));
    const defaults=result.properties.EnableDefaultItems!=='false';
    result.sources=paths.filter(p=>{
      const rel=p.slice(base.length);if(/(^|\/)(bin|obj|node_modules|\.git)\//.test(rel))return false;
      const extension=/\.(cs|xaml|axaml)$/i.test(rel);
      const included=defaults&&extension&&(result.properties.EnableDefaultCompileItems!=='false'||!p.endsWith('.cs'))||include.some(g=>glob(g,rel));
      return included&&!remove.some(g=>glob(g,rel))&&extension;
    });
    for(const p of include)if(p.includes('$('))report(`MSBuild property expansion is unsupported: ${p}`,xml);
    if(result.properties.DefineConstants)report('Conditional compilation symbols require preprocessor support',xml);
  }catch(e){result.diagnostics.push(failure(e,file));}
  return result;
}
/** Pure, deterministic orchestration: no DOM, network, eval, NuGet or MSBuild execution. */
export function compileWorkspace(input,{project=null,entry=null,strict=true}={}){
  const workspace=input instanceof Workspace?input:new Workspace(input),diagnostics=[],projects=[],visited=new Set(),visiting=new Set(),selected=new Set();
  function visit(path){if(visiting.has(path)){diagnostics.push(diagnostic('JB3003',`Project reference cycle at ${path}`,path));return;}if(visited.has(path))return;
    const source=workspace.get(path);if(source==null){diagnostics.push(diagnostic('JB3004',`Missing project ${path}`,path));return;}
    visiting.add(path);const p=readProject(source,{file:path,workspace});projects.push(p);diagnostics.push(...p.diagnostics);p.references.forEach(visit);p.sources.forEach(f=>selected.add(f));visiting.delete(path);visited.add(path);
  }
  if(project?.endsWith('.sln')){const sln=readSolution(workspace.get(project)||'',{file:project});diagnostics.push(...sln.diagnostics);for(const p of sln.projects)visit(p.path);}
  else if(project)visit(project);
  else {const candidates=workspace.paths().filter(p=>p.endsWith('.csproj'));if(candidates.length)for(const p of candidates)visit(p);else workspace.paths().filter(p=>/\.(cs|xaml|axaml)$/i.test(p)).forEach(p=>selected.add(p));}
  const sources=[...selected].sort(),cs=sources.filter(p=>p.endsWith('.cs')).map(path=>({path,content:workspace.get(path)}));
  const knownTypes=[];for(const f of cs){try{knownTypes.push(...new Parser(f.content,{file:f.path}).program().classes.map(c=>c.fullName));}catch{ /* The C# frontend produces the authoritative diagnostic below. */ }}
  const views=[],extraMembers={};for(const path of sources.filter(p=>/\.(xaml|axaml)$/i.test(p))){const v=compileXaml(workspace.get(path),{file:path,knownTypes,strict});diagnostics.push(...v.diagnostics);if(v.className){if(views.some(x=>x.className===v.className))diagnostics.push(diagnostic('JB3005',`Duplicate XAML class ${v.className}`,path));extraMembers[v.className]=v.names;}views.push({...v,path});}
  const csharp=compileCSharp(cs,{extraMembers});diagnostics.push(...csharp.diagnostics);
  const code=[csharp.code];
  for(const v of views.filter(v=>v.ir)){
    const name=v.className||`Jailbreak.Generated.View${views.indexOf(v)}`;v.runtimeName=name;
    code.push(`R.registerXaml(${JSON.stringify(name)},${JSON.stringify(v.ir)});`);
    if(!csharp.classes.some(c=>c.fullName===name)){
      if(v.className&&cs.length)diagnostics.push(diagnostic('JB3006',`XAML class ${v.className} has no compiled code-behind; using a generated view class`,v.path,'warning'));
      code.push(`R.registerType(${JSON.stringify(name)},class extends R.controls[${JSON.stringify(v.ir.type)}]{static __typeName=${JSON.stringify(name)};constructor(){super();this.InitializeComponent();}});`);
    }
  }
  const candidates=views.filter(v=>v.ir&&v.ir.type!=='Application');
  const chosen=entry?candidates.find(v=>v.className===entry||v.path===entry||v.runtimeName===entry):candidates.find(v=>/Main(Window|View)/.test(v.className||v.path))||candidates[0];
  if(!chosen)diagnostics.push(diagnostic('JB3007','No executable XAML view selected; choose a view class or path',entry||project||''));
  const ok=!diagnostics.some(d=>d.severity==='error');
  return {ok,diagnostics,code:ok?code.join('\n'):'',entry:chosen?.runtimeName||null,views:views.map(v=>({path:v.path,className:v.className,runtimeName:v.runtimeName,ok:v.ok,names:v.names,ir:v.ir})),classes:csharp.classes,projects:projects.map(p=>({file:p.file,references:p.references,packages:p.packages,sources:p.sources})),files:sources};
}
