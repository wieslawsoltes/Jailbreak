import { Workspace, compileWorkspace as compileBackend, readSolution } from './backend.js';
import { evaluateProject } from '../../../packages/build-profile/index.js';
import { prepareCompilation } from '../../../packages/build-profile/graph.js';
import { parseXml } from '../../../packages/compiler-core/xml.js';
import { normalizeWorkspacePath, directory } from '../../../packages/build-profile/paths.js';
export { Workspace, normalizePath, readSolution, runtimeModulePaths, createApplicationHtml } from './backend.js';

export function readProject(source,{file='app.csproj',workspace,...options}={}) {
  const result=evaluateProject({...workspace.toJSON(),[file]:source},file,options);
  return {...result,file};
}
export function compileWorkspace(input,options={}) {
  const workspace=input instanceof Workspace?input:new Workspace(input),paths=workspace.paths();
  const diagnostics=[];let project=options.project??paths.find(p=>/\.slnx?$/.test(p))??paths.find(p=>p.endsWith('.csproj'));
  if(project?.endsWith('.sln')) {
    const result=readSolution(workspace.get(project)||'',{file:project});diagnostics.push(...result.diagnostics);project=result.projects[0]?.path;
  } else if(project?.endsWith('.slnx')) {
    const file=project,result=parseXml(workspace.get(file)||'',file);diagnostics.push(...result.diagnostics);
    const nodes=[];function visit(n){if(n?.kind!=='element')return;if(n.tag==='Project'&&n.attributes.Path)nodes.push(n);n.children.forEach(visit);}visit(result.root);
    try { project=nodes[0]?normalizeWorkspacePath(nodes[0].attributes.Path,directory(file)):null; }
    catch(e){diagnostics.push({code:'JB3001',severity:'error',file,message:e.message,line:1,column:1,offset:0});}
    if(!project)diagnostics.push({code:'JB3001',severity:'error',file,message:'No startup project in solution',line:1,column:1,offset:0});
  }
  const prepared=prepareCompilation(workspace.files,project?[project]:[],options);diagnostics.push(...prepared.diagnostics);
  const backendOptions={...options};delete backendOptions.project;
  const result=compileBackend(prepared.files,backendOptions);diagnostics.push(...result.diagnostics);
  const ok=result.ok&&!diagnostics.some(d=>d.severity==='error');
  return {...result,ok,code:ok?result.code:'',diagnostics,projects:prepared.projects.map(p=>({...p,file:p.path})),sourceSymbols:prepared.sourceSymbols};
}
