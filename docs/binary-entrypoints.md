# Binary API entry points

The integrated Binary Studio, CLI, NuGet bridge, primary C#/XAML workbench, and CLR-oracle tests use these public entry points:

| API | Module |
| --- | --- |
| `compileIL`, `compileAssembly`, `compileAssemblies` | `packages/msil-compiler/verified.js` |
| Structured-signature `readAssembly` | `packages/managed-pe/structured.js` |
| `createBinaryRuntime` | `packages/msil-runtime/index.js` |
| `inspectNuget`, `convertNuget`, `convertNugetPackages` | `packages/nuget/index.js` |
| Source plus binary compilation | `packages/binary-project/index.js` |
| Portable workspace binary records | `packages/binary-project/workspace.js` |

During integration, concurrent commits had introduced a compact binary model at `managed-pe/index.js`, `msil-compiler/index.js`, and `il-runtime/index.js`. Those files and their helper modules were preserved unchanged. The verified structured-signature pipeline has separate entry points rather than overwriting work in progress or silently exchanging incompatible assembly models. Its helper modules are `metadata-schema.js`, `instruction-set.js`, and `verification.js`.

The two binary models are **not interchangeable**. Use the verified APIs above for the tested DLL/NuGet/UI route. Existing callers of the compact entry points retain their previous API. Consolidating the model adapters is follow-up work; there is no claim that this milestone already unified every compiler frontend. Tests, examples, exports, and documentation snippets for the integrated route consistently import `verified.js`.

C# syntax parsing is not reused to parse IL. The reuse occurs in source diagnostics/serialization, managed type helpers, numeric/string/array runtime operations, external-type registration, and the existing UI/project pipeline. Converted methods are emitted as JavaScript functions and basic-block control flow, not executed by decoding opcodes at runtime.

Source batches were checksum-verified before materialization and kept as granular, ordinary source commits. The integration map only relocates the colliding new binary entry points and updates their imports; existing modified source files retain original-content checks. This transport machinery is not part of the shipped compiler or application runtime.

See [the MSIL/NuGet milestone](milestone-msil-nuget.md), [architecture](architecture.md), and [roadmap](roadmap.md) for the wider design and supported subset. Full CLR, NuGet restore, binary Avalonia, and unmodified ControlCatalog compatibility remain separate targets.
