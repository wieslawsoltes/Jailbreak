# Keyed panel hot reload and designer duplication

<!-- jailbreak-current-documentation:begin -->
> **Historical milestone; current applicability audited 2026-09-10.** The implementation details and test totals below record this milestone, not the complete present-day product. Its old remaining/unsupported lists and UI instructions may have been superseded. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

Debugging, design and hot reload remain mandatory core features. This round extends the existing Develop panel; it does not add a second designer or a second UI runtime.

## Delivered behavior

Builtin `Panel`, `StackPanel`, `WrapPanel`, `Grid`, `Canvas` and `DockPanel` direct-child lists can insert, delete and reorder supported XAML subtrees without replacing the application root. Named siblings use `Name`/`x:Name` identities. Anonymous controls are matched by unchanged semantic content, then by an unambiguous remaining type match. Ambiguous surviving anonymous siblings require restart instead of assigning existing state to a guessed control. The palette now gives additions unique names.

The designer **Duplicate** action clones a literal XAML subtree, generates fresh names for all named descendants and preserves comments, formatting and CRLF. Binding/resource expressions in duplicates are rejected until reference remapping is implemented. Each insertion, duplication, deletion, reorder and resize remains one preimage-checked undo/redo transaction. Compatible panel edits now apply live when **Hot reload on build** is enabled.

Existing retained control objects and DOM elements keep their identity. Input text, selection/caret, instance state, existing method-group subscriptions and trailing C#-constructed children survive. Structural additions use the existing XAML loader, not an approximate DOM-only representation. New named children become available through `FindControl` and the owner name fields. Source identities and loaded-document records advance only after a successful update. Removed control subscriptions and events are disposed after commit, not during speculative staging. Disposal attempts all cleanup operations even when user unload/disposal callbacks throw; such failures are reported as post-commit warnings.

## Reusable architecture

`packages/development/structure.js` contains source-tree matching and static eligibility checks. Named/signature/type indexes avoid repeatedly scanning all siblings. `structure-runtime.js` indexes live source locations once, prepares additions detached, checks parent ownership/namescope conflicts and provides apply, rollback, focus restore and post-commit cleanup operations. The development session composes these operations with the existing property-store and method-descriptor transaction. The normal control renderer now orders retained DOM nodes to match the collection instead of merely appending missing nodes.

Preflight rejects missing/repeated template targets, live name collisions, non-panel changes and unexpected application mutations of source child order. A failure while loading a new subtree or rendering the result restores the old hierarchy, name maps, owner fields, properties and methods, and disposes speculative new instances. A failed revision does not advance the session. External side effects already performed by user callbacks cannot be rolled back; observer/disposal failures after commit are warnings, not a claim that the applied UI was reverted.

## Boundaries

This is **panel structural reload**, not general tree surgery. Reparenting retained controls, replacing content-host roots, templates, property-element child collections, resources/styles and bindings require restart. Added subtrees are builtin controls with literal properties and named event handlers; new resource/binding/template expressions are not live-added yet. Existing removed subtrees can contain bindings, which are disposed. Surviving references to removed names block reload. Runtime-only trailing panel children are retained; interleaved application-owned children or application changes to source child order are rejected.

The full debugger, arbitrary C# designer round-tripping, general hot reload and unmodified complete ControlCatalog are still unfinished. New source controls receive XAML source identities and existing debugger construction/inspection hooks. Removed selections are cleared. No release instrumentation is added by this feature.

## Tests and reproduction

Use the **Developer Tools** example. Enable development tools and hot reload, type into the input, increment the counter, select `Panel`, and insert a CheckBox. Select it and use **Duplicate**, **Delete**, **Undo design** and **Redo design**. The root and input remain the same objects.

`tests/structural-reload.test.js` covers names, retained identities, events, nested additions, disposal, unexpected runtime edits, repeated cycles, rollback, unsafe name collisions and restart diagnostics. `tests/browser/test_development.py` additionally verifies actual DOM order, retained input/selection, palette/duplicate/delete and undo/redo without iframe reconstruction. Run the normal unit/gate/build/check/browser pipeline. Full ControlCatalog remains explicitly not passing.

Related: [mandatory core contract](core-development-tools.md), [development tools](milestone-development-tools.md), [architecture](architecture.md).

Reference: Avalonia's logical/visual trees and their relationship to names, resources and inheritance: https://docs.avaloniaui.net/docs/fundamentals/visual-and-logical-trees
