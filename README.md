# Jailbreak

Browser-native **C# and Avalonia-style XAML → JavaScript** compilers, reusable UI/runtime libraries, and a web workbench. Applications in the supported subset run with HTML and optional WebGPU primitive surfaces, without a .NET runtime.

**[Open the deployed workbench](https://wieslawsoltes.github.io/Jailbreak/)** · [Secondary workbench](https://wieslawsoltes.github.io/Jailbreak/browser/ide/) · [CI and deployment](https://github.com/wieslawsoltes/Jailbreak/actions/workflows/toolchain.yml)

**Subset compatibility, not a complete Avalonia port.** Full unmodified ControlCatalog remains the target. The requested `wieslawsoltes/Avalonia` repository is accessible and pinned in `browser/fixtures/control-catalog/manifest.json`; earlier documentation referring to `Avalonialibrary` named the wrong repository.

[Getting started](docs/getting-started.md) · [Architecture](docs/architecture.md) · [Build profiles milestone](docs/milestone-build-profiles.md) · [Compatibility](docs/compatibility.md) · [Quality gates](docs/quality-gates.md) · [Security](docs/security.md)

## New: project-aware build profiles

Both compiler pipelines now share `packages/build-profile`:

- Source-preserving C# conditional compilation: `#if`, `#elif`, `#else`, `#endif`, file-local `#define`/`#undef`, active errors/warnings and Boolean expressions.
- A bounded MSBuild source-selection evaluator: properties, conditions, imported `.props`/`.targets` files, `Directory.Build.*`, `Choose`, conditional items and project references.
- Per-project framework/conditional symbols, explicit multi-target selection, linked-source conflict diagnostics, and dependency isolation.
- A reusable IDE profile editor and evaluated-build inspector, with JSON/local-storage persistence.

Select **Build Profiles**, open **Build profile**, switch Debug to Release, and choose **Apply & build**. The compiled click handler changes from adding one to adding ten. The referenced `netstandard2.0` library retains its own symbols while the app targets `net8.0`.

No SDK process, MSBuild task, property function, NuGet package restore or source generator is executed. See the [exact supported profile and limitations](docs/milestone-build-profiles.md).

## Build and run

Node.js 22 or newer. The compiler libraries have no npm dependencies.

```sh
npm test
npm run gate
npm run build
npm run check
python3 -m http.server --directory site 8080
```

Open `http://localhost:8080/`. `site/index.html` is also a self-contained offline-capable primary IDE; `site/index.module.html` is its modular HTTP-served counterpart. The secondary workbench is at `browser/ide/` within the built site and requires HTTP module loading.

The primary workbench includes seven editable source workspaces: ControlCatalog, Counter, DataBinding, Collections, WebGPU, UpstreamCheckBox and BuildProfiles. Open a containing folder to preserve neighboring solution/project/import paths. Choose a startup project and view, edit C# or XAML, build in a worker, inspect generated JavaScript, and run the isolated preview. Export source workspaces as JSON or applications as standalone HTML.

## Reusable libraries

| Package | Responsibility |
|---|---|
| `packages/compiler-core` | Source spans, diagnostics, structural XML and serialization |
| `packages/build-profile` | Project evaluation, conditional compilation, dependency profiles and inspector UI |
| `packages/xaml-compiler` | Namespace/type/property validation, markup extensions, XAML IR and JS emission |
| `packages/csharp-compiler` | Lexer/parser, partial-type merging, symbol resolution and JS emission |
| `packages/dotnet-runtime` | Events, collections, commands, tasks and selected library adapters |
| `packages/avalonia-runtime` | Properties, bindings, resources, selected templates and native controls |
| `packages/renderer` | WebGPU primitive rendering and explicit Canvas2D fallback |
| `packages/project-system` | Workspace, project graph, compilation and preview export |

The existing secondary modules under `browser/packages` are preserved. Both project/C# frontends use the same build-profile package rather than duplicating evaluation logic. Runtime/compiler state is not shared between application instances.

```js
import { compileProject } from './packages/project-system/index.js';

const files = {
  'Demo.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
  'Main.axaml': '<Window xmlns="https://github.com/avaloniaui"><TextBlock Text="Compiled XAML"/></Window>'
};
const result = compileProject(files, {
  projectPath: 'Demo.csproj',
  configuration: 'Release',
  symbols: ['BROWSER']
});
if (!result.success) console.error(result.diagnostics);
else console.log(result.code, result.buildProfiles, result.sourceSymbols);
```

## Evidence and boundaries

The build-profile checkpoint at `29e721b5aca1f402d3bc1dde6a12c18749acf32b` passed repository verification and deployed through [Actions run 34232824105](https://github.com/wieslawsoltes/Jailbreak/actions/runs/34232824105). The workflow runs the Node suite, example compile/hydrate gate, static build, syntax checks, and actual Chromium tests before deploying. Its artifacts include browser screenshots and the gate report. Current workflow results are authoritative for later commits.

The requested fork's unchanged CheckBoxPage and RadioButtonPage XAML/code-behind are hash-checked and compiled through both pipelines. Secondary browser gates exercise checkbox states, the three-state cycle, disabled input and radio-group behavior. The separate official `AvaloniaUI/Avalonia` baseline is retained. Both use explicit ContentPage/ScrollPage host adapters; neither proves full theme/rendering parity.

Remaining gaps include complete C# semantics and .NET APIs, general Avalonia templates/layout/styling, full SDK/MSBuild/NuGet/source-generator behavior, native platform services and full ControlCatalog execution. Most UI rendering remains HTML, not a complete WebGPU compositor. `npm run gate -- --require-full` intentionally fails while full compatibility is unimplemented.

## License

Independent compatibility implementation. Upstream Avalonia fixtures retain their MIT copyright/license notices. See the fixture manifests for exact provenance; this is not an official Avalonia distribution.
