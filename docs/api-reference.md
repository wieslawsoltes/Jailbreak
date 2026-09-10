# Reusable API entrypoints

> Audit input: [`92cfb4ddc1f3`](https://github.com/wieslawsoltes/Jailbreak/tree/92cfb4ddc1f35e1ae3fa9093d7ed04a041d75d4c); documentation reconciled 2026-09-10T11:42:51+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

The names below are extracted from current authored modules. This is an entrypoint index, not a claim that every argument/type/API combination is supported. Read the linked source and tests for exact option/result contracts; retain `success`/diagnostic checks and never execute a failed result.

| Module | Exported names found in source |
| --- | --- |
| [packages/project-system/index.js](../packages/project-system/index.js) | `Workspace`, `compileProject`, `evaluateProject`, `executable`, `normalizePath`, `readProject`, `readSolution` |
| [packages/project-system/backend.js](../packages/project-system/backend.js) | `Workspace`, `compileProject`, `executable`, `normalizePath`, `readProject`, `readSolution` |
| [packages/csharp-compiler/index.js](../packages/csharp-compiler/index.js) | `compileCSharp`, `lexCSharp`, `parseCSharp`, `preprocessCSharp` |
| [packages/csharp-compiler/backend.js](../packages/csharp-compiler/backend.js) | `compileCSharp`, `lexCSharp`, `parseCSharp` |
| [packages/xaml-compiler/index.js](../packages/xaml-compiler/index.js) | `compileXaml`, `parseMarkup` |
| [packages/avalonia-runtime/index.js](../packages/avalonia-runtime/index.js) | `Binding`, `BindingMode`, `Brushes`, `Color`, `Colors`, `CornerRadius`, `Dispatcher`, `JB`, `Point`, `Rect`, `Size`, `SolidColorBrush`, `TemplateAppliedEventArgs`, `Thickness`, `Uri`, `createRuntime` |
| [packages/msil-compiler/verified.js](../packages/msil-compiler/verified.js) | `compileAssemblies`, `compileAssembly`, `compileIL`, `decodeIL`, `disassemble`, `parseIL`, `readAssembly`, `verifyMethod` |
| [packages/msil-compiler/debug.js](../packages/msil-compiler/debug.js) | `compileBinaryInputs`, `compileDebugAssemblies` |
| [packages/msil-runtime/index.js](../packages/msil-runtime/index.js) | `adapterInventory`, `createBinaryRuntime` |
| [packages/binary-project/index.js](../packages/binary-project/index.js) | `compileBinaryProject`, `compileNugetProject`, `linkBinaryCompilation` |
| [packages/binary-project/workspace.js](../packages/binary-project/workspace.js) | `compileWorkspaceInputs`, `decodeBinaryRecord`, `encodeBinaryFile` |
| [packages/nuget/index.js](../packages/nuget/index.js) | `convertNuget`, `convertNugetPackages`, `crc32`, `inspectNuget`, `normalizeFramework`, `readZip`, `satisfiesVersion` |
| [packages/portable-pdb/index.js](../packages/portable-pdb/index.js) | `decodeSequencePoints`, `digest`, `inflateBounded`, `pdbSources`, `readPortablePdb`, `signedCompressed` |
| [packages/portable-pdb/symbols.js](../packages/portable-pdb/symbols.js) | `debugSymbols`, `prepareDebugAssembly` |
| [packages/native-pdb/index.js](../packages/native-pdb/index.js) | `isNativePdb`, `readMsf`, `readNativePdb` |
| [packages/symbol-restoration/index.js](../packages/symbol-restoration/index.js) | `approvedOrigins`, `checkedUrl`, `parseSourceLink`, `planSymbolRestore`, `resolveSourceLink`, `restoreSymbols`, `sourceLinkFromPdb`, `symbolStoreKey` |
| [packages/development/designer.js](../packages/development/designer.js) | `EditHistory`, `duplicateControl`, `editExpression`, `editProperty`, `insertControl`, `inspectSource`, `moveControl`, `palette`, `removeControl`, `reparentControl`, `sourceLocation` |
| [packages/development/reload.js](../packages/development/reload.js) | `liveProperties`, `planReload`, `reloadScript` |
| [packages/development/cooperative-debugger.js](../packages/development/cooperative-debugger.js) | `createCooperativeDebugger` |
| [packages/workbench/dock-model.js](../packages/workbench/dock-model.js) | `DOCK_MODES`, `DOCK_ZONES`, `DockLayout`, `dockSizes`, `floatRect`, `restoreDockLayout` |
| [packages/workbench/debug-context.js](../packages/workbench/debug-context.js) | `createDebugContext` |

## Input, output and lifecycle rules

Source workspaces, evaluated projects and binary records are not interchangeable structures. Symbol preparation is asynchronous and must complete before verified binary emission. Register/link assemblies with the matching runtime instance and preserve type identity. Source maps and original documents belong only in deliberate development output. Runtime/development/preview handles must be disposed when replacing a session.

Design edits and refactors are source transactions, not unchecked string replacements. Reload plans are revision-bound; do not apply an incompatible plan or substitute a successful older result for a failed current compilation. A restored symbol attachment must be validated against the unchanged DLL record before publishing it.

The [build guide](build-and-verification.md) lists exact package scripts from this revision. [Architecture](architecture.md), [compatibility](compatibility.md) and the linked tests define each entrypoint's supported profile.
