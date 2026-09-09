/** Apply readable source patches as ordinary Git commits. No encoded source or eval. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||r.stdout||'git failed');return r.stdout.trim();};
const series=JSON.parse(fs.readFileSync(path.join(root,'integration/series.json'),'utf8'));
const statePath=path.join(root,'integration/applied.json');
const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):{};
if(!Array.isArray(series)||series.length>100)throw new Error('Invalid integration series');
for(const item of series){
  if(!/^[0-9]{3}-[a-z0-9-]+\.patch$/.test(item.patch)||!/^([a-f0-9]{64})$/.test(item.sha256)||typeof item.message!=='string'||item.message.length>200)throw new Error('Invalid source patch manifest');
  if(state[item.patch]===item.sha256)continue;
  if(state[item.patch])throw new Error('An applied source patch cannot be silently replaced');
  const file=path.join(root,'integration',item.patch);if(fs.lstatSync(file).isSymbolicLink())throw new Error('Patch must be an ordinary file');
  const data=fs.readFileSync(file);if(data.length>1000000||createHash('sha256').update(data).digest('hex')!==item.sha256)throw new Error('Patch transport checksum failed: '+item.patch);
  if(git('diff','--cached','--name-only'))throw new Error('Index must be clean before source integration');
  git('apply','--check','--index',file);git('apply','--index',file);
  const changed=git('diff','--cached','--name-only').split('\n').filter(Boolean);
  if(!changed.length||changed.some(n=>n!=='README.md'&&! /^(packages|apps|tests|docs|examples)\//.test(n)))throw new Error('Reviewed changes may only affect application source, tests and documentation');
  state[item.patch]=item.sha256;fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');git('add','--','integration/applied.json');
  git('commit','-m',item.message);
  console.log('Integrated',item.patch,git('rev-parse','HEAD'));
}
