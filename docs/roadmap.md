# Roadmap to the complete browser development system

> Audit input: [`92cfb4ddc1f3`](https://github.com/wieslawsoltes/Jailbreak/tree/92cfb4ddc1f35e1ae3fa9093d7ed04a041d75d4c); documentation reconciled 2026-09-10T11:42:51+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

The roadmap retains the original full product expectation; it is not a list of capabilities assumed complete because an initial subset ships.

| Order | Deliverable | Dependencies and exit gate |
| --- | --- | --- |
| 1 | Reproducible unchanged whole-ControlCatalog input and blocker inventory | Requested upstream fork/revision, original project/source/dependencies, no suppressed failures |
| 2 | Missing language/type/runtime and project-linking semantics | Independent source/IL/CLR cases, negative diagnostics and shared source/binary behavior |
| 3 | Complete required XAML, controls, layout, data and platform behavior | Original page/application interaction and rendered-reference gates |
| 4 | General safe C# visual round-trip and full required debug/reload coverage | Ownership/control-flow analysis, actual continuations, transactional lifecycle evidence |
| 5 | Remaining symbols and professional IDE depth | Format-specific validation, consent-based restoration, real integrated command/window/editor workflows |
| 6 | Full-profile release and ongoing conformance | Entire unchanged application and declared language/framework profile pass, offline artifacts and exact CI/deployment provenance |

Debugger, designer, reload, accessibility and documentation work runs alongside every stage rather than waiting for stage 4 or 5. See [full requirements](requirements.md), [current implementation](current-status.md), [completed work](completed-work.md), [detailed remaining work](remaining-work.md) and [acceptance plan](acceptance-plan.md).
