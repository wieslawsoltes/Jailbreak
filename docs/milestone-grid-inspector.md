# Source-backed Grid inspector and live track editing

<!-- jailbreak-current-documentation:begin -->
> **Historical milestone; current applicability audited 2026-09-10.** The implementation details and test totals below record this milestone, not the complete present-day product. Its old remaining/unsupported lists and UI instructions may have been superseded. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

The merged desktop/source-intelligence stages were verified at `1a71c4d73acf31e24759e863de62ec591b4804cf`. No open pull requests remained at this round's reconciliation. The earlier screenshot of a Grid inspector did not establish that its implementation was in that source tree. This milestone adds the missing executable Grid inspector and its regression tests to the existing Studio, without replacing any debugger, designer or compiler implementation.

## Designer workflow

Select **Grid Designer**, choose the **Designer** perspective, and enable **Hot reload**. Select `Layout` or a direct child in the visual hierarchy. The **Grid layout** inspector exposes row/column definitions (pixels, Auto and weighted stars), indexed track insertion/removal, child row/column/spans, spacing and a clickable cell map. Track chips show the index and size. Cells show occupants in tooltips, including overlapping/spanning children. Oversized maps are omitted rather than creating unbounded DOM.

A track insertion moves children starting at/after the insertion and expands spans that cross it. Removal shifts following children and contracts crossing spans. Replacing definitions clamps out-of-range child coordinates/spans. All affected attributes form **one preimage-checked undoable source transaction**; edits are applied in descending element-offset order. Comments, prefixes, unrelated attributes and CRLF survive. A failed edit does not replace source or the running application.

**Select**, **Pan**, and **Interact** are separate artboard tools. Interact disables picking and the panning overlay so the actual application can receive input/clicks at the current zoom. It does not start another application instance. Switch back to Select to edit the same running controls.

## Reused architecture

- `avalonia-runtime/grid-layout.js`: shared shorthand parsing, CSS track emission and effective placement/clamping.
- `development/grid-editor.js`: source-only inspection and track/cell edit planning.
- `workbench/grid-tools.js`: an inspector client using the existing developer session and edit/history/build hooks. No live runtime objects cross the iframe boundary.
- The existing `liveProperties` contract and transactional reload planner apply supported track/gap edits to retained Grid/child instances.

Grid children default to `(0,0)` with span one, not browser auto-placement. Without definitions there is a single star track. Indices and spans clamp at explicit track edges; they do not create implicit tracks. Parent definition changes refresh retained children's CSS placement. Zero-weight stars stay zero instead of becoming `1*`. Invalid CSS expressions are not accepted as Grid sizes.

## Verification

`tests/grid-editor.test.js` covers track parsing, default and edge placement, insertion/removal/span adjustment, expanded/bound definitions, source preservation, undo and live runtime identity/input/handler preservation. `tests/browser/test_grid_tools.py` edits the real compiled sample: it inserts tracks, changes cells/gaps, undoes changes and checks DOM positions, input, counters and root identity. Browser tests also reject invalid track expressions and verify overlapping default children.

The canonical CI serves the generated site over HTTP. The local offline test mode (`JAILBREAK_INLINE_TEST=1`) exercises the same bundled application when this execution environment blocks localhost navigation; it is not a substitute UI. Existing full browser and CLR gates remain required for publication.

## Supported boundary

This is the shorthand, direct-child Grid editing profile. Expanded definition elements with min/max/shared-size constraints, transformed/template instances, bound definitions or bound coordinates require explicit source editing. Auto uses intrinsic CSS sizing; exact Avalonia measure/arrange equivalence, shared-size groups and all constraint interactions are not claimed. General imperative C# layout round-tripping and the complete unchanged ControlCatalog remain mandatory targets.

Primary behavior reference: https://docs.avaloniaui.net/controls/layout/panels/grid
