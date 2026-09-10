# Build profiles milestone — 2026-09-08

<!-- jailbreak-current-documentation:begin -->
> **Historical milestone; current applicability audited 2026-09-10.** The implementation details and test totals below record this milestone, not the complete present-day product. Its old remaining/unsupported lists and UI instructions may have been superseded. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

## Delivered behavior

Both existing workbenches now use one browser-safe project/profile layer. The BuildProfiles sample loads a two-project `.slnx`, imports common properties, selects conditional sources, compiles C# under per-project symbols, and executes different Debug/Release click handlers. Profiles survive local-storage restoration and workspace JSON export/import; standalone app export retains the selected compiled behavior.

The primary and secondary compilers/runtimes remain separate existing implementations. This milestone consolidates project evaluation and preprocessing, not their entire language or UI backends.

## Pipeline and reusable APIs

`workspace files → project properties/imports → conditioned items → dependency graph → per-file symbols → C# preprocessing → existing XAML/C# backends → JavaScript → runtime`

`packages/build-profile/conditions.js` parses conditions and expands simple properties. `paths.js` supplies bounded virtual paths, deterministic glob matching and selected framework symbols. `index.js` evaluates a project. `graph.js` prepares the dependency graph and source files. `preprocessor.js` preserves original source positions while selecting C# branches. `inspector.js` is a host-independent profile editor/evaluation view.

The existing compiler/project entry points delegate to their preserved `backend.js` modules after preprocessing. Declaration discovery and code emission see the same selected source; disabled platform code is not parsed accidentally.

```js
import { evaluateProject } from '../packages/build-profile/index.js';
import { preprocessCSharp } from '../packages/build-profile/preprocessor.js';
import { compileProject } from '../packages/project-system/index.js';

const options = {
  configuration: 'Release',
  platform: 'AnyCPU',
  targetFramework: 'net8.0',
  symbols: ['BROWSER']
};
// files is an object or Map of relative workspace paths to source text.
const evaluated = evaluateProject(files, 'App/App.csproj', options);
const prepared = preprocessCSharp(sourceText, {
  path: 'App/MainView.axaml.cs', symbols: ['BROWSER']
});
const result = compileProject(files, { ...options, projectPath: 'App/App.csproj' });
```

The secondary API is `compileWorkspace(files, { ...options, project: 'App/App.csproj' })`. Its success field is `ok`; the primary field is `success`. Both return `sourceSymbols`. Primary results expose `buildProfiles`; secondary results expose rich `projects` records.

## C# conditional compilation

Supported: file-local `#define`/`#undef`; nested `#if`/`#elif`/`#else`/`#endif`; case-sensitive Boolean symbols; `!`, `&&`, `||`, `==`, `!=`, parentheses; active `#error`/`#warning`; regions and nullable-context metadata. Symbols are copied per file, never mutated globally.

Removed text is replaced with spaces, retaining UTF-16 offsets and every CR/LF. A compiler diagnostic after a removed branch still navigates to the original source line. Comment/verbatim/raw-string tracking prevents `#if` text inside these constructs from becoming a directive. This tracking does not imply the language backend supports every active raw/interpolated-string form.

`#line` numeric/file remapping is explicitly unsupported. Nullable directives do not implement nullable flow analysis. Supported pragma-warning syntax produces a notice rather than suppressing Jailbreak diagnostics. Symbol identifiers currently use an ASCII subset. Direct low-level lexer/parser APIs remain backend primitives; configured compilation should use the public frontend.

## Project evaluation subset

Property names are case-insensitive. Explicit global properties, configuration/platform and selected root target framework cannot be overwritten by ordinary project properties. Only simple `$(PropertyName)` expansion is allowed; undefined properties become empty strings.

