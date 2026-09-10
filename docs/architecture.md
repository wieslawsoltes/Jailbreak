# Architecture and canonical execution paths

> Audit input: [`9b73d1167983`](https://github.com/wieslawsoltes/Jailbreak/tree/9b73d1167983076687cf078a3992144e4a18794a); documentation reconciled 2026-09-10T11:23:03+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

```text
Solution / project / source / assets
  -> project evaluation -> C# parser/binder/lowering -> JavaScript
                       -> XAML compiler -> construction/resource metadata

IL text ---------------------------+
DLL / EXE -> PE/CLI metadata -> IL verifier -> JavaScript method bodies
NuGet -> validated executable assets+
PDB / embedded symbols / approved restoration -> verified source/IL metadata

Generated code + shared managed operations + Avalonia/browser UI runtime
  -> HTML / SVG / explicitly implemented WebGPU rendering paths
  -> isolated application preview or standalone browser export

Development metadata / continuations / source edit transactions
  -> debugger, designer, reload planner and operational desktop tool windows
```

## Canonical versus preserved prototype APIs

The primary source workbench uses the project-system/C# backend and XAML compiler. The verified MSIL route is `msil-compiler/verified.js`; asynchronous symbol preparation is layered through `msil-compiler/debug.js`. Source/binary linkage is in `binary-project`. Earlier compact APIs or secondary frontends remain separate where present; their existence does not make them interchangeable with verified entrypoints. See [actual exported APIs](api-reference.md) and [binary entrypoints](binary-entrypoints.md).

## Runtime and rendering boundaries

Managed exceptions, numerics, type/member resolution, source and converted libraries share explicit runtime contracts. UI controls own properties, events, bindings, namescopes and lifecycle. Normal and resumable construction use shared traversal where implemented. The rendering backend must be identified per feature: native SVG geometry/brush/mask output is not WebGPU tessellation. Browser layout support is not automatically full Avalonia measure/arrange compatibility.

## Development tooling

The compilers emit source identity and optional continuation/debug metadata. Debugger sessions own tasks/frames and support native-engine or cooperative execution without mixing them. Designer libraries inspect/edit source with preimage checks. Reload libraries plan compatible method/property/tree/environment changes and preserve or roll back owned state. The workbench is a client: moving docked views must not clone their controllers, and switching source/binary perspectives must not merge runtime state.

## Trust boundaries

Imported source, IL, DLLs, packages and symbols are inputs, not permission to execute in the IDE origin or fetch arbitrary URLs. Preview CSP/sandbox and authenticated messages are distinct protections. Explicit symbol restoration runs in a trusted tool context with separate origin approval and bounded downloads; verified original source remains read-only debugger attachment data. See [security](security-and-trust.md).

## Actual reusable package inventory

The inventory is generated from the checkout; it describes organization, not completeness.

| Package | JavaScript files | Entrypoint/source |
| --- | --- | --- |
| `avalonia-runtime` | 16 | [packages/avalonia-runtime/index.js](../packages/avalonia-runtime/index.js) |
| `binary-project` | 2 | [packages/binary-project/index.js](../packages/binary-project/index.js) |
| `build-profile` | 6 | [packages/build-profile/index.js](../packages/build-profile/index.js) |
| `compiler-core` | 3 | [packages/compiler-core/index.js](../packages/compiler-core/index.js) |
| `csharp-compiler` | 5 | [packages/csharp-compiler/index.js](../packages/csharp-compiler/index.js) |
| `development` | 22 | [packages/development/binary-preview.js](../packages/development/binary-preview.js) |
| `dotnet-runtime` | 3 | [packages/dotnet-runtime/index.js](../packages/dotnet-runtime/index.js) |
| `il-runtime` | 1 | [packages/il-runtime/index.js](../packages/il-runtime/index.js) |
| `language-service` | 1 | [packages/language-service/index.js](../packages/language-service/index.js) |
| `managed-pe` | 9 | [packages/managed-pe/index.js](../packages/managed-pe/index.js) |
| `msil-compiler` | 13 | [packages/msil-compiler/index.js](../packages/msil-compiler/index.js) |
| `msil-runtime` | 5 | [packages/msil-runtime/index.js](../packages/msil-runtime/index.js) |
| `native-pdb` | 3 | [packages/native-pdb/index.js](../packages/native-pdb/index.js) |
| `nuget` | 2 | [packages/nuget/index.js](../packages/nuget/index.js) |
| `portable-pdb` | 3 | [packages/portable-pdb/index.js](../packages/portable-pdb/index.js) |
| `project-system` | 3 | [packages/project-system/index.js](../packages/project-system/index.js) |
| `renderer` | 1 | [packages/renderer/index.js](../packages/renderer/index.js) |
| `symbol-restoration` | 3 | [packages/symbol-restoration/index.js](../packages/symbol-restoration/index.js) |
| `workbench` | 26 | [packages/workbench/binary-client.js](../packages/workbench/binary-client.js) |
| `workspace` | 2 | [packages/workspace/diff.js](../packages/workspace/diff.js) |
| `workspace-changes` | 1 | [packages/workspace-changes/index.js](../packages/workspace-changes/index.js) |
| `xaml-compiler` | 2 | [packages/xaml-compiler/index.js](../packages/xaml-compiler/index.js) |

## Extension obligations

Add semantics in the canonical parser/binder/verifier/runtime layer, not a sample-specific patch. A new capability must include positive/negative tests, source locations, debugger behavior, designer editability and reload/disposal impact. Update the versioned requirement mapping and strict upstream acceptance gates in the same change.
