# Mandatory targets: current status and acceptance

> Audit input: [`92cfb4ddc1f3`](https://github.com/wieslawsoltes/Jailbreak/tree/92cfb4ddc1f35e1ae3fa9093d7ed04a041d75d4c); documentation reconciled 2026-09-10T11:42:51+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

The canonical contract is [requirements.md](requirements.md); the source-grounded status is [current-status.md](current-status.md); implementation/test paths are in [requirements-traceability.md](requirements-traceability.md). This replaces recovery-era assumptions with an exact audit snapshot.

| Mandatory target | Current interpretation | Still required for full acceptance |
| --- | --- | --- |
| Complete unchanged ControlCatalog | Selected original-page and curated-example gates are distinct scopes | Complete pinned original project compile/link/construction/navigation/interaction/rendering and tooling evidence |
| General C# visual round-tripping | Source-preserving initializer and supported flow/alias editing is a profile | Safe arbitrary supported control-flow/interprocedural ownership and reference-preserving edits |
| Resumable construction and debugging | Source/XAML/MSIL continuation paths must be read from current code/tests | Remaining required callbacks/accessors/lazy construction and full SDK state-machine semantics |
| Full declared C#/.NET/Avalonia compatibility | Reusable compilers/runtime implement tested profiles | Complete versioned language/type/framework/project/UI acceptance without suppressed diagnostics |
| Symbols and restoration | Portable/embedded/native-managed profiles and explicit restoration are separately evidenced | Remaining formats/servers/authentication/embedded/async metadata under explicit safety and correctness gates |
| Desktop IDE parity | Operational menus/docking/windows/editor/designer/debugger integration is not merely a mockup | Advanced semantic/editor/project/tooling/accessibility/performance coverage measured against requirements |

No target is declared complete by an uploaded blob, fixture-generation success, unrelated test count or this documentation revision. Historical recovery commits and milestone test totals are preserved in the [work record](completed-work.md) and individually annotated milestone notes. The [remaining plan](remaining-work.md) gives dependencies and exit criteria, while [core-development-tools.md](core-development-tools.md) keeps debugging/design/reload obligations mandatory in every implementation increment.
