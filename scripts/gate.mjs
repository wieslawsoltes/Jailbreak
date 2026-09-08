import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {compileProject} from '../packages/project-system/index.js';
import {parseXml} from '../packages/compiler-core/xml.js';
import {compileXaml} from '../packages/xaml-compiler/index.js';
import {parseCSharp} from '../packages/csharp-compiler/index.js';
import {createRuntime} from '../packages/avalonia-runtime/index.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),args=process.argv.slice(2);
const baseline=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/upstream.json'),'utf8'));
const report={schema:1,generatedAt:new Date().toISOString(),baseline,fixtureIntegrity:[],samples:[],browser:'Run tests/browser_smoke.py; its independent evidence is in browser.json.',fullControlCatalog:{status:'not-passing',reason:'Only selected unchanged pages have executable browser gates. Full project/template/platform compatibility is not implemented.'}};
let failed=false;
async function readFiles(dir,base='',files={}){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(['bin','obj','.git','node_modules'].includes(e.name))continue;const name=base+e.name;if(e.isDirectory())await readFiles(path.join(dir,e.name),name+'/',files);else if(/\.(cs|a?xaml|csproj|sln|slnx|md|txt)$/i.test(name)){if(Object.keys(files).length>3000)throw new Error('Gate source limit exceeded');files[name]=await fs.readFile(path.join(dir,e.name),'utf8');}}return files;}
for(const fixture of baseline.official.files){const bytes=await fs.readFile(path.join(root,fixture.local));const blob=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');const passed=blob===fixture.blob;report.fixtureIntegrity.push({...fixture,actual:blob,passed});if(!passed)failed=true;}
for(const entry of await fs.readdir(path.join(root,'examples'),{withFileTypes:true})){if(!entry.isDirectory())continue;const files=await readFiles(path.join(root,'examples',entry.name));const compiled=compileProject(files),item={name:entry.name,compiled:compiled.success,hydrated:false,browserBehavior:'separate browser gate',statistics:compiled.stats,diagnostics:compiled.diagnostics};
  // Execute only the version-controlled, trusted positive examples. Never execute imported upstream code here.
  if(compiled.success)try{const api=createRuntime();new Function('JB',compiled.code)(api);const instance=api.createFromXaml(compiled.manifest.entryXaml);item.hydrated=true;instance.Dispose();}catch(e){item.error=e.message;}
  if(!item.compiled||!item.hydrated)failed=true;report.samples.push(item);
}
const at=args.indexOf('--upstream');
if(at>=0){if(!args[at+1])throw new Error('--upstream requires a checked-out Avalonia repository directory');const checkout=path.resolve(args[at+1]);const commit=execFileSync('git',['-C',checkout,'rev-parse','HEAD'],{encoding:'utf8'}).trim();if(commit!==baseline.official.commit)throw new Error(`Upstream checkout is not pinned to ${baseline.official.commit}`);
  const files=await readFiles(path.join(checkout,'samples/ControlCatalog')),inventory=[];
  for(const [file,text]of Object.entries(files)){if(/\.a?xaml$/i.test(file)){const xml=parseXml(text,file),xaml=compileXaml(text,{path:file});inventory.push({file,kind:'xaml',xmlParsed:!xml.diagnostics.some(d=>d.severity==='error'),isolatedXamlCompiled:xaml.success,diagnostics:xaml.diagnostics});}else if(file.endsWith('.cs')){const cs=parseCSharp(text,file);inventory.push({file,kind:'csharp',parsed:!!cs.ast,diagnostics:cs.diagnostics});}}
  report.upstreamInventory={commit,mode:'Isolated source inventory, not a linked project build, execution test or behavioral pass.',files:inventory,counts:{xaml:inventory.filter(x=>x.kind==='xaml').length,csharp:inventory.filter(x=>x.kind==='csharp').length,xmlParsed:inventory.filter(x=>x.xmlParsed).length,isolatedXamlCompiled:inventory.filter(x=>x.isolatedXamlCompiled).length,csharpParsed:inventory.filter(x=>x.parsed).length}};
}
report.supportedProfilePassed=!failed;
await fs.mkdir(path.join(root,'test-results'),{recursive:true});
await fs.writeFile(path.join(root,'test-results/gate.json'),JSON.stringify(report,null,2)+'\n');
console.log(`${report.samples.filter(x=>x.compiled&&x.hydrated).length}/${report.samples.length} trusted examples compile and hydrate; ${report.fixtureIntegrity.filter(x=>x.passed).length}/${report.fixtureIntegrity.length} upstream source hashes match.`);
if(report.upstreamInventory)console.log(JSON.stringify(report.upstreamInventory.counts));
console.log('Full ControlCatalog: NOT PASSING. Requested Avalonialibrary: BLOCKED (recorded 404).');
if(failed||args.includes('--require-full'))process.exitCode=1;
