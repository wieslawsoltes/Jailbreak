/** Build and execute only repository-owned fixtures; compare fresh CLR/DLL/NuGet behavior. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {compileAssembly, readAssembly} from '../packages/msil-compiler/verified.js';
import {convertNuget} from '../packages/nuget/index.js';
import {createBinaryRuntime} from '../packages/msil-runtime/index.js';
import {exceptionCases,exceptionCasesAsync} from '../tests/helpers/exception-cases.js';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out=path.join(root,'test-results/exceptions-clr');
const project=path.join(root,'tests/fixtures/exception-src/ExceptionLibrary.csproj');
const oracleProject=path.join(root,'tests/fixtures/exception-src/oracle/Oracle.csproj');
await fs.mkdir(out,{recursive:true});
const run=args=>execFileSync('dotnet',args,{cwd:root,encoding:'utf8',timeout:180000,
  env:{...process.env,DOTNET_NOLOGO:'1',DOTNET_CLI_TELEMETRY_OPTOUT:'1'}});
run(['build',project,'-c','Release','-o',path.join(out,'lib')]);
run(['pack',project,'-c','Release','-o',path.join(out,'packages')]);
run(['run','--project',oracleProject,'-c','Release','--',out]);
const oracle=JSON.parse(await fs.readFile(path.join(out,'oracle.json'),'utf8'));
const regions=JSON.parse(await fs.readFile(path.join(out,'regions.json'),'utf8'));
assert.equal(oracle.length,35,'The independent CLR oracle must run every expected case');
const bytes=await fs.readFile(path.join(out,'lib/Jailbreak.ExceptionExamples.dll'));
const packageBytes=await fs.readFile(path.join(out,'packages/Jailbreak.ExceptionExamples.1.0.0.nupkg'));
const model=readAssembly(bytes);
assert.deepEqual(model.methods.map(m=>({method:m.name,token:m.token,
  clauses:m.body.exceptionClauses.map(c=>({...c,catchType:c.catchType?.name??null}))})),regions);
const reports=[];
for(const [kind,compiled] of [['DLL',compileAssembly(bytes)],['NuGet',await convertNuget(packageBytes,{targetFramework:'net8.0'})],['Cooperative DLL',compileAssembly(bytes,{debug:true,cooperativeDebug:true})],['Cooperative NuGet',await convertNuget(packageBytes,{targetFramework:'net8.0',debug:true,cooperativeDebug:true})]]){
  assert.equal(compiled.success,true,JSON.stringify(compiled.diagnostics));
  const MS=createBinaryRuntime();new Function('MS',compiled.code)(MS);
  const Type=MS.getType('Jailbreak.ExceptionExamples','ExceptionExamples.Recovery');
  const co=compiled.debug?.cooperative?MS.createDebugger():null;
  const actual=co?await exceptionCasesAsync(new Proxy({}, {get:(_,name)=>(...args)=>co.start(Type,name,args).promise})):exceptionCases(Type);
  co?.dispose();
  assert.deepEqual(actual,oracle,`${kind} exception values, types, identity and cleanup order must match CLR`);
  reports.push({kind,methods:compiled.stats.methods,cases:actual.length,actual});
}
const sha256=data=>createHash('sha256').update(data).digest('hex');
await fs.writeFile(path.join(out,'comparison.json'),JSON.stringify({passed:true,
  dllSha256:sha256(bytes),packageSha256:sha256(packageBytes),metadataMatches:true,oracle,reports},null,2)+'\n');
console.log(`Fresh SDK DLL/NuGet and both cooperative conversions each match all ${oracle.length} CLR exception/checked-arithmetic cases and exception metadata.`);
