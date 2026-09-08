import test from 'node:test';
import assert from 'node:assert/strict';
import { compileProject } from '../packages/project-system/index.js';
import { compileWorkspace } from '../browser/packages/project/index.js';
import { createRuntime } from '../packages/avalonia-runtime/index.js';
const files={
 'Directory.Build.props':'<Project><PropertyGroup><DefineConstants>$(DefineConstants);BROWSER</DefineConstants></PropertyGroup></Project>',
 'App/App.csproj':'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup><ItemGroup><Compile Remove="Native.cs"/><Compile Remove="DebugOnly.cs" Condition="\'$(Configuration)\' == \'Release\'"/></ItemGroup></Project>',
 'App/Main.axaml':'<UserControl xmlns="https://github.com/avaloniaui" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" x:Class="Demo.Main"><TextBlock x:Name="Status"/></UserControl>',
 'App/Main.axaml.cs':'using Avalonia.Controls;\nnamespace Demo;\npublic partial class Main : UserControl {\npublic Main() { InitializeComponent();\n#if DEBUG && BROWSER && NET8_0\nStatus.Text = "Debug browser";\n#elif BROWSER && NET8_0\nStatus.Text = "Release browser";\n#else\n#error Wrong profile\n#endif\n}\n}',
 'App/Native.cs':'unsafe native platform code',
 'App/DebugOnly.cs':'public class DebugDiagnostics {}'
};
for(const configuration of ['Debug','Release']) test(`both project systems compile the ${configuration} profile; root runtime hydrates it`,()=>{
 const a=compileProject(files,{configuration}),b=compileWorkspace(files,{configuration});
 assert.equal(a.success,true,JSON.stringify(a.diagnostics));assert.equal(b.ok,true,JSON.stringify(b.diagnostics));
 const JB=createRuntime();new Function('JB',a.code)(JB);const root=new (JB.types.get('Demo.Main'))();
 assert.equal(root.Status.Text,`${configuration} browser`);root.Dispose();
 assert.equal(a.files.includes('App/DebugOnly.cs'),configuration==='Debug');assert.equal(b.files.includes('App/DebugOnly.cs'),configuration==='Debug');
 assert.equal(a.manifest.profile.configuration,configuration);assert.ok(a.buildProfiles[0].imports.length);assert.ok(b.projects[0].imports.length);
 assert.ok(a.sourceSymbols['App/Main.axaml.cs'].includes('BROWSER'));assert.ok(!a.files.includes('App/Native.cs'));
});
test('unresolved imports fail both build systems without executable output',()=>{
 const broken={...files,'App/App.csproj':'<Project><Import Project="missing.props"/></Project>'};
 for(const result of [compileProject(broken),compileWorkspace(broken)]){assert.equal(result.code,'');assert.ok(result.diagnostics.some(d=>d.code==='JB4203'));}
});
test('C# diagnostics retain original lines after project preprocessing',()=>{
 const broken={...files,'App/Main.axaml.cs':files['App/Main.axaml.cs'].replace('Status.Text = "Debug browser";','MissingMethod();')};
 for(const result of [compileProject(broken),compileWorkspace(broken)]) {
  const d=result.diagnostics.find(d=>d.message.includes('MissingMethod'));assert.ok(d);assert.equal(d.line,6);assert.equal(d.file,'App/Main.axaml.cs');
 }
});
test('slnx startup project selection preserves nested paths in both workbenches',()=>{
 const input={...files,'Demo.slnx':'<Solution><Folder Name="/src/"><Project Path="App/App.csproj"/></Folder></Solution>'};
 assert.equal(compileProject(input).success,true);assert.equal(compileWorkspace(input,{project:'Demo.slnx'}).ok,true);
});
