# Mandatory targets and evidence

This is a continuing implementation contract. None of the targets below is complete merely because a related API, sample, or test fixture exists.

| Target | Acceptance condition |
| --- | --- |
| Complete unmodified ControlCatalog | Original pinned upstream solution/project sources compile, link, construct, and pass interaction/visual gates without replacement pages or suppression of unsupported diagnostics. |
| General imperative C# visual round-tripping | Source-origin and ownership analysis supports actual construction/assignment/container operations, preserves unrelated source, detects ambiguity, and refuses unsafe rewrites. |
| Resumable XAML construction | Construction can pause, inspect, step and cancel without blocking the IDE, leaking partially constructed visuals or changing successful construction semantics. |
| MSIL/async continuation debugging | Existing verified IL operations preserve evaluation stack, call frames and exception/unwind state across pauses; state-machine support is measured against independent CLR results. |
| Complete language/framework compatibility | Positive/negative language tests and real upstream execution, not names added to a registry. Unsupported behavior remains an explicit diagnostic. |
| Symbol formats and restoration | DLL identity and original-source checksums are verified for portable, embedded and native PDB inputs; remote requests require explicit permission, budgets and validated origins. |
| Professional IDE | Real compiler/designer/debugger integration, responsive keyboard-accessible layout, reliable editing/navigation, error visibility and browser regression tests. |

Debugging, design, reload and disposal evidence remain required for each new core capability. Release artifacts must not silently include original sources or debugging hooks.

## Historical recovery baseline

At the start of an earlier recovery round, remote `main` was `a83b295a0f727c9e72309649e7c388f10a4c3604`. It includes symbol recovery and two subsequent source-integration commits. The previous final report did not establish publication of its redesigned workbench or remote-restoration code. Reconcile existing files before new edits; do not replace newer source with an older archive or count staged transport data as deployed code.

Per-milestone documents and actual test reports supply implementation status. The canonical Toolchain verification and Pages workflow is the hosted deployment gate. A local passing test run is not evidence that GitHub Pages has updated.

## Cooperative MSIL milestone

[MSIL continuations](milestone-msil-continuations.md) extend the existing verified AOT emitter and Studio debugger to converted managed methods. Cross-library/source frames, evaluation stacks, scoped PDB locals, static initialization, cancellation and exception cleanup are exercised through SDK-built DLL/NuGet fixtures and browser integration. This advances the MSIL debugging target for the compiler's supported instruction/type/API profile. Arbitrary SDK-generated async state machines, full framework semantics and the complete unmodified ControlCatalog are not declared complete.

Studio now exposes unsupported-symbol methods as read-only **[IL]** disassembly, never as reconstructed original C#. Existing verified original-source documents retain **[symbol]** labels. Source C# async callers can await before/after converted calls; that behavior is distinct from compiling an SDK async state machine from a DLL.

## Windows managed-symbol integration

[Native PDB integration](milestone-native-pdb.md) now validates MSF7/C13 managed
symbols against the existing independent Windows compiler/CLR fixture. Native
source/IL stepping, actual local mutation, sidecar source attachments, Studio and
offline Binary Studio share the Portable PDB path. This closes the missing
managed-Windows-PDB integration, not all native symbol formats. MSF2/C11, native
machine-code symbols, legacy native embedded source and native async metadata
remain outside the explicitly tested profile.

## Designer canvas and imperative source progress

[The artboard and multi-selection milestone](milestone-design-canvas.md) connects
real geometry operations to existing source transactions and hot reload.
[Flow-ordered local C# analysis](milestone-imperative-designer.md) targets final
literal writes through aliases; it does not claim unrestricted imperative
round-tripping. Remaining control-flow/ownership analysis and complete
ControlCatalog/async/framework targets retain their original acceptance gates.

## Original Canvas page

[The pinned Canvas-page gate](milestone-upstream-canvas.md) now verifies unchanged
XAML/C# source and actual vector/mask rendering through the primary runtime.
`tests/fixtures/upstream.json` now identifies the requested fork correctly and
keeps `fullControlCatalogPassed` false. The isolated host adapters and single
page do not establish full project, full framework or global visual parity.

## Integrated desktop tools and Grid editing

The three recovered desktop/source-intelligence stages are ordinary source on `main`
at `1a71c4d...`, with a successful canonical pipeline. No open pull requests were
pending at reconciliation. [Grid inspector](milestone-grid-inspector.md) adds actual
track/cell/span editing, source-preserving transactions, corrected default Grid
placement and a separate Interact artboard tool. This advances layout editing and
framework behavior without claiming full measure/arrange or ControlCatalog parity.

## Source transactions and reusable components

[Workspace review and component extraction](milestone-workspace-refactoring.md) share one bounded journal across editor/designer/refactor changes. Multi-file extraction uses real project evaluation before Apply, rejects ownership-sensitive references and requires explicit restart for a changed type/document set. This advances source-backed visual workflows without declaring arbitrary extraction, imperative C# round-tripping or full framework compatibility complete.

## Docked desktop recovery and explicit symbol restoration

The [desktop IDE composition](milestone-docked-desktop.md) replaces informational
sidebar panes and the combined inspector with real controller-backed tool
windows, menus, docking, floating, auto-hide and shared source/binary debugger
presentation. Existing designer, layout, refactoring and hot-reload functionality
is retained. Browser regressions navigate actual exposed windows, not hidden
legacy controls.

[Symbol restoration](milestone-symbol-restoration.md) supplies opt-in ordinary
symbol-store PDB downloads and checksum-verified Source Link retrieval. Approval
is independent for symbol servers and source origins; candidate bytes and the
source workspace are verified before explicit attachment/restart. Controlled
SDK/Windows fixture tests are not a claim that arbitrary feeds support CORS,
authentication or every native format.

The full unmodified ControlCatalog, unrestricted C# flow/interprocedural designer
analysis, SDK-generated async-state-machine IL and complete language/framework
compatibility remain unfinished mandatory acceptance targets. The new network
path does not change the execution or compatibility profile of a downloaded DLL.
