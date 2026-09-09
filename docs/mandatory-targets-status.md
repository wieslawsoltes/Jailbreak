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

## Recovery baseline

At the start of this implementation round, remote `main` was `a83b295a0f727c9e72309649e7c388f10a4c3604`. It includes symbol recovery and two subsequent source-integration commits. The previous final report did not establish publication of its redesigned workbench or remote-restoration code. Reconcile existing files before new edits; do not replace newer source with an older archive or count staged transport data as deployed code.

Per-milestone documents and actual test reports supply implementation status. The canonical Toolchain verification and Pages workflow is the hosted deployment gate. A local passing test run is not evidence that GitHub Pages has updated.
