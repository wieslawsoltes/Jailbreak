/** Recover three immutable, previously uploaded editor/designer source patches.
 * Run in a clean full checkout. It writes ordinary source commits, not runtime
 * payloads, and refuses conflicts, unrecognized payloads, and unsafe file modes.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseline = '20aaca0c26670bce1be5c5e52f56b7021e028ec8';
const blobs = [
  '8858197a967f06045cb91b12d41b9a2bc5b3fc71',
  'bdbb37390aa33f3c2d8a04471d45c4d872ede230',
  'a38c98c862f902db0290bddcfc5efe21a2cbe5ac'
];
const ledgerPath = path.join(root, 'integration/desktop-recovery-applied.json');
const evidenceDir = path.join(root, 'test-results/desktop-reconciliation');
fs.mkdirSync(evidenceDir, {recursive:true});
const report = {baseline, observedHead:null, patches:[], completed:false};
function command(program, args, {allowFailure=false, input}={}) {
  const result=spawnSync(program,args,{cwd:root,encoding:'utf8',input,timeout:120000,maxBuffer:20*1024*1024});
  if(result.error)throw result.error;
  if(result.status!==0&&!allowFailure)throw new Error(program+' '+args.slice(0,3).join(' ')+': '+(result.stderr||result.stdout||'failed').slice(0,3000));
  return result;
}
const git=(...args)=>command('git',args).stdout.trim();
const check=(...args)=>command('git',args,{allowFailure:true}).status===0;
function permitted(name){return !name.includes('\\')&&!name.split('/').includes('..')&&(name==='README.md'||/^(packages|apps|tests|docs|examples)\//.test(name));}
function validateIndex() {
  if(git('diff','--name-only','--diff-filter=U'))throw new Error('Unresolved source conflict; no publication permitted');
  const changes=git('diff','--cached','--name-only','-z').split('\0').filter(Boolean);
  if(!changes.length)throw new Error('Patch did not produce source changes');
  for(const name of changes){
    if(!permitted(name))throw new Error('Patch changes an unapproved path: '+name);
    const row=git('ls-files','--stage','--',name);
    if(row&&!/^(100644|100755) /.test(row))throw new Error('Only ordinary source files may be recovered: '+name);
  }
  return changes;
}
try {
  report.observedHead=git('rev-parse','HEAD');
  if(!check('merge-base','--is-ancestor',baseline,'HEAD'))throw new Error('Current checkout does not descend from the verified constructor baseline');
  if(!check('diff','--quiet')||!check('diff','--cached','--quiet'))throw new Error('Tracked source/index must be clean before recovery');
  const ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')):{};
  for(const sha of blobs){
    if(ledger[sha]){report.patches.push({sha,status:'previously-recorded',record:ledger[sha]});continue;}
    const response=command('gh',['api','repos/wieslawsoltes/Jailbreak/git/blobs/'+sha]).stdout;
    const blob=JSON.parse(response);
    if(blob.sha!==sha||blob.encoding!=='base64'||typeof blob.content!=='string')throw new Error('Unexpected Git blob response: '+sha);
    const data=Buffer.from(blob.content.replace(/\s/g,''),'base64');
    if(data.length>1000000||createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex')!==sha)throw new Error('Source blob integrity/size check failed: '+sha);
    const text=new TextDecoder('utf-8',{fatal:true}).decode(data);
    if(!text.startsWith('diff --git ')||text.includes('GIT binary patch'))throw new Error('Recovery payload is not a readable source diff: '+sha);
    const file=path.join(evidenceDir,sha+'.patch');fs.writeFileSync(file,data);
    const receipt={sha,sha256:createHash('sha256').update(data).digest('hex'),before:git('rev-parse','HEAD')};
    if(check('apply','--reverse','--check',file)){
      receipt.status='already-present';ledger[sha]=receipt;report.patches.push(receipt);continue;
    }
    if(check('apply','--check','--index',file))git('apply','--index',file);
    else {
      const applied=command('git',['apply','--3way','--index',file],{allowFailure:true});
      fs.writeFileSync(path.join(evidenceDir,sha+'.merge.log'),applied.stdout+'\n'+applied.stderr);
      if(applied.status!==0)throw new Error('Three-way source reconciliation failed for '+sha+'; inspect retained patch/merge evidence');
    }
    receipt.files=validateIndex();receipt.status='integrated';ledger[sha]=receipt;
    fs.mkdirSync(path.dirname(ledgerPath),{recursive:true});fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
    git('add','--','integration/desktop-recovery-applied.json');
    git('commit','-m','feat(ide): reconcile preserved editor and Grid designer stage '+sha.slice(0,8));
    receipt.after=git('rev-parse','HEAD');report.patches.push(receipt);
  }
  const next=JSON.stringify(ledger,null,2)+'\n';
  if(!fs.existsSync(ledgerPath)||fs.readFileSync(ledgerPath,'utf8')!==next){
    fs.mkdirSync(path.dirname(ledgerPath),{recursive:true});fs.writeFileSync(ledgerPath,next);
    git('add','--','integration/desktop-recovery-applied.json');
    if(!check('diff','--cached','--quiet'))git('commit','-m','build: record already integrated editor and designer patches');
  }
  report.testedCandidate=git('rev-parse','HEAD');report.completed=true;
} catch(error) {
  report.error=error.message;process.exitCode=1;
} finally {
  fs.writeFileSync(path.join(evidenceDir,'reconciliation.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
