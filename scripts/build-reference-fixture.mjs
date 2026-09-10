/** Execute only repository-owned C# fixtures. The CLR supplies independent expected values. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export async function buildReferenceFixture(output=path.join(root,'test-results/reference-clr')) {
  await fs.mkdir(output,{recursive:true});
  const run=args=>execFileSync('dotnet',args,{cwd:root,encoding:'utf8',env:{...process.env,DOTNET_NOLOGO:'1',DOTNET_CLI_TELEMETRY_OPTOUT:'1'}});
  const project=path.join(root,'tests/fixtures/reference-src/ReferenceLibrary.csproj');
  run(['build',project,'-c','Debug','-o',path.join(output,'debug')]);
  run(['build',project,'-c','Release','-o',path.join(output,'release')]);
  run(['pack',project,'-c','Release','-o',path.join(output,'packages')]);
  await fs.mkdir(path.join(output,'oracle'),{recursive:true});
  await fs.writeFile(path.join(output,'oracle/oracle.csproj'),'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework></PropertyGroup><ItemGroup><Reference Include="Jailbreak.ReferenceExamples"><HintPath>../release/Jailbreak.ReferenceExamples.dll</HintPath></Reference></ItemGroup></Project>');
  await fs.writeFile(path.join(output,'oracle/Program.cs'),`using ReferenceExamples;using System;using System.Text.Json;
Console.WriteLine(JsonSerializer.Serialize(new { Locals=Calculations.Locals(), Aliases=Calculations.Aliases(), OutValue=Calculations.OutValue(), Field=Calculations.Field(), StaticField=Calculations.StaticField(), Array=Calculations.Array(), Reference=Calculations.Reference(), Large=Calculations.Large().ToString(), Floating=Calculations.Floating(), Narrow=Calculations.Narrow(), Argument=Calculations.Argument(12), Finally=Calculations.Finally(), NullField=Calculations.NullField(), ArrayBounds=Calculations.ArrayBounds() }));`);
  const stdout=run(['run','--project',path.join(output,'oracle/oracle.csproj'),'-c','Release']);
  const oracle=JSON.parse(stdout.split('\n').findLast(line=>line.startsWith('{'))),files={};
  for(const name of ['debug/Jailbreak.ReferenceExamples.dll','debug/Jailbreak.ReferenceExamples.pdb','release/Jailbreak.ReferenceExamples.dll','release/Jailbreak.ReferenceExamples.pdb','packages/Jailbreak.ReferenceExamples.1.0.0.nupkg']) {
    const bytes=await fs.readFile(path.join(output,name));files[name]={base64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')};
  }
  const fixture={format:'owned-managed-reference-fixture-v1',source:await fs.readFile(path.join(root,'tests/fixtures/reference-src/Library.cs'),'utf8'),files,oracle};
  await fs.writeFile(path.join(output,'fixture.json'),JSON.stringify(fixture,null,2)+'\n');return {fixture,output};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const {fixture}=await buildReferenceFixture();console.log(JSON.stringify(fixture.oracle));
}
