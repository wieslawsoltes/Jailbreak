import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateProject, evaluateCondition as cond, expandProperties, collectSourceSymbols } from '../packages/build-profile/index.js';
import { frameworkSymbols, normalizeWorkspacePath } from '../packages/build-profile/paths.js';
const evaluate = (files,options={}) => evaluateProject(files,'App/App.csproj',options);
const project = body => `<Project Sdk="Microsoft.NET.Sdk">${body}</Project>`;
function ok(result) { assert.equal(result.success,true,JSON.stringify(result.diagnostics)); return result; }

test('conditions have case-insensitive properties, Boolean precedence and numeric/version comparisons',()=>{
  assert.equal(cond("'$(configuration)|$(Platform)' == 'DEBUG|AnyCPU' And !false",{properties:{Configuration:'Debug',Platform:'AnyCPU'}}),true);
  assert.equal(cond("false Or true And ('1.2.3.4' < '1.10.0.0')"),true);
  assert.equal(cond("'1.1' < '1.1.0'"),true);
  assert.equal(cond("'0x10' >= '15'"),true);
  assert.equal(cond("'$(Unknown)' != 'false'"),true);
  assert.equal(cond("'$(Unknown)' == 'false'"),false);
});
test('conditions short circuit calls but still parse inactive operands',()=>{
  const exists=()=>{throw new Error('must not be called');};
  assert.equal(cond("false And Exists('x')",{exists}),false);
  assert.equal(cond("true Or Exists('x')",{exists}),true);
  assert.throws(()=>cond("false And Oops('x')"));
});
test('condition paths and property expansion never evaluate JavaScript',()=>{
  assert.equal(cond("Exists('src/Page.cs') And HasTrailingSlash('src\\')",{exists:p=>p==='src/Page.cs'}),true);
  assert.equal(cond("'$(P)' == 'safe'",{properties:{P:"x' Or true Or 'x"}}),false);
  for(const input of ["$(P.ToUpper())",'$([System.IO.File]::ReadAllText(x))','@(Compile)','%(Identity)']) assert.throws(()=>expandProperties(input,{}));
  assert.equal(expandProperties('$(Missing)-$(X)',{x:'value'}),'-value');
});
test('configuration globals win over local properties, including differently cased names',()=>{
  const r=ok(evaluate({'App/App.csproj':project('<PropertyGroup><Configuration>Release</Configuration><configuration>Other</configuration></PropertyGroup>'),'App/A.cs':'class A {}'},{configuration:'Debug'}));
  assert.equal(r.configuration,'Debug'); assert.ok(r.symbols.includes('DEBUG'));
});
test('nearest Directory.Build.props and targets are evaluated around project properties',()=>{
  const r=ok(evaluate({'Directory.Build.props':project('<PropertyGroup><Label>outer</Label></PropertyGroup>'),'App/Directory.Build.props':project('<PropertyGroup><Label>inner</Label></PropertyGroup>'),'App/App.csproj':project('<PropertyGroup><Label>$(Label)-app</Label></PropertyGroup>'),'Directory.Build.targets':project('<PropertyGroup><Label>$(Label)-targets</Label></PropertyGroup>'),'App/A.cs':'class A {}'}));
  assert.equal(r.properties.Label,'inner-app-targets');assert.equal(r.imports.length,2);
});
test('property/import pass precedes the item pass even when properties follow items',()=>{
  const r=ok(evaluate({'App/App.csproj':project('<ItemGroup Condition="\'$(Mode)\' == \'web\'"><Compile Remove="Native.cs"/></ItemGroup><PropertyGroup><Mode>web</Mode></PropertyGroup>'),'App/Native.cs':'unsupported','App/Web.cs':'class Web {}'}));
  assert.deepEqual(r.sources,['App/Web.cs']);
});
test('nested import paths are import-file-relative; item paths remain project-relative',()=>{
  const r=ok(evaluate({'App/App.csproj':project('<Import Project="../build/common.props"/>'),'build/common.props':project('<Import Project="nested/features.props"/><ItemGroup><Compile Remove="Native.cs"/></ItemGroup>'),'build/nested/features.props':project('<PropertyGroup><DefineConstants>$(DefineConstants);WEB</DefineConstants><Origin>$(MSBuildThisFileDirectory)</Origin></PropertyGroup>'),'App/Native.cs':'bad','App/Web.cs':'class Web {}'}));
  assert.deepEqual(r.sources,['App/Web.cs']);assert.ok(r.symbols.includes('WEB'));assert.equal(r.properties.Origin,'/__workspace__/build/nested/');
});
test('MSBuildThisFileDirectory can link a source relative to an imported file',()=>{
  const r=ok(evaluate({'App/App.csproj':project('<PropertyGroup><EnableDefaultItems>false</EnableDefaultItems></PropertyGroup><Import Project="../shared/source.props"/>'),'shared/source.props':project('<ItemGroup><Compile Include="$(MSBuildThisFileDirectory)Common.cs"/></ItemGroup>'),'shared/Common.cs':'class Common {}'}));
  assert.deepEqual(r.sources,['shared/Common.cs']);
});
test('Choose selects exactly one active property branch',()=>{
  const r=ok(evaluate({'App/App.csproj':project('<Choose><When Condition="\'$(Configuration)\' == \'Debug\'"><PropertyGroup><DefineConstants>LOCAL</DefineConstants></PropertyGroup></When><Otherwise><PropertyGroup><DefineConstants>SHIP</DefineConstants></PropertyGroup></Otherwise></Choose>')},{configuration:'Release'}));
  assert.ok(r.symbols.includes('SHIP'));assert.ok(!r.symbols.includes('LOCAL'));assert.ok(!r.symbols.includes('DEBUG'));
});
test('conditional Include/Exclude/Remove/Update preserve metadata and explicit links',()=>{
  const r=ok(evaluate({'App/App.csproj':project('<PropertyGroup><EnableDefaultItems>false</EnableDefaultItems></PropertyGroup><ItemGroup><Compile Include="src/**/*.cs" Exclude="src/Native*.cs"/><Compile Remove="src/Skip.cs"/><Compile Update="src/Page.xaml.cs"><DependentUpon>%(Filename)</DependentUpon></Compile><AvaloniaXaml Include="src/*.xaml"/></ItemGroup>'),'App/src/Page.xaml.cs':'class Page {}','App/src/Page.xaml':'<UserControl/>','App/src/Native.cs':'bad','App/src/Skip.cs':'bad','App/src/sub/Model.cs':'class Model {}'}));
  assert.deepEqual(r.sources,['App/src/Page.xaml','App/src/Page.xaml.cs','App/src/sub/Model.cs']);
  assert.equal(r.items.Compile.find(i=>i.path.endsWith('Page.xaml.cs')).metadata.DependentUpon,'Page.xaml');
});
test('project references obey conditions and ReferenceOutputAssembly',()=>{
  const r=ok(evaluate({'App/App.csproj':project('<ItemGroup><ProjectReference Include="../Lib/Lib.csproj"/><ProjectReference Include="../Ignored/I.csproj" ReferenceOutputAssembly="false"/><ProjectReference Include="../Missing/M.csproj" Condition="false"/></ItemGroup>'),'Lib/Lib.csproj':'<Project/>','Ignored/I.csproj':'<Project/>'}));
  assert.deepEqual(r.references,['Lib/Lib.csproj']);
});
test('optional imports use the virtual filesystem only',()=>{
  const r=ok(evaluate({'App/App.csproj':project('<Import Project="optional.props" Condition="Exists(\'optional.props\')"/>')}));
  assert.deepEqual(r.imports,[]);
});
test('import cycles, missing imports and exhausted budgets are hard diagnostics',()=>{
  const cases=[{'App/App.csproj':project('<Import Project="no.props"/>')},{'App/App.csproj':project('<Import Project="loop.props"/>'),'App/loop.props':project('<Import Project="App.csproj"/>')}];
  for(const files of cases) assert.equal(evaluate(files).success,false);
  assert.equal(evaluate({'App/App.csproj':project('')},{maxImports:0}).success,false);
});
test('targets, property functions and external paths are rejected rather than silently ignored',()=>{
  for(const body of ['<Target Name="Generate"><Exec Command="anything"/></Target>','<PropertyGroup><X>$([System.Environment]::GetEnvironmentVariable(x))</X></PropertyGroup>','<Import Project="/etc/passwd"/>','<Import Project="https://example.com/project"/>','<ItemGroup><Compile Include="../../outside.cs"/></ItemGroup>']) assert.equal(evaluate({'App/App.csproj':project(body)}).success,false,body);
});
test('multi-targeting requires selection and propagates framework symbols',()=>{
  const files={'App/App.csproj':project('<PropertyGroup><TargetFrameworks>net8.0;net9.0</TargetFrameworks></PropertyGroup>')};
  assert.equal(evaluate(files).success,false);
  const r=ok(evaluate(files,{targetFramework:'net8.0'}));assert.ok(r.symbols.includes('NET8_0'));assert.ok(r.symbols.includes('NET7_0_OR_GREATER'));assert.ok(!r.symbols.includes('NET9_0'));
  assert.equal(evaluate(files,{targetFramework:'net10.0'}).success,false);
});
test('shared linked files with conflicting project symbols are not conflated',()=>{
  const r=collectSourceSymbols([{sources:['Shared.cs'],symbols:['A']},{sources:['Shared.cs'],symbols:['B']}]);
  assert.equal(r.diagnostics[0].code,'JB4213');
});
test('default exclusions and opt-out switches apply before explicit items',()=>{
  const r=ok(evaluate({'App/App.csproj':project('<PropertyGroup><DefaultItemExcludes>skip/**</DefaultItemExcludes><DefineDebug>false</DefineDebug><DefineTrace>false</DefineTrace></PropertyGroup>'),'App/skip/A.cs':'bad','App/obj/G.cs':'bad','App/A.cs':'class A {}'}));
  assert.deepEqual(r.sources,['App/A.cs']);assert.deepEqual(r.symbols,[]);
});
test('wildcard imports have deterministic alphabetical evaluation order',()=>{
  const r=ok(evaluate({'App/App.csproj':project('<Import Project="../build/*.props"/>'),'build/z.props':project('<PropertyGroup><Order>$(Order)z</Order></PropertyGroup>'),'build/a.props':project('<PropertyGroup><Order>$(Order)a</Order></PropertyGroup>')}));
  assert.equal(r.properties.Order,'az');
});
test('workspace paths are bounded and framework inference does not claim OS support',()=>{
  assert.throws(()=>normalizeWorkspacePath('C:\\secret'));assert.throws(()=>normalizeWorkspacePath('..\\secret'));
  assert.deepEqual(frameworkSymbols('net8.0-windows'),[]);assert.ok(frameworkSymbols('netstandard2.0').includes('NETSTANDARD2_0'));
});

test('dependency graphs preprocess files under separate project symbol sets', async()=>{
  const {prepareCompilation}=await import('../packages/build-profile/graph.js');
  const result=prepareCompilation({'App/App.csproj':project('<PropertyGroup><TargetFramework>net8.0</TargetFramework><DefineConstants>APP</DefineConstants></PropertyGroup><ItemGroup><ProjectReference Include="../Lib/Lib.csproj"/></ItemGroup>'),'App/A.cs':'#if APP\nclass A {}\n#else\nbad\n#endif','Lib/Lib.csproj':project('<PropertyGroup><TargetFramework>netstandard2.0</TargetFramework><DefineConstants>LIB</DefineConstants></PropertyGroup>'),'Lib/B.cs':'#if LIB && NETSTANDARD2_0 && !APP\nclass B {}\n#else\nbad\n#endif'},['App/App.csproj'],{configuration:'Release',targetFramework:'net8.0'});
  ok(result);assert.match(result.files['Lib/B.cs'],/class B/);assert.doesNotMatch(result.files['Lib/B.cs'],/bad/);assert.ok(!result.sourceSymbols['Lib/B.cs'].includes('APP'));
});
