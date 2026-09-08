import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let checked=0;
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(/\.(m?js)$/.test(file)){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||`Syntax check failed: ${file}`);checked++;}}}
for(const folder of ['packages','apps','scripts','tests'])await walk(path.join(root,folder));
for(const siteFile of ['site/index.html','site/binary/index.html'])try {
  const html=await fs.readFile(path.join(root,siteFile),'utf8');let inline=0;
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/gi)){new vm.Script(match[1],{filename:`offline-inline-${++inline}.js`});}
  if(inline!==2)throw new Error(`Offline IDE must contain two complete script blocks, found ${inline}`);
  console.log(`Validated ${inline} offline script blocks without executing them.`);
}catch(e){if(e.code!=='ENOENT')throw e;console.log('Offline build not present; run npm run build to validate generated scripts.');}
console.log(`Syntax checked ${checked} authored JavaScript modules.`);
