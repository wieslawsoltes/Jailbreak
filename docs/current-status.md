# Current implementation and evidence status

> Audit input: [`92cfb4ddc1f3`](https://github.com/wieslawsoltes/Jailbreak/tree/92cfb4ddc1f35e1ae3fa9093d7ed04a041d75d4c); documentation reconciled 2026-09-10T11:42:51+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

**The requested full solution is not declared complete.** The project has implemented and tested profiles; their scope must be read alongside the outstanding whole-application requirements. This document supersedes contradictory conversational publication reports and milestone-era exclusions. It does not make a new runtime compatibility claim from file names alone.

## Audited source and publication evidence

The implementation/gate input manifest is [source-inventory.json](audit/source-inventory.json); the complete evidence record is [evidence.json](audit/evidence.json). The input revision and source fingerprint remain fixed even as these documentation-only commits are published. A future code change requires a new audit.

| Canonical workflow run | Head | Status | Conclusion |
| --- | --- | --- | --- |
| [34472689673](https://github.com/wieslawsoltes/Jailbreak/actions/runs/34472689673) | `92cfb4ddc1f3` | in_progress | not concluded |

The latest successful canonical ancestor observed was [`1572fa187207`](https://github.com/wieslawsoltes/Jailbreak/commit/1572fa18720737f91f5e0a0651b4bf870aa01034), [run 34467875477](https://github.com/wieslawsoltes/Jailbreak/actions/runs/34467875477). 5 implementation or gate paths changed after that successful ancestor; its pass must not be represented as verification of the changed revision. See the exact path list in the evidence record.

## Capability status by acceptance group

| Area | Audited implementation | Audited verification files | Full acceptance |
| --- | --- | --- | --- |
| [PROD: Product, architecture and delivery](requirements-traceability.md#prod--product-architecture-and-delivery) | 22 located files | 21 located files | Required; not declared complete by inventory |
| [PROJECT: Solution, project and dependency handling](requirements-traceability.md#project--solution-project-and-dependency-handling) | 8 located files | 6 located files | Required; not declared complete by inventory |
| [CS: C# source compiler and managed semantics](requirements-traceability.md#cs--c-source-compiler-and-managed-semantics) | 11 located files | 4 located files | Required; not declared complete by inventory |
| [XAML: Avalonia-compatible XAML compiler](requirements-traceability.md#xaml--avalonia-compatible-xaml-compiler) | 5 located files | 2 located files | Required; not declared complete by inventory |
| [UI: UI framework, layout, rendering and platform services](requirements-traceability.md#ui--ui-framework-layout-rendering-and-platform-services) | 17 located files | 3 located files | Required; not declared complete by inventory |
| [BINARY: MSIL, DLL/EXE and NuGet conversion](requirements-traceability.md#binary--msil-dllexe-and-nuget-conversion) | 31 located files | 8 located files | Required; not declared complete by inventory |
| [SYMBOL: Symbols, source maps and restoration](requirements-traceability.md#symbol--symbols-source-maps-and-restoration) | 11 located files | 5 located files | Required; not declared complete by inventory |
| [DEBUG: Integrated C#, XAML, JavaScript and MSIL debugging](requirements-traceability.md#debug--integrated-c-xaml-javascript-and-msil-debugging) | 6 located files | 7 located files | Required; not declared complete by inventory |
| [DESIGN: Full visual designer and safe C#/XAML round-tripping](requirements-traceability.md#design--full-visual-designer-and-safe-cxaml-round-tripping) | 10 located files | 6 located files | Required; not declared complete by inventory |
| [RELOAD: Transactional state-preserving hot reload](requirements-traceability.md#reload--transactional-state-preserving-hot-reload) | 4 located files | 4 located files | Required; not declared complete by inventory |
| [IDE: Professional desktop-style IDE](requirements-traceability.md#ide--professional-desktop-style-ide) | 43 located files | 5 located files | Required; not declared complete by inventory |
| [CATALOG: Complete unchanged upstream ControlCatalog](requirements-traceability.md#catalog--complete-unchanged-upstream-controlcatalog) | 15 located files | 3 located files | Required; not declared complete by inventory |
| [QUALITY: Verification, security, performance and documentation maintenance](requirements-traceability.md#quality--verification-security-performance-and-documentation-maintenance) | 6 located files | 64 located files | Required; not declared complete by inventory |

## Current integrated workflows

The current reference architecture is the primary C#/XAML project pipeline, the verified MSIL pipeline, the shared Avalonia/browser runtime and the operational desktop workbench. Source and binary debugging use separate execution contexts with shared presentation. Native-engine source debugging and cooperative in-IDE continuations are distinct paths. Read-only **[symbol]** source is checksum-verified debugger input; **[IL]** is disassembly, not reconstructed C#.

The current IDE guide describes menus and independent tool windows. Earlier screenshots/instructions about permanent Compatibility Gates/Getting Started panes or one combined All tools/Designer/Debugger inspector are historical, not the desired/current design contract.

## Full upstream gate versus selected examples

The exact observations from the committed upstream manifest are:

```json
{
  "official.repository": "AvaloniaUI/Avalonia",
  "official.commit": "27c1ece36cbe17de3b8f95ae88223ba68702ae47",
  "requestedLibrary.repository": "wieslawsoltes/Avalonia",
  "requestedLibrary.commit": "b709c58c6b1b8aa3b90866c7c001b7bf82b6353b",
  "requestedLibrary.fullControlCatalogPassed": false
}
```

A curated sample named ControlCatalog, an unchanged isolated page, a host adapter and a full unchanged upstream project are different acceptance scopes. A selected-page gate or total example count must not be reported as full ControlCatalog execution. The [acceptance plan](acceptance-plan.md) defines the missing whole-project evidence.

## Managed-reference and SDK state-machine evidence

Located reference-related files: [scripts/build-reference-fixture.mjs](../scripts/build-reference-fixture.mjs), [tests/fixtures/reference-src/Library.cs](../tests/fixtures/reference-src/Library.cs), [tests/fixtures/reference-src/ReferenceLibrary.csproj](../tests/fixtures/reference-src/ReferenceLibrary.csproj).

A successful SDK/CLR fixture-generation job establishes the original program and expected values only. Ref/out support requires actual emitter/runtime lowering and JavaScript-vs-CLR comparison in each claimed mode. Saved Git blobs, transport stages and proposed comparison matrices do not count as a committed, passing implementation. Likewise, source C# async continuations do not establish compatibility with arbitrary SDK-generated async state-machine IL.

## Local checks captured during this documentation audit

| Check | Exit code | Recorded result |
| --- | --- | --- |
| unit | 0 | `{"tests": 474, "pass": 474, "fail": 0, "cancelled": 0, "skipped": 0}` |
| examples | 0 | `{}` |
| build | 0 | `{}` |
| syntax | 0 | `{}` |

## Completion claims that remain prohibited

Do not label all C#/Avalonia/.NET support complete; do not label SVG rendering as WebGPU tessellation; do not label a download/identity match as publisher authentication; do not call an attempted write a commit, a commit a passed CI run, or a passed verify job a successful Pages deployment. See [remaining work](remaining-work.md), [verification](build-and-verification.md) and [security](security-and-trust.md).