The evaluator loads the nearest `Directory.Build.props`, the project, and the nearest `Directory.Build.targets`. Explicit imports, import groups and wildcard imports are supported with cycle, missing-file and import-budget diagnostics. Imports are resolved relative to the importing file. Item paths are resolved relative to the main project, including items declared by an import. Well-known `MSBuildThisFile*` and `MSBuildProject*` paths use `/__workspace__/` and never reveal host paths.

The property/import pass precedes item evaluation. Conditions support string equality, numeric/compatible-version ordering, Boolean operations, `Exists` against supplied workspace files and `HasTrailingSlash`. Parsing precedes operand expansion, preventing property values from injecting condition operators. Boolean evaluation short-circuits without skipping syntax validation.

Conditional `Choose`/`When`/`Otherwise`, property groups, item groups and items are handled. Include/Exclude/Remove/Update and a limited metadata subset select Compile, Avalonia XAML/resources, Page, ProjectReference and other recognized item types. Default source globs exclude bin/obj/.git/node_modules and respect the documented opt-out properties. Metadata inspection is available; recognition of an item does not imply full MSBuild or resource-packaging semantics.

## Symbols and dependency isolation

`DefineConstants` is evaluated per project. The explicit Microsoft.NET.Sdk source-selection adapter adds DEBUG for Debug, TRACE unless disabled, and selected .NET/.NET Standard symbols; these are not inferred from the physical JavaScript host. Multi-target projects require an explicit target-framework selection. OS-specific TFMs and complete SDK-generated constants are not implemented.

A root `targetFramework` selection does not replace a referenced library's declared framework. `referenceTargetFrameworks` can select a referenced multi-target project. Additional compilation `symbols` apply to all selected source projects. File-local `#define`/`#undef` then apply during preprocessing.

The profile inspector lists evaluated project symbols. The compilation result's `sourceSymbols` records initial per-file symbols including additional compilation symbols; it is not a trace of changes made by file-local directives. Conflicting symbol sets for a shared physical source file are an error rather than whichever project happened to be visited last.

## Explicit boundaries

This is source selection, not an MSBuild process. Targets, tasks, SDK imports beyond the adapter, property functions, item batching/transforms, item-definition semantics, binary assembly references and per-reference global-property overrides remain diagnostics. NuGet references are reported as adapter-only warnings; binaries and source generators are not loaded. Compiling the full Avalonia project graph still requires further compiler, framework and build-system work.

The supplied files must include necessary imports and linked sources. `Exists` cannot inspect the host disk or network. Solution auto-detection chooses a startup project and its dependencies, not every unrelated project in a solution. Build profiles affect source selection; they do not implement native platform behavior.

## Validation and deployment

Checkpoint `29e721b5aca1f402d3bc1dde6a12c18749acf32b`: [repository verification and Pages deployment succeeded](https://github.com/wieslawsoltes/Jailbreak/actions/runs/34232824105). The tests cover directive syntax/positions, conditional imports/items, locked properties, graph isolation, runtime hydration, profile editing/persistence, emitted handler differences, standalone export and sandbox isolation. Requested-fork fixture bytes and CheckBox/RadioButton behavior are gated separately from full catalog coverage.

The primary offline workbench, modular workbench and secondary module workbench are published from the same verified `site/` artifact. Actions uploads screenshots and reports before deployment. A passing build or hash test alone is not an execution, rendering or full-compatibility claim.

See [quality-gates.md](quality-gates.md) for reproduction commands and [compatibility.md](compatibility.md) for the remaining target.

## Design references

- [C# preprocessor directives](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/preprocessor-directives)
- [MSBuild conditions](https://learn.microsoft.com/en-us/visualstudio/msbuild/msbuild-conditions)
- [MSBuild evaluation and build process](https://learn.microsoft.com/en-us/visualstudio/msbuild/build-process-overview)
- [Customize builds with Directory.Build files](https://learn.microsoft.com/en-us/visualstudio/msbuild/customize-by-directory)

These references define the source platform. The implemented subset and deliberate differences are described above, not assumed to match every behavior in those documents.
