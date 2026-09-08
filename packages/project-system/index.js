import { Workspace, normalizePath, readSolution, compileProject as compileBackend } from './backend.js';
import { evaluateProject } from '../build-profile/index.js';
import { prepareCompilation } from '../build-profile/graph.js';
export { Workspace, normalizePath, readSolution, executable } from './backend.js';
export { evaluateProject } from '../build-profile/index.js';

export function readProject(workspace, path, options = {}) {
  return evaluateProject(workspace.files,path,options);
}
/** Evaluate projects, select sources, preprocess each file, then invoke the reusable backend. */
export function compileProject(input, options = {}) {
  const workspace = input instanceof Workspace ? input : new Workspace(input), paths = workspace.paths;
  const diagnostics = []; let project = options.projectPath ?? paths.find(p=>p.endsWith('.csproj'));
  const solution = options.solutionPath ?? paths.find(p=>/\.slnx?$/.test(p));
  if (solution && !options.projectPath) {
    try { const result=readSolution(workspace,solution); diagnostics.push(...result.diagnostics); project=result.projects[0]??project; }
    catch(e) { diagnostics.push({code:'JB4001',severity:'error',message:e.message,file:solution,line:1,column:1,offset:0}); }
  }
  const prepared=prepareCompilation(workspace.files,project?[project]:[],options);
  diagnostics.push(...prepared.diagnostics);
  const backendOptions={...options}; delete backendOptions.projectPath; delete backendOptions.solutionPath;
  const result=compileBackend(prepared.files,backendOptions);
  diagnostics.push(...result.diagnostics);
  const success=result.success&&!diagnostics.some(d=>d.severity==='error');
  const profile=prepared.projects[0];
  return {...result,success,code:success?result.code:'',diagnostics,
    manifest:{...result.manifest,projects:prepared.projects.map(p=>p.path),profile:profile?{configuration:profile.configuration,platform:profile.platform,targetFramework:profile.targetFramework,symbols:profile.symbols}:null},
    buildProfiles:prepared.projects,sourceSymbols:prepared.sourceSymbols};
}
