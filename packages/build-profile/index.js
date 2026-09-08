import { parseXml } from '../compiler-core/xml.js';
import { SourceFile, DiagnosticBag } from '../compiler-core/index.js';
import { expandProperties, evaluateCondition } from './conditions.js';
import { normalizeWorkspacePath, virtualRoot, directory, globMatcher, frameworkSymbols } from './paths.js';
export { expandProperties, evaluateCondition } from './conditions.js';
export { preprocessCSharp } from './preprocessor.js';

const childElements = node => node.children.filter(c => c.kind === 'element');
const textOf = node => node.children.filter(c => c.kind === 'text').map(c => c.text).join('').trim();
const sourceKinds = new Set(['Compile', 'AvaloniaResource', 'AvaloniaXaml', 'Page']);
const itemKinds = new Set([...sourceKinds, 'ProjectReference', 'PackageReference', 'Reference', 'EmbeddedResource', 'Resource', 'Content', 'None']);
const list = value => value.split(';').map(s => s.trim()).filter(Boolean);
const isSource = path => /\.(cs|xaml|axaml)$/i.test(path);

/**
 * Deterministic source-selection profile, NOT an MSBuild process or SDK host.
 * Imports are read only from supplied text files. Properties/imports precede items.
 * Tasks, targets, NuGet restore and property functions are never executed.
 */
