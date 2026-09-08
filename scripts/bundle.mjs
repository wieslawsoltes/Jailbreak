import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
/** Build-only bundler for our authored modules. C# uses its own tokenizer and AST. */
export async function bundleModules(root,entry,{expose=null,entryScript=false}={}) {
  root=path.resolve(root);const visited=new Set(),output=[];
  const moduleId=file=>path.relative(root,file).replaceAll('\\','/');
  async function visit(file){file=path.resolve(file);if(visited.has(file))return;visited.add(file);let source=await fs.readFile(file,'utf8');
    const bindings=new Set();
    const imports=[...source.matchAll(/^(?:import|export)\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm)];
    for(const match of imports){const dependency=path.resolve(path.dirname(file),match[2]);if(!dependency.startsWith(root+path.sep))throw new Error('Bundle dependency leaves source tree');await visit(dependency);const spec=match[1].trim(),id=moduleId(dependency);let declaration;if(spec.startsWith('* as ')){bindings.add(spec.slice(5));declaration=`const ${spec.slice(5)}=__modules[${JSON.stringify(id)}];`;}else if(spec.startsWith('{')){const items=spec.slice(1,-1).split(',').map(x=>x.trim()).filter(Boolean).filter(item=>{const local=item.split(/\s+as\s+/).at(-1);if(bindings.has(local))return false;bindings.add(local);return true;});declaration=items.length?`const {${items.join(',').replace(/\bas\b/g,':')}}=__modules[${JSON.stringify(id)}];`:'';}else throw new Error('Unsupported authored import: '+spec);source=source.replace(match[0],declaration);}
    const isEntry=path.resolve(root,entry)===file,exports=entryScript&&isEntry?[]:Object.keys(await import(pathToFileURL(file).href));
    source=source.replace(/^export\s+(?=(?:async\s+)?(?:class|function|const|let|var)\b)/gm,'');
    if(/^export\s/m.test(source))throw new Error('Unsupported authored export in '+file);
    if(entryScript&&isEntry)source=source.replaceAll('import.meta.url','document.baseURI');
    output.push(`__modules[${JSON.stringify(moduleId(file))}]=(()=>{\n${source}\nreturn {${exports.join(',')}};\n})();`);
  }
  await visit(path.join(root,entry));
  return `/* Jailbreak - MIT. Generated from reusable ES modules. */\n(()=>{\n'use strict';\nconst __modules=Object.create(null);\n${output.join('\n')}\n${expose?`globalThis.${expose.name}=__modules[${JSON.stringify(entry)}].${expose.export};`:''}\n})();\n`;
}
export function bundleRuntime(root){return bundleModules(root,'packages/avalonia-runtime/index.js',{expose:{name:'Jailbreak',export:'JB'}});}
