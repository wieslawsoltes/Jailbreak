# Browser-native compiler toolchain

<!-- jailbreak-current-documentation:begin -->
> **Specialized guide / example; current applicability audited 2026-09-10.** This document is a specialized profile/example, not a full-solution completion claim. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

## Status and goal

The independent `browser/` workspace implements a source-to-source C# and Avalonia-style XAML subset compiler, JavaScript runtime, HTML control host, optional WebGPU primitive renderer, project reader, and browser IDE. It preserves the root workspace and shares no mutable compiler state with it.

The target is the full, unmodified Avalonia ControlCatalog. **That target is not complete.** The initial executable compatibility fixtures are the original CheckBoxPage and RadioButtonPage XAML and C# code-behind from `wieslawsoltes/Avalonia`, pinned to commit `b709c58c6b1b8aa3b90866c7c001b7bf82b6353b`. The requested repository is accessible; it must not be confused with a differently named repository. A passing fixture does not establish full-framework or pixel compatibility.

The fixture manifest records exact Git blob hashes and keeps the upstream MIT notice. `ContentPage` and the `ScrollPage` theme are explicit host adapters, not a port of the full upstream theme system.

## Architecture

The application build is `source files -> XML/C# syntax trees -> XAML object IR and linked class declarations -> JavaScript -> compatibility runtime -> HTML controls and optional drawing surfaces`.

- `browser/packages/core`: source locations, diagnostics, bounded XML parser, and explicit control/property schema.
- `browser/packages/xaml`: markup-extension parsing, XAML validation, names, resources, simple styles, object IR, and JavaScript emission.
- `browser/packages/csharp`: lexer, recursive-descent/Pratt parser, syntax trees, partial-class linking, symbol lookup, and separate expression/class/statement emitters.
- `browser/packages/dotnet`: collections, observable collections, events, commands, task helpers, and narrow managed-library adapters.
- `browser/packages/runtime`: observable properties, bindings, resources, namescopes, HTML control lifecycle, events, and property projection.
- `browser/packages/renderer`: independent WebGPU instanced primitive renderer with explicit Canvas2D fallback.
- `browser/packages/project`: virtual workspace, solution/project readers, dependency traversal, compilation orchestration, and self-contained HTML export.
- `browser/ide`: source editing, build worker, diagnostics, generated code, build graph, local workspace persistence, import/export, and sandboxed preview.

Compiler modules are ES modules and do not depend on the editor. The XML and C# frontends do not execute input code. The project compiler emits a script against an explicit runtime object `R`. The application runtime has no dependency on either compiler or a .NET/WASM runtime.

## Public entry points

```js
import { compileXaml } from './browser/packages/xaml/index.js';
import { compileCSharp } from './browser/packages/csharp/index.js';
import { Workspace, compileWorkspace } from './browser/packages/project/index.js';

const xaml = compileXaml('<UserControl><TextBlock Text="Hello" /></UserControl>');
const csharp = compileCSharp('namespace Demo; public class Counter { public int Value { get; set; } }');
const workspace = new Workspace({
  'Main.axaml': '<UserControl xmlns="https://github.com/avaloniaui"><TextBlock Text="Hello" /></UserControl>'
});
const application = compileWorkspace(workspace);
if (!application.ok) console.error(application.diagnostics);
```

The frontends return structured diagnostics rather than silently accepting deliberately unsupported syntax. This does not amount to a complete C# or Avalonia semantic analyzer: some library-member errors still arise at runtime.

## Implemented C# subset

The parser and emitter support namespaces, ordinary using directives, classes and partial classes, one base class, fields, constructors, methods, static members, auto and manual properties, simple enums, selected events, and expression-bodied members. Statements include locals, conditionals, loops, switch, return, throw, and try/catch/finally. Expressions include literals, interpolated strings, member calls, object/collection/array construction, lambdas, operators, null coalescing, ternaries, and selected casts/type operations. Async methods and await use JavaScript promises and task adapters.

This is not a full C# implementation. Overload resolution, arbitrary generic declarations and constraints, full interface mapping, records/structs, ref/out semantics, unsafe code, source generators, arbitrary attributes, advanced preprocessor evaluation, reflection, and the complete base class library remain work items. Type annotations do not provide full static type checking. JavaScript number behavior remains in several paths; basic Int32 binary arithmetic lowering is not a guarantee of exact compound-assignment, increment, conversion, or overflow semantics. Nullable, value-type, equality, evaluation-order, constructor-initialization and async details need broader conformance tests. Observable auto-property notifications are a host convenience, not standard C# behavior.

