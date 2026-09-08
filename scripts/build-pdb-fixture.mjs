/** Build only repository-owned source and read independent .NET metadata/CLR results. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd(),out=path.resolve(process.argv[2]??'test-results/pdb-clr');
await fs.mkdir(out,{recursive:true});
const run=args=>execFileSync('dotnet',args,{cwd:root,stdio:'inherit',timeout:180000,env:{...process.env,DOTNET_NOLOGO:'1',DOTNET_CLI_TELEMETRY_OPTOUT:'1'}});
run(['build','tests/fixtures/pdb-src/PdbExamples.csproj','-c','Debug','-o',path.join(out,'lib')]);
run(['pack','tests/fixtures/pdb-src/PdbExamples.csproj','-c','Debug','-o',path.join(out,'packages')]);
run(['run','--project','tests/fixtures/pdb-src/oracle/Oracle.csproj','-c','Debug','--',out]);
const names=['Jailbreak.PdbExamples.dll','Jailbreak.PdbExamples.pdb'];const files={};
for(const name of names){const b=await fs.readFile(path.join(out,'lib',name));files[name]={base64:b.toString('base64'),sha256:createHash('sha256').update(b).digest('hex')};}
const name='Jailbreak.PdbExamples.1.0.0.nupkg',b=await fs.readFile(path.join(out,'packages',name));files[name]={base64:b.toString('base64'),sha256:createHash('sha256').update(b).digest('hex')};
const oracle=JSON.parse(await fs.readFile(path.join(out,'oracle.json'),'utf8'));
await fs.writeFile(path.join(out,'fixture.json'),JSON.stringify({files,oracle,source:await fs.readFile('tests/fixtures/pdb-src/Calculations.cs','utf8')},null,2)+'\n');
