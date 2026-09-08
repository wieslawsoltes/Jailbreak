/** Fresh .NET oracle against AOT JS. Execute only this repository's owned fixtures. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { compileAssembly } from '../packages/msil-compiler/verified.js';
import { convertNuget } from '../packages/nuget/index.js';
import { createBinaryRuntime } from '../packages/msil-runtime/index.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),out=path.join(root,'test-results/msil-clr'),project=path.join(root,'tests/fixtures/msil-src/BinaryLibrary.csproj');
await fs.mkdir(out,{recursive:true});
const run=args=>execFileSync('dotnet',args,{cwd:root,encoding:'utf8',env:{...process.env,DOTNET_NOLOGO:'1',DOTNET_CLI_TELEMETRY_OPTOUT:'1'}});
run(['build',project,'-c','Release','-o',path.join(out,'lib')]);run(['pack',project,'-c','Release','-o',path.join(out,'packages')]);
await fs.mkdir(path.join(out,'oracle'),{recursive:true});
await fs.writeFile(path.join(out,'oracle/oracle.csproj'),'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework></PropertyGroup><ItemGroup><Reference Include="Jailbreak.BinaryExamples"><HintPath>../lib/Jailbreak.BinaryExamples.dll</HintPath></Reference></ItemGroup></Project>');
await fs.writeFile(path.join(out,'oracle/Program.cs'),`using BinaryExamples;using System;using System.Text.Json;
Console.WriteLine(JsonSerializer.Serialize(new { Add=Calculator.Add(40,2), Multiply=Calculator.Multiply(123456,654321), Sum=Calculator.SumTo(100), Factorial=Calculator.Factorial(6), Choice=Calculator.Choose(2), Sequence=Calculator.Sequence(5), Scale=Calculator.Scale(2.5,3), Greeting=Calculator.Greet("browser"), Counter=Calculator.UseCounter(10), State1=State.Next(), State2=State.Next(), Virtual=new NamedCounter(1).Describe() }));`);
const stdout=run(['run','--project',path.join(out,'oracle/oracle.csproj'),'-c','Release']),oracle=JSON.parse(stdout.split('\n').findLast(s=>s.startsWith('{')));
const bytes=await fs.readFile(path.join(out,'lib/Jailbreak.BinaryExamples.dll')),packageBytes=await fs.readFile(path.join(out,'packages/Jailbreak.BinaryExamples.1.0.0.nupkg'));
const reports=[];for(const [kind,compiled]of [['DLL',compileAssembly(bytes)],['NuGet',await convertNuget(packageBytes,{targetFramework:'net8.0'})]]){
 assert.equal(compiled.success,true,JSON.stringify(compiled.diagnostics));const MS=createBinaryRuntime();new Function('MS',compiled.code)(MS);
 const C=MS.getType('Jailbreak.BinaryExamples','BinaryExamples.Calculator'),State=MS.getType('Jailbreak.BinaryExamples','BinaryExamples.State'),Named=MS.getType('Jailbreak.BinaryExamples','BinaryExamples.NamedCounter');
 const actual={Add:C.Add(40,2),Multiply:C.Multiply(123456,654321),Sum:C.SumTo(100),Factorial:C.Factorial(6),Choice:C.Choose(2),Sequence:C.Sequence(5),Scale:C.Scale(2.5,3),Greeting:C.Greet('browser'),Counter:C.UseCounter(10),State1:State.Next(),State2:State.Next(),Virtual:new Named(1).Describe()};assert.deepEqual(actual,oracle);reports.push({kind,methods:compiled.stats.methods,actual});
}
await fs.writeFile(path.join(out,'comparison.json'),JSON.stringify({oracle,reports,passed:true},null,2)+'\n');console.log('Fresh SDK DLL and nupkg each match all 12 independently executed CLR results.');