## Implemented XAML and runtime subset

The XAML frontend supports ordinary visual trees, quoted attributes, selected property elements, x:Class and names, null and Boolean literals, simple resources and styles, and runtime bindings. Binding forms include property paths, named-element paths, OneWay/TwoWay/OneTime modes, fallback/null values, and a limited string-format adapter. Resource lookups traverse the visual parent chain and host resources. Dynamic resources update through the runtime propagation mechanism.

The host contains native input, content, selection and layout controls and a small observable property-priority system. It is not the Avalonia layout engine: HTML/CSS layout, typography, theming and accessibility behavior can differ. Simple styles are not full control themes or templates. Compiled bindings, complete selectors/pseudoclasses, template parts, arbitrary markup extensions, animations, virtualization, renderer parity, routed-event semantics, platform services, and advanced DataTemplate/name-scope behavior remain incomplete. Availability in the schema must not be interpreted as a complete behavioral compatibility claim.

## Rendering contract

HTML controls use browser layout and native input elements. **They are not all rendered with WebGPU.** `DrawingSurface` uses a separate primitive renderer. Its WebGPU backend batches rectangles, rounded rectangles and ellipses into instanced draws, uses resizable buffers, and owns device/canvas lifecycle. It reports initialization and device-loss status. Canvas2D is an explicit fallback.

The renderer is not a complete Avalonia scene renderer: text shaping, glyph atlases, paths, clipping, gradients, layers, effects, composition, and complete input/accessibility integration are separate future features. A passing fallback test is not evidence that a physical GPU backend was validated. Report the backend actually observed in each environment.

## Project-system contract

Workspace paths are normalized relative paths. Folder loading preserves solution/project relationships. The reader understands common SDK-style source inclusion and project-reference traversal, detects missing references and cycles, and exposes diagnostics. It does not execute arbitrary MSBuild, restore NuGet, load managed DLLs, run custom targets, evaluate all conditions, or reproduce the desktop application lifetime. Entry selection currently chooses an executable view, not an arbitrary Program.Main/App initialization sequence.

The IDE can open a source folder, multiple source files, or a JSON workspace. Selecting individual files does not preserve folder structure. JSON workspace save/export is distinct from the self-contained HTML application export. Files stay local unless explicitly exported by the user; the compiler itself requires no compilation server.

## Execution and security

Compilation occurs in a replaceable worker with a timeout. Preview scripts run in an iframe with `sandbox="allow-scripts"`, without `allow-same-origin`. The parent checks the message source and a per-run channel. The exported preview document applies a restrictive Content Security Policy and disables fetch connections. Image URLs are separately allowed by its image policy; do not describe the document as preventing every kind of network request.

The XML parser rejects DTDs/external entities and imposes element/depth limits. The runtime has guarded loop/method execution and binding propagation limits. These are robustness measures, not a complete hostile-code containment guarantee. Only execute trusted source. Browser scripting can still exhaust CPU or memory, and exported applications run in the origin where their owner chooses to host them.

## Compatibility gates

Record four different outcomes: parsing, compilation, execution, and behavioral equivalence. Maintain an exact source pin and Git blob verification for vendored fixtures. A full-catalog inventory must list unsupported files and diagnostics rather than count a hand-written look-alike as upstream coverage.

Initial behavioral checks cover checkbox initial/disabled/indeterminate states, three-state cycling, radio sibling and named-group exclusion, compiled counter events, live binding propagation, and preview isolation. Local development runs recorded 58 unit tests and 16 browser checks; CI and deployment results should be reported independently and only after those runs are observed. Full ControlCatalog remains `false` in the fixture manifest.

## Extension order

First close semantic holes in existing syntax with negative tests and differential C# execution fixtures. Then add overload/type binding, interfaces and reusable generic declarations, stronger project evaluation and reference adapters, complete property/name-scope/template semantics, and catalog-driven control behavior. Expand renderer functionality as an independent library, preserving HTML accessibility and input integration.

Every new feature should add parser/IR coverage, emitter/runtime behavior, a negative diagnostic case, and a real source fixture where applicable. Do not remove an unsupported diagnostic until the implementation and its behavioral tests replace it.

## Development

The workspace targets Node.js 22 or newer and uses native ES modules. Serve the repository through HTTP rather than opening module files with `file://`. The browser IDE source entry is `browser/ide/index.html`. The package scripts declare unit tests, browser tests, fixture gates, a static build, a local server, and a catalog audit; those commands require the corresponding scripts and test files to be present in the checkout. A configured Pages workflow is not proof of deployment: verify its run and the public site before claiming publication.
