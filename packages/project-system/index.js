import { SourceFile, DiagnosticBag, escapeJs } from '../compiler-core/index.js';
import { parseXml } from '../compiler-core/xml.js';
import { compileXaml } from '../xaml-compiler/index.js';
import { compileCSharp, parseCSharp } from '../csharp-compiler/index.js';

export function normalizePath(path) {
  if(typeof path!=='string'||!path||path.includes('\0')||/^(?:[A-Za-z]:|\/|\\)/.test(path))throw new Error('A workspace path must be relative');
  const parts=[];for(const part of path.replace(/\\/g,'/').split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)throw new Error('Path escapes workspace');parts.pop();}else parts.push(part);}
  if(!parts.length)throw new Error('Empty workspace path');return parts.join('/');
}
function directory(path){return path.includes('/')?path.slice(0,path.lastIndexOf('/')+1):'';}
function join(base,path){return normalizePath(directory(base)+path);}
function glob(pattern){let out='^';for(let i=0;i<pattern.length;i++){const c=pattern[i];if(c==='*'){if(pattern[i+1]==='*'){i++;if(pattern[i+1]==='/'){i++;out+='(?:.*/)?';}else out+='.*';}else out+='[^/]*';}else if(c==='?')out+='[^/]';else out+=c.replace(/[\\^$+?.()|{}\[\]]/g,'\\$&');}return new RegExp(out+'$','i');}
function descendants(root,tag){const out=[];function walk(n){if(n.kind==='element'){if(n.tag===tag)out.push(n);for(const c of n.children)walk(c);}}if(root)walk(root);return out;}
function textOf(node){return node.children.filter(c=>c.kind==='text').map(c=>c.text).join('').trim();}
export class Workspace {
  constructor(files={}) {this.files=new Map();for(const [path,content]of files instanceof Map?files:Array.isArray(files)?files.map(f=>[f.path,f.text]):Object.entries(files))this.set(path,content);}
  set(path,text){path=normalizePath(path);if(typeof text!=='string')throw new TypeError('Source contents must be strings');if(text.length>4_000_000)throw new Error('Individual source exceeds the 4 MB limit');this.files.set(path,text);return this;}
  get(path){return this.files.get(normalizePath(path));}
  toJSON(){return Object.fromEntries(this.files);}
  get paths(){return [...this.files.keys()].sort();}
}
/** Reads solution membership; this does not pretend to be an MSBuild evaluator. */
export function readSolution(workspace,path) {
  const text=workspace.get(path);if(text==null)throw new Error(`Solution '${path}' is missing`);
  if(path.endsWith('.slnx')){const parsed=parseXml(text,path);return {projects:descendants(parsed.root,'Project').map(n=>join(path,n.attributes.Path)),diagnostics:parsed.diagnostics};}
  const projects=[];for(const m of text.matchAll(/^Project\("[^"\r\n]+"\)\s*=\s*"[^"]*",\s*"([^"\r\n]+\.csproj)"/gm))projects.push(join(path,m[1]));
  return {projects,diagnostics:[]};
}
export function readProject(workspace,path) {
  const text=workspace.get(path),bag=new DiagnosticBag();if(text==null)return {path,sources:[],references:[],packages:[],diagnostics:[{code:'JB4001',message:`Project '${path}' is missing`,severity:'error',file:path,line:1,column:1,offset:0}]};
  const parsed=parseXml(text,path),source=parsed.source;bag.merge(parsed.diagnostics);const root=parsed.root,base=directory(path);
  for(const node of descendants(root,'Import'))bag.add('JB4002','Custom MSBuild imports are not evaluated',source,node.span.start,'warning');
  for(const node of descendants(root,'Target'))bag.add('JB4003','Custom MSBuild targets are not executed',source,node.span.start,'warning');
  const items=[...descendants(root,'Compile'),...descendants(root,'AvaloniaResource')];
  const disabled=descendants(root,'EnableDefaultCompileItems').some(n=>textOf(n)==='false');
  const included=workspace.paths.filter(p=>p.startsWith(base)&&!/(^|\/)(obj|bin|node_modules|\.git)\//.test(p)&&(/\.a?xaml$/i.test(p)||(!disabled&&p.endsWith('.cs'))));
  const selected=new Set(included);
  for(const item of items){if(item.attributes.Condition)bag.add('JB4004','Conditional source items require MSBuild evaluation and are not supported',source,item.span.start);for(const key of ['Include','Remove'])for(const pattern of (item.attributes[key]??'').split(';').filter(Boolean)){
    if(pattern.includes('$(')){bag.add('JB4005',`Unevaluated source expression '${pattern}'`,source,item.span.start);continue;}
    const matcher=glob(normalizePath(base+pattern));const matches=workspace.paths.filter(p=>matcher.test(p));if(key==='Include'&&!matches.length&&!pattern.includes('*'))bag.add('JB4006',`Included source '${pattern}' is missing`,source,item.span.start);
    for(const match of matches)key==='Include'?selected.add(match):selected.delete(match);
  }}
  const references=descendants(root,'ProjectReference').map(n=>join(path,n.attributes.Include??''));
  const packages=descendants(root,'PackageReference').map(n=>({name:n.attributes.Include??n.attributes.Update,version:n.attributes.Version??descendants(n,'Version').map(textOf)[0]??null}));
  for(const p of packages)bag.add('JB4010',`${p.name}: NuGet binaries/source generators are not loaded; only registered compatibility APIs can be used`,source,0,'warning');
  return {path,sources:[...selected].filter(p=>/\.(cs|a?xaml)$/i.test(p)),references,packages,diagnostics:bag.items};
}
/** Compiles a dependency graph, not a hard-coded demo. Can also compile loose source files. */
export function compileProject(input,options={}) {
  const start=performance.now(),workspace=input instanceof Workspace?input:new Workspace(input),bag=new DiagnosticBag();const projects=[],selected=new Set(),visiting=new Set(),visited=new Set();
  const paths=workspace.paths;let projectPath=options.projectPath??paths.find(p=>p.endsWith('.csproj'))??null;
  const solutionPath=options.solutionPath??paths.find(p=>/\.slnx?$/.test(p));
  if(solutionPath&&!options.projectPath){const s=readSolution(workspace,solutionPath);bag.merge(s.diagnostics);projectPath=s.projects[0]??projectPath;}
  function visit(path){if(visiting.has(path)){bag.add('JB4007',`Project reference cycle at '${path}'`,new SourceFile(path,''));return;}if(visited.has(path))return;visiting.add(path);const project=readProject(workspace,path);projects.push(project);bag.merge(project.diagnostics);for(const ref of project.references)visit(ref);for(const file of project.sources)selected.add(file);visiting.delete(path);visited.add(path);}
  if(projectPath)visit(projectPath);else for(const path of paths)if(/\.(cs|a?xaml)$/i.test(path))selected.add(path);
  if(selected.size>2000)bag.add('JB4011','Workspace exceeds 2,000 source files for interactive compilation',new SourceFile(projectPath??'workspace',''));
  const sourceFiles=[...selected].sort(),csFiles=sourceFiles.filter(p=>p.endsWith('.cs')).map(path=>({path,text:workspace.get(path)}));
  const declarations=csFiles.flatMap(f=>parseCSharp(f.text,f.path).ast?.declarations??[]);
  const typeNames=declarations.map(d=>d.fullName),xaml=[],xamlNames={};
  for(const path of sourceFiles.filter(p=>/\.a?xaml$/i.test(p))){const result=compileXaml(workspace.get(path),{path,customTypes:typeNames});xaml.push(result);bag.merge(result.diagnostics);if(result.ir.className){xamlNames[result.ir.className]=result.ir.names;if(!typeNames.includes(result.ir.className)){
    const pieces=result.ir.className.split('.'),name=pieces.pop(),ns=pieces.join('.');
    csFiles.push({path:path+'.g.cs',text:(ns?'namespace '+ns+'; ':'')+`public partial class ${name} : ${result.ir.root.type} { }`});
  }}}
  const cs=compileCSharp(csFiles,{xamlNames});bag.merge(cs.diagnostics);
  let entry=options.entryXaml?xaml.find(x=>x.ir.path===options.entryXaml||x.ir.className===options.entryXaml):null;
  if(!entry&&options.entryType)entry=xaml.find(x=>x.ir.className===options.entryType);
  if(!entry&&!options.entryXaml&&!options.entryType)entry=xaml.find(x=>x.ir.root?.type==='Window')??xaml.find(x=>x.ir.root?.type!=='Application'&&x.ir.root?.kind==='control');
  if(options.entryType&&!cs.types.some(t=>t.name===options.entryType))bag.add('JB4009',`Entry type '${options.entryType}' was not found`,new SourceFile(options.entryType,''));
  if(options.entryXaml&&!entry)bag.add('JB4008',`Entry XAML '${options.entryXaml}' was not found`,new SourceFile(options.entryXaml,''));
  const assets={};for(const path of paths)if(workspace.get(path).startsWith('data:'))assets[path]=workspace.get(path);
  const manifest={format:1,entryXaml:entry?.ir.className??entry?.ir.path??null,entryType:options.entryType??entry?.ir.className??null,assets,projects:projects.map(p=>p.path)};
  const code=bag.hasErrors?'':[...xaml.map(x=>x.code),cs.code].filter(Boolean).join('\n\n');
  return {success:!bag.hasErrors,code,manifest,diagnostics:bag.items,xaml:xaml.map(x=>x.ir),types:cs.types,files:sourceFiles,stats:{milliseconds:performance.now()-start,sourceBytes:sourceFiles.reduce((n,p)=>n+workspace.get(p).length,0),generatedBytes:code.length,files:sourceFiles.length}};
}
export function executable(result){if(!result.success)throw new Error('Cannot run an unsuccessful compilation');if(!result.manifest.entryXaml&&!result.manifest.entryType)throw new Error('No UI entry point; this compilation is a library');return `(function(JB){\n${result.code}\nreturn JB.boot(${escapeJs(result.manifest)}, document.getElementById('app'));\n})(globalThis.Jailbreak);`;}
