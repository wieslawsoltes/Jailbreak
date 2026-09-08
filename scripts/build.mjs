import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundleRuntime,bundleModules} from './bundle.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),site=path.join(root,'site');
await fs.rm(site,{recursive:true,force:true});await fs.mkdir(site,{recursive:true});
for(const [from,to]of [['apps/ide',''],['packages','packages'],['examples','examples'],['docs','docs'],['browser','browser']])await fs.cp(path.join(root,from),path.join(site,to),{recursive:true,filter:p=>!/(^|[/\\])(node_modules|dist|test-output|__pycache__)([/\\]|$)/.test(p)});
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

// Binary Studio uses the same MSIL frontend/runtime as the programmatic APIs.
await fs.cp(path.join(root,'apps/binary'),path.join(site,'binary'),{recursive:true});
const binaryWorker=await bundleModules(site,'binary/worker.js',{entryScript:true});
const binaryRuntime=await bundleModules(root,'packages/msil-runtime/index.js',{expose:{name:'createBinaryRuntime',export:'createBinaryRuntime'}});
const binaryApp=await bundleModules(site,'binary/app.js',{entryScript:true});
const binaryFixture=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/msil/fixture.json'),'utf8'));
const exceptionFixture=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/msil/exceptions.json'),'utf8'));
const binaryAssets={exceptionFixture,worker:binaryWorker,runtime:binaryRuntime,fixture:binaryFixture,samples:{exception:await fs.readFile(path.join(root,'examples-il/Exceptions.il'),'utf8'),il:await fs.readFile(path.join(root,'examples-il/Arithmetic.il'),'utf8'),loop:await fs.readFile(path.join(root,'examples-il/Loops.il'),'utf8')}};
const binaryHtml=await fs.readFile(path.join(site,'binary/index.html'),'utf8'),binaryCss=await fs.readFile(path.join(site,'binary/style.css'),'utf8');
await fs.writeFile(path.join(site,'binary/assets.json'),JSON.stringify(binaryAssets));
await fs.writeFile(path.join(site,'binary/index.module.html'),binaryHtml);
await fs.writeFile(path.join(site,'binary/index.html'),binaryHtml.replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+binaryCss+'</style>').replace('<script type="module" src="./app.js"></script>',()=>'<script>globalThis.__JailbreakBinaryAssets='+JSON.stringify(binaryAssets).replace(/</g,'\\u003c')+';</script><script>'+binaryApp.replace(/<\/script/gi,'<\\/script')+'</script>'));
await fs.mkdir(path.join(site,'binary/examples'),{recursive:true});
for(const [name,file]of Object.entries({...binaryFixture.files,...exceptionFixture.files}))await fs.writeFile(path.join(site,'binary/examples',name),Buffer.from(file.base64,'base64'));
await fs.cp(path.join(root,'examples-il'),path.join(site,'binary/examples/il'),{recursive:true});
console.log('Built Binary Studio, real DLL/nupkg fixtures, and offline binary runner.');
