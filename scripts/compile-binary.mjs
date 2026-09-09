#!/usr/bin/env node
/** Conversion-only CLI: input application methods are never invoked here. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileBinaryInputs } from '../packages/msil-compiler/debug.js';
import { compileIL } from '../packages/msil-compiler/verified.js';
import { convertNugetPackages } from '../packages/nuget/index.js';
import { createBinaryApplicationHtml } from '../packages/msil-runtime/export.js';
import { bundleModules } from './bundle.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function main(){
 const argv=process.argv.slice(2),inputs=[];let out='converted-library',targetFramework,debug=false,cooperativeDebug=false;
 for(let i=0;i<argv.length;i++){const value=argv[i];if(value==='--debug')debug=true;else if(value==='--cooperative'){debug=true;cooperativeDebug=true;}else if(value==='--out'||value==='--tfm'){if(!argv[i+1])throw new Error('Missing value for '+value);if(value==='--out')out=argv[++i];else targetFramework=argv[++i];}else if(value.startsWith('--'))throw new Error('Unknown option '+value);else inputs.push(value);}
 if(!inputs.length)throw new Error('Usage: node scripts/compile-binary.mjs file.il | library.dll [...] | package.nupkg [...] [--tfm net8.0] [--debug | --cooperative] [--out path/prefix]');
 if(inputs.length>32)throw new Error('At most 32 input files');
 let totalBytes=0;
 const files=await Promise.all(inputs.map(async name=>{const stat=await fs.stat(name);if(!stat.isFile()||(totalBytes+=stat.size)>32*1024*1024)throw new Error('Input files exceed 32 MiB or are not regular files: '+name);return {path:name,bytes:new Uint8Array(await fs.readFile(name))};}));
 const options={targetFramework,debug,cooperativeDebug};
 let result;if(files.length===1&&/\.il$/i.test(inputs[0]))result=compileIL(new TextDecoder().decode(files[0].bytes),{...options,path:inputs[0]});
 else if(inputs.every(n=>/\.(dll|exe|pdb|cs)$/i.test(n)))result=await compileBinaryInputs(files,options);
 else if(inputs.every(n=>/\.nupkg$/i.test(n)))result=await convertNugetPackages(files,options);
 else throw new Error('Supply one IL source file, managed assemblies with adjacent symbols/source, or NuGet packages; do not mix input formats');
 await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true});const {code,...manifest}=result;
 await fs.writeFile(out+'.json',JSON.stringify(manifest,null,2)+'\n');
 for(const d of result.diagnostics)console.error(`${d.severity} ${d.code} ${d.file??''}: ${d.message}`);
 if(!result.success){await fs.rm(out+'.js',{force:true});await fs.rm(out+'.html',{force:true});await fs.rm(out+'.runtime.js',{force:true});process.exitCode=1;return;}
 const runtime=await bundleModules(root,'packages/msil-runtime/index.js',{expose:{name:'createBinaryRuntime',export:'createBinaryRuntime'}});
 await fs.writeFile(out+'.js',code);await fs.writeFile(out+'.runtime.js',runtime);await fs.writeFile(out+'.html',createBinaryApplicationHtml(result,runtime));
 console.log(`Converted ${result.stats.methods} methods in ${result.stats.assemblies} assemblies. Wrote ${out}.{js,runtime.js,json,html}. No input methods were executed.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
