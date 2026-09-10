# Remaining work to the full requested solution

> Audit input: [`9b73d1167983`](https://github.com/wieslawsoltes/Jailbreak/tree/9b73d1167983076687cf078a3992144e4a18794a); documentation reconciled 2026-09-10T11:23:03+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

**The work below remains part of the contract.** It is not removed from scope because current versions implement narrower profiles. Priorities describe dependencies, not promised completion dates or unsupported effort estimates. Completed profile work remains recorded in [completed work](completed-work.md); each remaining area is mapped to [stable requirements](requirements.md).

## P0 — Establish the strict whole-project target

Pin the requested Avalonia fork/revision and capture all original ControlCatalog solution/project inputs, transitive dependencies, assets, themes and generated inputs. Run the existing source/binary pipeline against this whole manifest and publish blockers by original file/feature. Keep selected-page success separate. Build a strict gate that fails on any excluded/replaced page, suppressed unsupported diagnostic, missing dependency or required behavior. Do not set fullControlCatalogPassed from an example count or source-preservation check.

## P0 — Finish compiler/runtime prerequisites

Use the blocker inventory to extend binding/type resolution, overloads/conversions, managed reference and value semantics, generics/constraints, framework calls and SDK async/iterator state-machine lowering. For ref/out, use the owned reference fixtures but also implement and compare actual address/indirection/alias/lifetime behavior in all claimed modes. For SDK async, test independently built Debug/Release DLLs and packages with multiple awaits, nested callers, cancellation and failure/cleanup; source C# async tests are not the same gate.

## P0 — Finish UI/XAML behavior against real inputs

Complete required control families, measurement/arrangement, data/selection/virtualization, binding modes and relative/template binding, selectors/property precedence, resources/templates and browser platform adapters. Add interaction and rendered-image checks for upstream expectations with explicit tolerances. Identify HTML/SVG/WebGPU backend ownership and fallback/device-loss/performance behavior without relabeling SVG as GPU output.

## P0 — Generalize safe designer and debug/reload behavior

Extend imperative C# ownership analysis beyond straight-line aliases/final literals into branches, loops, escapes, callbacks and interprocedural construction. Preserve source and references across every edit. Expand general layout/constraint/template/binding editing instead of forcing coordinates. Complete resumable accessor/callback/lazy-resource/template construction where required. Expand state-machine/managed-reference debugger semantics and retained frame/site handling. Define safe reload or explicit restart for every new feature, with cancellation/rollback/disposal evidence.

## P1 — Complete symbol format/restoration profiles

Maintain the delivered portable, embedded-portable, managed MSF7/C13 and explicitly approved restoration routes. Extend legacy/native profiles only with format-specific decoders and independent Windows/compiler evidence. Native machine-code symbols do not imply native execution support. Server authentication/CORS, source-server formats, symbol packages and unsupported embedded data need explicit permission and validated behavior; no automatic script execution or guessed source.

## P1 — Continue desktop IDE parity

Extend measured editor/language-service depth, semantic refactoring, reliable project/dependency/configuration workflows, test/profiling integrations, document/diff navigation, accessibility and performance. Preserve genuine menu/docking/window/session integration and existing designer/debugger features. Add each capability to the command registry and acceptance matrix, not decorative controls or text-only panels. Treat multi-caret/advanced editing and general language-server behavior as explicit tasks rather than inferred from syntax highlighting/completion.

## P0 — Final acceptance and release

Run full declared language/framework conformance, whole upstream application compile/link/run, all page navigation/interaction/rendering gates, representative source/binary debugging, safe designer edits and state-preserving reload, repeated lifecycle stress and standalone export. Record exact source/tool/browser/OS/GPU profiles. Publish only after the canonical verify and Pages jobs pass for the final committed revision; keep limitations and unresolved issues visible until their gates actually pass.

## Requirement-group backlog

| Priority | Group | Work not established as full acceptance | Evidence needed to close |
| --- | --- | --- | --- |
| P0 | PROD | The complete integrated product, unrestricted application compatibility and desktop IDE parity require end-to-end acceptance; the existence of modular packages does not establish that end state. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |
| P0 | PROJECT | Full original solution/project evaluation, transitive dependencies, generated inputs, build configurations and browser platform adaptation must be demonstrated on unchanged real projects. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |
| P0 | CS | Complete declared C# language semantics, general type-system/overload behavior and comprehensive .NET library compatibility are not established by the current isolated sample gates. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |
| P0 | XAML | Full Avalonia XAML syntax/type resolution, binding and template semantics, arbitrary markup extensions and every ControlCatalog document require broader acceptance than individual pages. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |
| P0 | UI | Complete Avalonia controls, measure/arrange behavior, data virtualization, input/accessibility and platform parity remain subject to full application and visual gates. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |
| P0 | BINARY | Arbitrary SDK-generated async/iterator state machines, general generics/value types/byrefs, reflection and complete framework-call semantics remain mandatory unless exact current acceptance proves them. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |
| P1 | SYMBOL | Legacy MSF2/C11, native machine-code/register records, legacy native embedded source, native async metadata and unrestricted server/authentication/format coverage are distinct outstanding profiles. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |
| P0 | DEBUG | Full source/binary async state-machine coverage, every callback/accessor/lazy-construction suspension point and complete debugger expression/transport parity are not established by present subset tests. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |
| P0 | DESIGN | General branch/loop/interprocedural ownership analysis, arbitrary imperative C# visual edits, all layout constraints/templates/bindings and full professional design-tool parity remain required. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |
| P0 | RELOAD | Arbitrary type-shape, active-frame/closure migration, resources/templates/imperative edits and external side-effect rollback are not automatically supported by property-store transactions. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |
| P1 | IDE | Full Visual Studio/Rider-level editing, language services, navigation/refactoring, project/dependency tooling, accessibility and desktop integration remain a measured end-state target, not a branding/style claim. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |
| P0 | CATALOG | Compile/link/construct/run and visually/behaviorally validate the complete pinned original solution/project with its real dependencies, themes, assets and code-behind. Keep fullControlCatalogPassed false until that actual gate succeeds. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |
| P0 | QUALITY | Expand full-version conformance, upstream coverage, cross-browser/GPU/accessibility/performance evidence and adversarial testing alongside every remaining implementation target. | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |

## Handoff rules

A future round starts from a fresh read of main, current source and CI. Preserve dirty local work and staged transport data separately; reconcile instead of overwriting. Select the next concrete blocker, implement reusable semantics, add independent and browser/tooling tests, update this record, and publish granularly. A partial milestone must state what changed and what remains; it must not repeat obsolete exclusions that current source has already closed.