export function evaluateProject(input, path, options = {}) {
  const files = input instanceof Map ? input : new Map(Object.entries(input));
  path = normalizeWorkspacePath(path);
  const bag = new DiagnosticBag(), props = new Map(), propertyNames = new Map(), locked = new Set();
  const base = directory(path), imports = [], pendingItems = [], imported = new Set(), activeImports = new Set();
  const paths = [...files.keys()].sort(), itemSets = new Map(), sourceByFile = new Map();
  const maxImports = options.maxImports ?? 128, maxItems = options.maxItems ?? 10000;
  let currentFile = path, currentSource = new SourceFile(path, files.get(path) ?? ''), activeNode = null;
  function set(name, value, force = false) {
    const key = name.toLowerCase(); if (!force && locked.has(key)) return;
    props.set(key, String(value)); propertyNames.set(key, name);
  }
  const get = name => props.get(name.toLowerCase()) ?? '';
  const report = (code, message, node = activeNode, severity = 'error') => bag.add(code, message, currentSource, node?.span?.start ?? 0, severity);
  const expand = value => expandProperties(value ?? '', props);
  const virtual = p => virtualRoot + p;
  function exists(value) {
    const p = normalizeWorkspacePath(value, base);
    return files.has(p) || paths.some(file => file.startsWith(p ? p + '/' : ''));
  }
  const condition = node => evaluateCondition(node.attributes.Condition, { properties: props, exists });
  function withFile(file, action) {
    const previousFile = currentFile, previousSource = currentSource, previous = new Map();
    const name = file.slice(directory(file).length), dot = name.lastIndexOf('.');
    for (const [key, value] of Object.entries({ MSBuildThisFileFullPath: virtual(file), MSBuildThisFileDirectory: virtual(directory(file)), MSBuildThisFile: name, MSBuildThisFileName: dot < 0 ? name : name.slice(0,dot), MSBuildThisFileExtension: dot < 0 ? '' : name.slice(dot) })) {
      previous.set(key, get(key)); set(key, value, true);
    }
    currentFile = file; currentSource = new SourceFile(file, files.get(file) ?? '');
    try { return action(); } finally { currentFile = previousFile; currentSource = previousSource; for (const [key,value] of previous) set(key,value,true); }
  }
  for (const [key, value] of Object.entries(options.properties ?? {})) { set(key,value,true); locked.add(key.toLowerCase()); }
  for (const [key, value] of Object.entries({ Configuration: options.configuration, Platform: options.platform, TargetFramework: options.targetFramework })) {
    if (value != null && value !== '') { set(key,value,true); locked.add(key.toLowerCase()); }
  }
  if (!get('Configuration')) set('Configuration', 'Debug');
  if (!get('Platform')) set('Platform', 'AnyCPU');
  const projectFile = path.slice(base.length);
  for (const [key,value] of Object.entries({ MSBuildProjectFullPath:virtual(path), MSBuildProjectDirectory:virtual(base.replace(/\/$/,'')), MSBuildProjectFile:projectFile, MSBuildProjectName:projectFile.replace(/\.[^.]+$/,''), MSBuildProjectExtension:'.csproj' })) {
    set(key,value,true); locked.add(key.toLowerCase());
  }
  function nearest(name) {
    let dir = base;
    for (;;) { const file = dir + name; if (files.has(file)) return file; if (!dir) return null; dir = directory(dir.slice(0,-1)); }
  }
  function importFile(file, from = null, node = null) {
    if (activeImports.has(file)) { report('JB4201', `Import cycle at '${file}'`, node); return; }
    if (imported.has(file)) { report('JB4202', `Duplicate import '${file}' was ignored`, node, 'warning'); return; }
    if (imported.size >= maxImports) { report('JB4201', 'Project import budget exceeded', node); return; }
    if (!files.has(file)) { report('JB4203', `Imported project '${file}' is missing from the workspace`, node); return; }
    imported.add(file); activeImports.add(file); if (from) imports.push({ path:file, from });
    withFile(file, () => {
      try {
        const parsed = parseXml(files.get(file), file); bag.merge(parsed.diagnostics);
        if (!parsed.root || parsed.diagnostics.some(d=>d.severity==='error')) return;
        if (parsed.root.tag !== 'Project') { report('JB4204', 'Expected an MSBuild Project root', parsed.root); return; }
        const sdk = parsed.root.attributes.Sdk;
        if (sdk && sdk !== 'Microsoft.NET.Sdk') report('JB4205', `SDK '${sdk}' has no browser source-selection adapter`, parsed.root);
        propertiesPass(childElements(parsed.root));
      } catch (error) { report('JB4204', error.message); }
    });
    activeImports.delete(file);
  }
  function propertiesPass(nodes) {
    for (const node of nodes) {
      activeNode = node;
      try {
        // Item conditions are evaluated after all properties and imports, not here.
        if (node.tag === 'ItemGroup') { pendingItems.push({ file:currentFile, node }); continue; }
        if (!condition(node)) continue;
        switch (node.tag) {
          case 'PropertyGroup':
            for (const property of childElements(node)) {
              if (!condition(property)) continue;
              if (childElements(property).length) throw new Error(`Nested property value '${property.tag}' is unsupported`);
              set(property.tag, expand(textOf(property)));
            }
            break;
          case 'Import': {
            if (node.attributes.Sdk) throw new Error('Explicit SDK imports require an installed SDK and are unsupported');
            const expression = expand(node.attributes.Project);
            if (!expression) throw new Error('Import Project must not be empty');
            for (const entry of list(expression)) {
              const importedPath = normalizeWorkspacePath(entry, directory(currentFile));
              if (/[*?]/.test(importedPath)) {
                const matcher = globMatcher(importedPath); for (const match of paths.filter(p=>matcher.test(p))) importFile(match,currentFile,node);
              } else importFile(importedPath,currentFile,node);
            }
            break;
          }
          case 'ImportGroup': propertiesPass(childElements(node)); break;
          case 'Choose': {
            let chosen = null, otherwise = null;
            for (const branch of childElements(node)) {
              if (branch.tag === 'Otherwise') { if (otherwise) throw new Error('Duplicate Otherwise'); otherwise = branch; }
              else if (branch.tag !== 'When') throw new Error(`Unsupported Choose child '${branch.tag}'`);
              else if (!chosen && condition(branch)) chosen = branch;
            }
            propertiesPass(childElements(chosen ?? otherwise ?? {children:[]})); break;
          }
          case 'Target': case 'UsingTask': case 'ItemDefinitionGroup':
            report('JB4206', `${node.tag} requires MSBuild execution or item-definition semantics and is not supported`,node); break;
          case 'ProjectExtensions': break;
          default: report('JB4206', `Unsupported project element '${node.tag}'`,node);
        }
      } catch (error) { report('JB4207', error.message,node); }
    }
  }
  if (get('ImportDirectoryBuildProps').toLowerCase() !== 'false') {
    const file = get('DirectoryBuildPropsPath') ? normalizeWorkspacePath(get('DirectoryBuildPropsPath'),base) : nearest('Directory.Build.props');
    if (file) importFile(file,path);
  }
  importFile(path);
  if (get('ImportDirectoryBuildTargets').toLowerCase() !== 'false') {
    const file = get('DirectoryBuildTargetsPath') ? normalizeWorkspacePath(get('DirectoryBuildTargetsPath'),base) : nearest('Directory.Build.targets');
    if (file) importFile(file,path);
  }
  const targetFrameworks = list(get('TargetFrameworks'));
  if (targetFrameworks.length && !get('TargetFramework')) report('JB4208', 'Select targetFramework when the project declares TargetFrameworks');
  if (options.targetFramework && targetFrameworks.length && !targetFrameworks.includes(options.targetFramework)) report('JB4208', `Target framework '${options.targetFramework}' is not declared by this project`);

  function itemMap(kind) { let map = itemSets.get(kind); if (!map) itemSets.set(kind,map=new Map()); return map; }
  function addItem(kind, file, metadata = {}) {
    if (Array.from(itemSets.values()).reduce((n,m)=>n+m.size,0) >= maxItems) throw new Error('Project item budget exceeded');
    itemMap(kind).set(file,{ path:file, metadata, declaredIn:currentFile });
  }
  if (get('EnableDefaultItems').toLowerCase() !== 'false') {
    const excludes = list(get('DefaultItemExcludes')).map(p=>globMatcher(normalizeWorkspacePath(p,base)));
    for (const file of paths) {
      if (!file.startsWith(base) || /(^|\/)(obj|bin|node_modules|\.git)\//.test(file.slice(base.length)) || excludes.some(r=>r.test(file))) continue;
      if (file.endsWith('.cs') && get('EnableDefaultCompileItems').toLowerCase() !== 'false') addItem('Compile',file);
      else if (/\.(xaml|axaml)$/i.test(file) && get('EnableDefaultAvaloniaItems').toLowerCase() !== 'false') addItem('AvaloniaXaml',file);
    }
  }
  function metadataOf(node, file) {
    const result = {}, filename = file.split('/').at(-1), dot = filename.lastIndexOf('.');
    const wellKnown = { Identity:file, Filename:dot<0?filename:filename.slice(0,dot), Extension:dot<0?'':filename.slice(dot) };
    for (const [key,value] of Object.entries(node.attributes)) if (!['Include','Remove','Update','Exclude','Condition'].includes(key)) result[key] = expand(value);
    for (const child of childElements(node)) {
      if (!condition(child)) continue;
      const raw = textOf(child).replace(/%\((Identity|Filename|Extension)\)/g,(_,key)=>wellKnown[key]);
      result[child.tag] = expand(raw);
    }
    return result;
  }
  for (const group of pendingItems) withFile(group.file, () => {
    try { if (!condition(group.node)) return; } catch (e) { report('JB4207',e.message,group.node); return; }
    for (const node of childElements(group.node)) {
      activeNode = node;
      try {
        if (!condition(node)) continue;
        if (!itemKinds.has(node.tag)) throw new Error(`Unsupported item type '${node.tag}'`);
        const operations = ['Include','Remove','Update'].filter(k=>node.attributes[k] !== undefined);
        if (operations.length !== 1) throw new Error(`${node.tag} needs exactly one of Include, Remove, Update`);
        const op = operations[0], expressions = list(expand(node.attributes[op])), map = itemMap(node.tag);
        const isReference = node.tag === 'PackageReference' || node.tag === 'Reference';
        const excluded = list(expand(node.attributes.Exclude ?? '')).map(p=>globMatcher(normalizeWorkspacePath(p,base)));
        if (excluded.length && op !== 'Include') throw new Error('Exclude is supported only on Include items');
        for (const expression of expressions) {
          const pattern = isReference ? expression : normalizeWorkspacePath(expression,base), matcher = globMatcher(pattern);
          const candidates = isReference ? (op==='Include'?[pattern]:[...map.keys()]) : (op==='Include'?paths:[...map.keys()]);
          const matches = candidates.filter(p=>matcher.test(p)&&!excluded.some(r=>r.test(p)));
          if (!matches.length && op==='Include' && !isReference && !/[*?]/.test(pattern) && !excluded.some(r=>r.test(pattern))) report('JB4209', `Included file '${pattern}' is missing from the workspace`,node);
          for (const file of matches) {
            if (op==='Remove') map.delete(file);
            else if (op==='Update') map.get(file).metadata = {...map.get(file).metadata,...metadataOf(node,file)};
            else addItem(node.tag,file,metadataOf(node,file));
          }
        }
      } catch (error) { report('JB4210',error.message,node); }
    }
  });
  const items = Object.fromEntries([...itemSets].map(([kind,map])=>[kind,[...map.values()]]));
  const sources = [...new Set([...sourceKinds].flatMap(kind=>(items[kind]??[]).map(i=>i.path)).filter(isSource))].sort();
  const referenceItems = items.ProjectReference ?? [];
  const references = referenceItems.filter(i=>String(i.metadata.ReferenceOutputAssembly??'true').toLowerCase()!=='false').map(i=>i.path);
  for (const ref of referenceItems) if (['SetConfiguration','SetTargetFramework','AdditionalProperties','GlobalPropertiesToRemove'].some(k=>ref.metadata[k])) report('JB4211', `Per-reference global-property overrides are not yet supported: ${ref.path}`);
  const packages = (items.PackageReference??[]).map(i=>({ name:i.path, version:i.metadata.Version??null }));
  for (const pkg of packages) report('JB4010', `${pkg.name}: NuGet binaries/source generators are not loaded; only registered compatibility APIs can be used`,null,'warning');
  if (items.Reference?.length) report('JB4212','Binary assembly references are unsupported; provide source projects or runtime adapters');
  const symbols = new Set(list(get('DefineConstants')).flatMap(v=>v.split(/[ ,]+/)).filter(Boolean));
  // Explicit SDK-profile defaults, independent of the host platform.
  if (get('DefineTrace').toLowerCase() !== 'false') symbols.add('TRACE');
  if (get('Configuration').toLowerCase()==='debug' && get('DefineDebug').toLowerCase()!=='false') symbols.add('DEBUG');
  if (get('DisableImplicitFrameworkDefines').toLowerCase()!=='true') for(const symbol of frameworkSymbols(get('TargetFramework'))) symbols.add(symbol);
  for (const file of sources) sourceByFile.set(file,[...symbols].sort());
  return { success:!bag.hasErrors, path, sources, references, packages, items, imports,
    properties:Object.fromEntries([...props].filter(([k])=>!k.startsWith('msbuildthisfile')).map(([key,value])=>[propertyNames.get(key),value])),
    symbols:[...symbols].sort(), sourceSymbols:Object.fromEntries(sourceByFile),
    configuration:get('Configuration'), platform:get('Platform'), targetFramework:get('TargetFramework'), diagnostics:bag.items };
}

/** Merge symbols by physical file; conflicting linked-file profiles must not silently win. */
export function collectSourceSymbols(projects) {
  const sourceSymbols = {}, diagnostics = [];
  for (const project of projects) for (const file of project.sources) {
    const symbols = [...project.symbols].sort();
    if (sourceSymbols[file] && sourceSymbols[file].join('\0') !== symbols.join('\0')) diagnostics.push({code:'JB4213',severity:'error',message:`Linked source '${file}' has different conditional symbols across projects; separate assembly compilation is required`,file,line:1,column:1,offset:0});
    else sourceSymbols[file] = symbols;
  }
  return { sourceSymbols, diagnostics };
}
