/** Derive the example from repository-owned, SDK-built package bytes. No network. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileWorkspaceInputs, encodeBinaryFile} from '../packages/binary-project/workspace.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/msil/pdb.json'),'utf8'));
const name='Jailbreak.PdbExamples.1.0.0.nupkg';
const destination=path.join(root,'examples/PdbLibrary');
const files={};
for(const file of ['MainView.axaml','MainView.axaml.cs','PdbLibrary.csproj'])files[file]=await fs.readFile(path.join(destination,file),'utf8');
files['library.binary.json']=encodeBinaryFile(name,Buffer.from(fixture.files[name].base64,'base64'));
const result=await compileWorkspaceInputs(files,{debug:true,targetFramework:'net8.0'});
if(!result.success||!result.debug?.sites?.some(p=>p.origin==='msil')||!Object.keys(result.debug.sources??{}).length)throw new Error('Fixture must produce verified source symbols: '+JSON.stringify(result.diagnostics));
await fs.writeFile(path.join(destination,'library.binary.json'),files['library.binary.json']+'\n');
console.log(`Generated PdbLibrary with ${result.debug.sites.filter(p=>p.origin==='msil').length} verified IL sequence points.`);
