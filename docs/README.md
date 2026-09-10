# Jailbreak documentation

> Audit input: [`92cfb4ddc1f3`](https://github.com/wieslawsoltes/Jailbreak/tree/92cfb4ddc1f35e1ae3fa9093d7ed04a041d75d4c); documentation reconciled 2026-09-10T11:42:51+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

Start with the expected finished solution, then read actual implementation/evidence and the remaining acceptance plan. The current guides below take precedence over historical milestone status statements. Source and tests remain the authority for precise supported behavior.

| Question | Current guide |
| --- | --- |
| What exactly was requested? | [Full requirements](requirements.md) and [traceability](requirements-traceability.md) |
| What is in the audited source and what passed? | [Current status](current-status.md), [completed work](completed-work.md), [evidence JSON](audit/evidence.json) |
| What is still needed for the full solution? | [Remaining work](remaining-work.md), [roadmap](roadmap.md), [mandatory target status](mandatory-targets-status.md) |
| How is the reusable system organized? | [Architecture](architecture.md), [API entrypoints](api-reference.md), [binary routes](binary-entrypoints.md) |
| How do I use the current integrated IDE? | [IDE guide](ide-guide.md) |
| Which profiles and trust boundaries apply? | [Compatibility](compatibility.md), [security/trust](security-and-trust.md) |
| How is correctness established? | [Build and verification](build-and-verification.md), [acceptance plan](acceptance-plan.md) |
| What is mandatory for every implementation increment? | [Core development tools](core-development-tools.md), [documentation maintenance](documentation-maintenance.md) |

The contract contains **138 stable requirements in 13 groups**. A requirements inventory is not a completed-feature count.

## Historical milestones and specialized records

These documents retain implementation detail and original evidence. Their current-applicability notices prevent old exclusions, test totals, recovery uncertainty and retired UI instructions from being mistaken for current global status.

| Document | Role |
| --- | --- |
| [Jailbreak — complete product specification, implementation status, and remaining work](PROJECT_SPECIFICATION.md) | Specialized guide |
| [Binary compilation in Jailbreak](binary-compilation-design.md) | Specialized guide |
| [Boundary expansion acceptance ledger](boundary-expansion.md) | Specialized guide |
| [Browser-native compiler toolchain](browser-toolchain.md) | Specialized guide |
| [In-IDE debugging through compiled continuations](cooperative-debugging.md) | Specialized guide |
| [Developer-tool regression boundaries](development-tool-regressions.md) | Specialized guide |
| [Getting started](getting-started.md) | Specialized guide |
| [Build profiles milestone — 2026-09-08](milestone-build-profiles.md) | Historical milestone |
| [Constructor chains and debugger integration](milestone-constructor-chains.md) | Historical milestone |
| [Source-backed designer canvas](milestone-design-canvas.md) | Historical milestone |
| [Desktop composition and explicit symbol restoration](milestone-desktop-publication.md) | Historical milestone |
| [Developer tools: source debugging, visual design and hot reload](milestone-development-tools.md) | Historical milestone |
| [Docked desktop IDE and shared execution tools](milestone-docked-desktop.md) | Historical milestone |
| [Exception regions, checked arithmetic and source/binary recovery](milestone-exceptions.md) | Historical milestone |
| [Source-backed Grid inspector and live track editing](milestone-grid-inspector.md) | Historical milestone |
| [Flow-ordered imperative C# designer edits](milestone-imperative-designer.md) | Historical milestone |
| [Cooperative MSIL debugging in Studio](milestone-msil-continuations.md) | Historical milestone |
| [MSIL, managed DLL and NuGet conversion](milestone-msil-nuget.md) | Historical milestone |
| [Managed Windows PDB integration](milestone-native-pdb.md) | Historical milestone |
| [Portable PDB source debugging](milestone-portable-pdb.md) | Historical milestone |
| [Resumable XAML and source constructors](milestone-resumable-xaml.md) | Historical milestone |
| [Worker-backed source assistance in Studio](milestone-source-intelligence.md) | Historical milestone |
| [Keyed panel hot reload and designer duplication](milestone-structural-reload.md) | Historical milestone |
| [Integrated Studio IDE](milestone-studio-ide.md) | Historical milestone |
| [Explicit symbol and original-source restoration](milestone-symbol-restoration.md) | Historical milestone |
| [Templates, shared XAML and ProgressBar milestone](milestone-templates-resources.md) | Historical milestone |
| [Unchanged upstream Canvas page and retained vectors](milestone-upstream-canvas.md) | Historical milestone |
| [Docked IDE and functional editor navigation](milestone-workbench-shell.md) | Historical milestone |
| [Workspace history, change review and reusable component extraction](milestone-workspace-refactoring.md) | Historical milestone |
| [Quality gates](quality-gates.md) | Specialized guide |
| [Execution and workspace boundaries](security.md) | Specialized guide |

The complete Markdown coverage/exclusion record is [documentation-index.json](audit/documentation-index.json). Upstream/vendor/license documents are intentionally preserved instead of rewriting provenance material.
