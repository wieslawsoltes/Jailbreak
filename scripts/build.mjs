import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundleRuntime,bundleModules} from './bundle.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),site=path.join(root,'site');
await fs.rm(site,{recursive:true,force:true});await fs.mkdir(site,{recursive:true});
for(const [from,to]of [['apps/ide',''],['packages','packages'],['examples','examples'],['docs','docs']])await fs.cp(path.join(root,from),path.join(site,to),{recursive:true});
await fs.writeFile(path.join(site,'runtime.js'),await bundleRuntime(root));await fs.writeFile(path.join(site,'.nojekyll'),'');
const samples=[];for(const entry of await fs.readdir(path.join(root,'examples'),{withFileTypes:true})){if(!entry.isDirectory())continue;const files={};async function walk(dir,base=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){const relative=base+e.name;if(e.isDirectory())await walk(path.join(dir,e.name),relative+'/');else files[relative]=await fs.readFile(path.join(dir,e.name),'utf8');}}await walk(path.join(root,'examples',entry.name));samples.push({id:entry.name,title:entry.name.replace(/([a-z])([A-Z])/g,'$1 $2'),files});}
await fs.writeFile(path.join(site,'samples.json'),JSON.stringify(samples));
console.log(`Built site/ with ${samples.length} source workspaces and ${Math.round((await fs.stat(path.join(site,'runtime.js'))).size/1024)} KiB self-contained runtime.`);

// Also publish a fully offline workbench. It requires no CDNs, imports or fetches.
const worker=await bundleModules(site,'worker.js',{entryScript:true});
const app=await bundleModules(site,'app.js',{entryScript:true});
const assets={samples,runtime:await fs.readFile(path.join(site,'runtime.js'),'utf8'),worker};
const json=JSON.stringify(assets).replace(/</g,'\\u003c');
const css=await fs.readFile(path.join(site,'style.css'),'utf8');
const moduleHtml=await fs.readFile(path.join(site,'index.html'),'utf8');
await fs.writeFile(path.join(site,'index.module.html'),moduleHtml);
const offline=moduleHtml.replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+css+'</style>').replace('<script type="module" src="./app.js"></script>',()=>'<script>globalThis.__JailbreakAssets='+json+';</script><script>'+app.replace(/<\/script/gi,'<\\/script')+'</script>');
await fs.writeFile(path.join(site,'index.html'),offline);
console.log('Built offline-capable index.html ('+Math.round(offline.length/1024)+' KiB).');
