# Jailbreak

**New:** [Keyed panel hot reload and designer duplication](docs/milestone-structural-reload.md) preserve retained controls, input state and handler identity across supported insert/delete/reorder operations.

**Core tools:** debugging, visual design and hot reload are mandatory project requirements. The primary IDE now has **Develop** tools and a **Developer Tools** source sample. See [the core contract](docs/core-development-tools.md) and [delivered tools, tests and remaining full-scope gaps](docs/milestone-development-tools.md).

**New:** typed MSIL catches, nested finally/fault, rethrow and checked arithmetic now run through DLL, NuGet, Binary Studio and the source/binary bridge. See [exception recovery milestone](docs/milestone-exceptions.md) and the **ExceptionLibrary** UI sample. Full ControlCatalog compatibility is still an unfinished target.

Browser-native **C#, Avalonia-style XAML and MSIL → JavaScript** compilers, reusable runtime libraries and a web IDE. Supported applications run with HTML and optional WebGPU surfaces, without a .NET runtime.

[Open the primary IDE](https://wieslawsoltes.github.io/Jailbreak/) · [Binary Studio](https://wieslawsoltes.github.io/Jailbreak/binary/) · [Secondary IDE](https://wieslawsoltes.github.io/Jailbreak/browser/ide/) · [Toolchain CI](https://github.com/wieslawsoltes/Jailbreak/actions/workflows/toolchain.yml) · [Batched-source CI](https://github.com/wieslawsoltes/Jailbreak/actions/workflows/delivery.yml)

**This is a compatibility subset, not a complete Avalonia port. Full unmodified ControlCatalog remains the target and its full gate remains failing.** The requested `wieslawsoltes/Avalonia` repository is accessible; fixtures are pinned with exact hashes and retained licenses.

## New: MSIL, DLL and NuGet conversion

The primary toolchain now compiles real managed DLLs and an ILAsm subset to native JavaScript basic-block functions. The binary frontend decodes PE/CLI metadata, verifies stack/control flow and links exact method references. It reuses the existing integer/string/array adapters and primary UI type registry, not an IL interpreter or a .NET download.

Open **[Binary Studio](https://wieslawsoltes.github.io/Jailbreak/binary/)** for editable IL examples, real DLL/nupkg upload, method/disassembly inspection and offline runner export. In the primary source IDE, select **Binary Library** or **Nuget Library**: compiled C#/XAML handlers call the actual converted DLL, including stateful objects. DLL/package bytes round-trip in workspace JSON.

NuGet conversion selects an exact `lib/<tfm>` group from supplied local packages; it is not automatic NuGet restore. Native/ref-only assets, unsupported IL/generics/exception filters, unknown executable dependencies and invalid binaries are diagnostics rather than empty stubs. Conversion supports a bounded managed subset, not arbitrary Avalonia DLLs.

[Binary milestone, APIs and examples](docs/milestone-msil-nuget.md) · [Integrated roadmap](docs/roadmap.md) · [Architecture](docs/architecture.md)

## New: templates, shared XAML and another original catalog page

The primary pipeline now implements deferred ControlTemplate instances, TemplateBinding, RelativeSource TemplatedParent/Self, ContentPresenter, ContentTemplate, scoped template parts and compiled OnApplyTemplate hooks. ControlTheme supports static setters, BasedOn and exact type-keyed lookup. Replacement disposes template-owned parts without destroying borrowed application content.

Merged resource dictionaries provide lazy/forward references, precedence and dynamic invalidation. StyleInclude/ResourceInclude link selected workspace files at compile time, including known-project avares URIs, with missing-file/type/cycle diagnostics. A strict selector parser supports child, descendant and `/template/` axes.

Choose **Templates** in the primary IDE for an editable demonstration. Choose **Upstream Progress Bar** for original, unchanged XAML/code-behind exercising range-normalized percentages, text formatting, orientation and indeterminate state. The secondary runtime is preserved and does not yet implement these new template/progress features.

[Template milestone and limits](docs/milestone-templates-resources.md) · [Build-profile milestone](docs/milestone-build-profiles.md)

## Build and run

Node.js 22 or newer; compiler libraries have no npm dependencies.

```sh
npm test
npm run gate
npm run build
npm run check
python3 -m http.server --directory site 8080
```

Open `http://localhost:8080/`. `site/index.html` embeds its worker, runtime and source samples for offline use. `site/index.module.html` and the secondary `site/browser/ide/` use HTTP-served modules.

The primary IDE contains eleven editable workspaces: ControlCatalog, Counter, DataBinding, Collections, WebGPU, UpstreamCheckBox, BuildProfiles, Templates, UpstreamProgressBar, BinaryLibrary and NugetLibrary. Open a containing folder to preserve solution/project/import/source paths. Build profiles configure Debug/Release, platform, target framework and symbols. Inspect generated JavaScript, diagnostics and evaluated project inputs; save workspaces as JSON or export standalone application HTML.

## Reusable modules

| Package | Purpose |
|---|---|
| `packages/compiler-core` | Source locations, diagnostics, XML and serialization |
| `packages/build-profile` | Source-preserving C# preprocessing, bounded project evaluation and profile inspector |
| `packages/xaml-compiler` | XAML validation/IR, template namescopes and include linking |
| `packages/csharp-compiler` | Lexer/parser, partial linking and JavaScript emission |
| `packages/dotnet-runtime` | Selected managed-library adapters, events, commands, collections and tasks |
| `packages/avalonia-runtime` | Properties, resources, bindings, templates and HTML controls |
| `packages/renderer` | WebGPU primitives and explicit Canvas2D fallback |
| `packages/managed-pe` | Bounded PE/CLI metadata, signatures and method-body reader |
| `packages/msil-compiler` | IL text/bytecode parsing, verification and JS block emission |
| `packages/msil-runtime` | Converted methods/objects, linking, selected external calls and budgets |
| `packages/nuget` | Safe local ZIP/nuspec ingestion, exact asset selection and DLL conversion |
| `packages/binary-project` | Existing C#/XAML source linked with explicitly supplied binary libraries |
| `packages/project-system` | Workspace/dependency compilation and application export |

The .NET 8 SDK is needed only for `npm run test:clr`, which checks freshly built owned DLL/nupkg output against an independent CLR oracle. The compiler/runtime/browser workbenches require no SDK.

The pre-existing secondary modules remain under `browser/packages`. Both project/C# pipelines share the build-profile layer. This milestone extends the primary runtime instead of adding a third implementation.

## Quality and boundaries

Node tests, trusted example compile/construction gates, byte-exact upstream fixture checks, actual Chromium interactions, standalone-export checks, syntax checks and static builds are separate gates. Browser screenshots and reports are uploaded by CI. Source-delivery commits are tested before being pushed; deployment uses that tested build. See [quality gates](docs/quality-gates.md) and the newest milestone for reproduction and scope.

The original requested-fork CheckBoxPage/RadioButtonPage tests remain. ProgressBarPage is newly added with exact provenance in `examples/UpstreamProgressBar/PROVENANCE.md`. The separate official Avalonia baseline remains in the root fixture gate. ContentPage/ScrollPage are explicit host adapters, not complete theme ports.

Remaining gaps include full C# semantics and .NET APIs, full SDK/MSBuild/NuGet/source-generator behavior, general Avalonia theme/input/list templates, complete binding/styling/layout and platform services. Most controls use HTML, not a complete WebGPU compositor. A successful Canvas2D fallback is not GPU-device/performance evidence. `npm run gate -- --require-full` intentionally fails while complete ControlCatalog compatibility is unmet.

[Getting started](docs/getting-started.md) · [Architecture](docs/architecture.md) · [Compatibility](docs/compatibility.md) · [Security](docs/security.md)

## License

Independent implementation; see LICENSE. Original Avalonia fixtures retain their separate MIT copyright/license notices. This is not an official Avalonia distribution.
