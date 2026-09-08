# Jailbreak

Browser-native **C# and Avalonia-style XAML → JavaScript** compilers, reusable UI/runtime libraries, and a web workbench. Applications in the supported profile run as HTML/CSS/SVG with an optional WebGPU primitive surface, without a .NET or WebAssembly runtime.

**Initial compatibility release, not full Avalonia compatibility.** The supported-profile catalog and an unchanged upstream CheckBoxPage run in the browser. The entire upstream ControlCatalog is not yet supported. The exact requested `wieslawsoltes/Avalonialibrary` repository returned HTTP 404 and remains a blocked external gate.

[Getting started](docs/getting-started.md) · [Architecture](docs/architecture.md) · [Compatibility](docs/compatibility.md) · [Quality gates](docs/quality-gates.md) · [Security](docs/security.md) · [CI and deployment](https://github.com/wieslawsoltes/Jailbreak/actions/workflows/toolchain.yml)

## Build and try

Node.js 22 or newer; no npm dependencies are needed for the toolchain.

```sh
npm test
npm run gate
npm run build
npm run check
npm run serve
```

Open the development server on port 4173. The build also produces **`site/index.html`, a self-contained offline-capable IDE**, and `site/index.module.html`, its modular HTTP-served counterpart. The workbench has six editable source workspaces: ControlCatalog, Counter, DataBinding, Collections, WebGPU and UpstreamCheckBox.

Open a containing folder to load solution/project files and their neighboring sources. Choose a startup project/root view, edit C# or XAML, and press Ctrl/Command+Enter. Inspect generated JavaScript and source-located diagnostics, run the isolated preview, save the workspace as JSON, or export a standalone HTML application. Compiler errors prevent execution. Sources are processed locally by the browser IDE.

The Pages workflow builds and tests the static site before attempting deployment. Pages must be enabled for GitHub Actions; automatic enablement can be denied by repository permissions. Check the deployment job rather than treating a successful build as proof that the live endpoint is available.

## Reusable libraries

| Package | Responsibility |
|---|---|
| `packages/compiler-core` | Source spans, diagnostics, structural XML and safe serialization |
| `packages/xaml-compiler` | Namespace/type/property validation, markup extensions, XAML IR and JS emission |
| `packages/csharp-compiler` | Separate lexer/parser, partial-type merging, symbol resolution and JS emission |
| `packages/dotnet-runtime` | Events, observable collections, commands, tasks, LINQ and numeric/string adapters |
| `packages/avalonia-runtime` | Styled properties, bindings, resources, templates, controls and HTML/CSS/SVG rendering |
| `packages/renderer` | Instanced WebGPU rectangles/ellipses, buffer reuse and real Canvas2D fallback |
| `packages/project-system` | Virtual workspace, solution/project references, compilation and preview export |

All are native ES modules. The IDE uses these libraries rather than a separate demo-only compilation path. The C# compiler parses syntax trees; it is not a sequence of regex source replacements.

```js
import { compileProject } from './packages/project-system/index.js';

const result = compileProject({
  'Demo.csproj': '<Project/>',
  'Main.axaml': '<Window><TextBlock Text="Compiled XAML"/></Window>'
});
if (!result.success) console.error(result.diagnostics);
else console.log(result.code, result.manifest);
```

## Evidence and boundaries

The initial local checkpoint passed **42 Node tests**, **six example compile/hydrate gates**, **three upstream source/license hash checks**, and **15 browser checks**. Browser checks exercise real C# event handlers, edits changing behavior, bindings, collection templates, checkbox states, tabs, source import, standalone export and preview-origin isolation. Reproduce them with the commands in [quality-gates.md](docs/quality-gates.md); current CI results are authoritative for subsequent changes.

The upstream fixture is pinned to `AvaloniaUI/Avalonia` commit `27c1ece36cbe17de3b8f95ae88223ba68702ae47` and retains its license and exact source bytes. It uses an explicit Jailbreak ContentPage/ScrollPage host adapter. The optional upstream inventory reports parsing and isolated XAML validation separately; it does not represent a linked or executed full catalog.

Local rendering tests exercised Canvas2D because the environment had no WebGPU adapter. WebGPU implementation is present, but local GPU execution/performance is not claimed. Most UI rendering is HTML/CSS/SVG, not a complete GPU compositor.

Important gaps include general control/theme templates, advanced binding and styling, full C# semantic/value-type/numeric behavior, complete .NET APIs, NuGet/source generators/MSBuild evaluation, platform services and full rendering fidelity. Generic syntax is erased, and notifying auto-properties are a documented convenience extension. Schema presence is not a behavioral compatibility guarantee. `npm run gate -- --require-full` fails until the full target is met.

## License

MIT; see [LICENSE](LICENSE). The unchanged Avalonia reference fixture retains its separate MIT copyright and license in [examples/UpstreamCheckBox](examples/UpstreamCheckBox/). This is an independent project, not an official Avalonia distribution.
