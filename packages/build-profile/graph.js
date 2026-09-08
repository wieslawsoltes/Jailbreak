import { evaluateProject, collectSourceSymbols } from './index.js';
import { preprocessCSharp } from './preprocessor.js';
import { normalizeWorkspacePath } from './paths.js';

/** Select and preprocess a project graph; dependencies retain their own TFM and symbols. */
export function prepareCompilation(input, roots = [], options = {}) {
  const files = input instanceof Map ? input : new Map(Object.entries(input));
  const projects = [], diagnostics = [], visiting = new Set(), visited = new Set(), selected = new Set();
  const error = (code,message,file) => diagnostics.push({code,message,file,severity:'error',line:1,column:1,offset:0});
  function visit(path, isRoot = false) {
    path = normalizeWorkspacePath(path);
    if (visiting.has(path)) { error('JB4007',`Project reference cycle at '${path}'`,path); return; }
    if (visited.has(path)) return;
    visiting.add(path);
    const projectOptions = { ...options, targetFramework: isRoot ? options.targetFramework : options.referenceTargetFrameworks?.[path] };
    const project = evaluateProject(files,path,projectOptions); projects.push(project); diagnostics.push(...project.diagnostics);
    for (const ref of project.references) visit(ref);
    for (const source of project.sources) selected.add(source);
    visiting.delete(path); visited.add(path);
  }
  try {
    if (roots.length) for (const root of roots) visit(root,true);
    else for (const path of files.keys()) if (/\.(cs|xaml|axaml)$/i.test(path)&&!/(^|\/)(bin|obj|node_modules|\.git)\//.test(path)) selected.add(path);
  } catch (e) { error('JB4214',e.message,roots[0]??'workspace'); }
  if (selected.size > (options.maxSources ?? 2000)) error('JB4011','Workspace exceeds the source-file budget',roots[0]??'workspace');
  const graphSymbols = collectSourceSymbols(projects); diagnostics.push(...graphSymbols.diagnostics);
  const extra = typeof options.symbols==='string' ? options.symbols.split(/[;,\s]+/).filter(Boolean) : [...(options.symbols??[])];
  const prepared = {}, sourceSymbols = {};
  for (const path of [...selected].sort()) {
    sourceSymbols[path] = [...new Set([...(graphSymbols.sourceSymbols[path]??[]),...extra])].sort();
    const text = files.get(path);
    if (text == null) { error('JB4209',`Source '${path}' is missing`,path); continue; }
    if (path.endsWith('.cs')) {
      const result = preprocessCSharp(text,{path,symbols:sourceSymbols[path]}); prepared[path]=result.text; diagnostics.push(...result.diagnostics);
    } else prepared[path]=text;
  }
  // Preserve explicitly supplied virtual assets without treating project files as source.
  for (const [path,text] of files) if (typeof text==='string'&&text.startsWith('data:')) prepared[path]=text;
  return { success:!diagnostics.some(d=>d.severity==='error'), files:prepared, sourcePaths:[...selected].sort(), sourceSymbols, projects, diagnostics };
}
