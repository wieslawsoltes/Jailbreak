# Architecture

Jailbreak separates source loading, project evaluation, language compilation, runtime adaptation and the editor. The primary modules are native ES modules under `packages/`. The pre-existing secondary toolchain remains under `browser/packages/`.

The shared `build-profile` layer converts workspace text into evaluated project records and selected/preprocessed sources. Its evaluator has no DOM, network, SDK or task dependency. Its inspector is a separate optional DOM module. Both public C# and project compilation APIs use this shared layer.

The XAML frontends construct structural XML/XAML object graphs and validate the supported type/property surface. C# frontends tokenize source, parse syntax trees, link partial declarations and emit JavaScript through their existing backends. Runtime adapters are explicit; the output does not embed the compilers or a .NET runtime.

Primary generated scripts register against `JB`; secondary scripts register against `R`. Each runtime creates its own type/definition registries, observable state, resource/binding machinery and controls. HTML supplies ordinary input/control rendering and accessibility behavior. WebGPU is an optional reusable primitive surface, not the renderer for every DOM control.

Editors run compilation in cancellable workers. Application previews run in script-only sandboxed iframes, separate from the editor's origin. Build/export packages trusted runtime module text with generated application code and a restrictive preview policy. See [security.md](security.md).

## Extension rule

Add a focused parser/semantic/runtime implementation and positive/negative tests for a new construct; do not silence diagnostics just to increase a parsing count. Preserve distinct gates for source integrity, parse/compile success, runtime construction, interactive behavior and rendering parity. Add new unchanged ControlCatalog fixtures with upstream provenance and executable assertions.

See [build profiles](milestone-build-profiles.md) for the implemented evaluation pipeline and [browser-toolchain.md](browser-toolchain.md) for the secondary runtime's earlier detailed design. The milestone guide supersedes the earlier project/preprocessor limitations in that document.

## Managed binaries and packages

The binary input path is `PE/CLI bytes or IL text → verified stack/control-flow IR → emitted JavaScript method functions`. NuGet adds bounded local archive/manifest/dependency selection and feeds selected implementation DLLs into that path. It does not restore packages or execute build tasks.

`compiler-core/managed-types.js` and `dotnet-runtime` are shared across the binary backend and existing source/runtime layers. C# syntax parsing remains separate: pretending IL is a C# syntax tree would lose control-flow and evaluation-stack semantics. `binary-project` passes converted full type names to the C# resolver, registers binaries first and exposes their wrappers through the existing `JB` type registry. Source UI applications and converted library methods then execute together.

Binary Studio is a client of those libraries, not another compiler. Both it and the primary source IDE build in workers and invoke application methods only in isolated previews. HTML exports contain emitted functions/runtime, not PE parsers or compilation workers.

See [binary milestone](milestone-msil-nuget.md), [binary design](binary-compilation-design.md), and the [integrated roadmap](roadmap.md). Further generic/package/framework expansion belongs in these layers with new conformance gates.

## Exception and checked-arithmetic layer

The managed PE reader and IL text frontend feed a single validated exception-region model. `msil-compiler/exception-regions.js` checks protected control-flow transitions; `msil-runtime/exception-frame.js` manages per-call unwind continuations used by emitted JavaScript. Ordinary methods keep their original non-EH path. Shared `dotnet-runtime/exceptions.js` constructors permit source C# to catch binary errors; `checked.js` provides exact overflow checks. No IL decoder is introduced into the runtime. See [exception milestone](milestone-exceptions.md) for supported catch types, verifier limits, browser examples and the 35-case CLR gate.
