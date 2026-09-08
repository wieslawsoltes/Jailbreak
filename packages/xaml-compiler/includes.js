import { SourceFile, DiagnosticBag } from '../compiler-core/index.js';
import { normalizeWorkspacePath, directory } from '../build-profile/paths.js';
/** All includes resolve at link time against selected workspace documents, never the network. */
export function linkXamlIncludes(documents,{assemblies={},maxDepth=64}={}){
  const byPath=new Map(documents.map(d=>[d.path,d])),bag=new DiagnosticBag(),edges=new Map(),dependencies=[];
  function resolve(value,from){
    if(typeof value!=='string'||!value||/[?#\0]/.test(value))throw new Error('Include Source must be a literal URI without query or fragment');
    let source=decodeURIComponent(value).replace(/\\/g,'/'),base=directory(from);
    const roots=Object.values(assemblies).filter(p=>from.startsWith(p)).sort((a,b)=>b.length-a.length),root=roots[0]??'';
    if(source.startsWith('avares://')){const m=/^avares:\/\/([^/]+)\/(.*)$/.exec(source);if(!m||!Object.hasOwn(assemblies,m[1]))throw new Error('Unknown avares assembly in '+value);base=assemblies[m[1]];source=m[2];}
    else if(source.startsWith('/')){base=root;source=source.slice(1);}
    else if(/^[a-z][a-z\d+.-]*:/i.test(source))throw new Error('External include schemes are forbidden');
    const path=normalizeWorkspacePath(source,base);if(!byPath.has(path))throw new Error(`Included XAML '${path}' is not selected in this build`);return path;
  }
  for(const document of documents){const list=[];edges.set(document.path,list);const visit=node=>{if(!node)return;
    if(node.type==='StyleInclude'||node.type==='ResourceInclude'){
      try{const path=resolve(node.attributes.Source,document.path),included=byPath.get(path),allowed=node.type==='StyleInclude'?['Style','Styles']:['ResourceDictionary'];
        if(!allowed.includes(included.root?.type))throw new Error(`${node.type} cannot include a ${included.root?.type??'missing'} root`);
        node.includePath=path;list.push({path,node});dependencies.push({from:document.path,to:path,kind:node.type});
      }catch(e){bag.add('JB1120',e.message,new SourceFile(document.path,document.sourceText??''),node.span?.start??0);}
    }
    for(const child of node.children??[])visit(child);
  };visit(document.root);}
  const done=new Set(),stack=[];
  function visit(path){if(done.has(path))return;stack.push(path);for(const edge of edges.get(path)??[]){if(stack.includes(edge.path)||stack.length>maxDepth){bag.add('JB1121','Cyclic or over-deep XAML include: '+[...stack,edge.path].join(' -> '),new SourceFile(path,byPath.get(path).sourceText??''),edge.node.span?.start??0);continue;}visit(edge.path);}stack.pop();done.add(path);}
  for(const path of byPath.keys())visit(path);
  return {success:!bag.hasErrors,diagnostics:bag.items,dependencies};
}
