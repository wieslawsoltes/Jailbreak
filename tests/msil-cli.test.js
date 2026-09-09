import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const cli=(...args)=>spawnSync(process.execPath,[path.join(root,'scripts/compile-binary.mjs'),...args],{cwd:root,encoding:'utf8',timeout:20000});
const fixture=async name=>JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/msil',name+'.json'),'utf8'));
async function temp(fn){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jailbreak-cli-'));try{await fn(dir);}finally{await fs.rm(dir,{recursive:true,force:true});}}
test('CLI emits native and cooperative symbols, release strips them, no input methods run',async()=>temp(async dir=>{
  const input=path.join(dir,'NeverRun.il'),out=path.join(dir,'app');
  await fs.writeFile(input,'.assembly NeverRun {} .class public NeverRun.C { .method public static void Infinite() cil managed { again: br.s again } }');
  let r=cli(input,'--cooperative','--out',out);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/No input methods were executed/);
  let manifest=JSON.parse(await fs.readFile(out+'.json','utf8'));assert.equal(manifest.debug.cooperative,true);assert.equal(manifest.debug.sources[input],await fs.readFile(input,'utf8'));
  assert.match(await fs.readFile(out+'.html','utf8'),/binary-debugger/);assert.match(await fs.readFile(out+'.js','utf8'),/function\*/);
  r=cli(input,'--out',out);assert.equal(r.status,0,r.stderr);manifest=JSON.parse(await fs.readFile(out+'.json','utf8'));assert.equal(manifest.debug,undefined);
  assert.doesNotMatch(await fs.readFile(out+'.html','utf8'),/sourceMappingURL=data:|root.id='binary-debugger'/);
}));
test('CLI DLL/PDB and NuGet conversions share verified original-source and continuation APIs',async()=>temp(async dir=>{
  const f=await fixture('pdb'),files=[];
  for(const [name,v]of Object.entries(f.files)){const p=path.join(dir,name);await fs.writeFile(p,Buffer.from(v.base64,'base64'));files.push(p);}
  const out=path.join(dir,'library');let r=cli(...files.filter(p=>/\.(dll|pdb)$/.test(p)),'--cooperative','--out',out);assert.equal(r.status,0,r.stderr);
  let result=JSON.parse(await fs.readFile(out+'.json','utf8'));assert.equal(result.debug.cooperative,true);assert.ok(Object.values(result.debug.sources).includes(f.source));
  r=cli(files.find(p=>p.endsWith('.nupkg')),'--cooperative','--tfm','net8.0','--out',out);assert.equal(r.status,0,r.stderr);result=JSON.parse(await fs.readFile(out+'.json','utf8'));assert.equal(result.debug.cooperative,true);
  r=cli(...files.filter(p=>/\.(dll|pdb)$/.test(p)),'--debug','--out',out);assert.equal(r.status,0,r.stderr);assert.doesNotMatch(await fs.readFile(out+'.js','utf8'),/function\*/);
}));
test('CLI invalid IL deletes stale runnable artifacts and rejects unknown options',async()=>temp(async dir=>{
  const input=path.join(dir,'Invalid.il'),out=path.join(dir,'app');await fs.writeFile(input,'invalid source');
  for(const ext of ['js','html','runtime.js'])await fs.writeFile(out+'.'+ext,'must be removed');
  const r=cli(input,'--cooperative','--out',out);assert.equal(r.status,1);const report=JSON.parse(await fs.readFile(out+'.json','utf8'));assert.equal(report.success,false);
  for(const ext of ['js','html','runtime.js'])await assert.rejects(fs.access(out+'.'+ext));
  assert.equal(cli(input,'--invented-option').status,1);
}));
