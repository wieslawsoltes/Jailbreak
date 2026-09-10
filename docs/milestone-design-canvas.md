# Source-backed designer canvas

<!-- jailbreak-current-documentation:begin -->
> **Historical milestone; current applicability audited 2026-09-10.** The implementation details and test totals below record this milestone, not the complete present-day product. Its old remaining/unsupported lists and UI instructions may have been superseded. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

The Studio Designer perspective now exposes the real running application as a
logical-pixel artboard. It is not a screenshot or a second UI implementation.
The source compiler, opaque-origin preview, debugger, designer transactions and
hot-reload runtime remain the execution path.

## Artboard and selection

Desktop, tablet and phone presets change the preview's actual viewport size.
25–200% zoom and Fit change only presentation; they preserve runtime object
identity and do not rewrite source. Rulers describe unzoomed design pixels.
Grid visibility, 8-pixel snapping, smart guides and artboard preferences persist
with the source workspace. Pan supports pointer/touch dragging and arrow keys.
Switching Code, Split, Designer and Binary views does not reconstruct the app.

Shift/Ctrl-click in the hierarchy or on the canvas toggles up to 128 selected
visuals. The primary selection has a named movement handle and a resize handle.
Dragging previews outlines only, not application mutations. Pointer-up commits
one source transaction; Escape/pointer cancellation discards it. Shift constrains
movement or aspect ratio; Alt bypasses snapping and guides. Zoomed pointer
coordinates are interpreted inside the iframe in logical pixels.

## Geometry editing

X/Y/W/H fields, six edge/center alignments, equal-gap horizontal/vertical
distribution and matching the first selected size produce source edits for the
whole selection. Multi-edit transactions apply descending original source spans
so inserted attributes cannot invalidate later positions. Undo/redo restores the
entire edit, and compatible hot reload retains control instances, typed input,
fields and event subscriptions.

Movement/alignment/distribution require same-document, same-Canvas XAML siblings
with literal Left/Top coordinates, no margins, opposing anchors or transforms.
Repeated template origins, ambiguous ownership, C#-constructed layout, expression
values and mixed parents are rejected rather than reassigned guessed coordinates.
The existing single-control property/resize designer still handles its separate
supported XAML and C# profiles. Generic Grid/StackPanel drag constraint solving,
rotation, free reparenting and multi-selection resizing are not implemented here.

Stale source text, paused execution, pending reloads and revision changes reject
layout intents before source is changed. Source mutation never occurs during
pointer movement. Changed source must be rebuilt before using its old geometry.

## Reusable modules

- `design-geometry.js`: bounded pure alignment, distribution, movement and guides.
- `design-transactions.js`: one preimage-checked source transaction per selection.
- `design-surface.js`: preview-owned overlays, selection, gestures and cleanup.
- `workbench/design-canvas.js`: Studio artboard, rulers and geometry inspector.

The existing authenticated parent/frame/session-channel protocol carries only
serializable geometry and source-edit intents. Controls and execution stay in
the script-only sandbox. No application source is evaluated by the IDE designer.

## Verification and example

Choose **Designer Workspace**, open **Designer**, enable **Hot reload**, select
the three action buttons with Shift, then align their top edges or distribute
them. Type into the input beforehand: its text and the application root survive.
The C#-constructed button demonstrates final-assignment source editing from
[the imperative designer milestone](milestone-imperative-designer.md).

Ten geometry/transaction tests cover bounding math, negative cases, budget limits,
CRLF preservation, protected bindings and undo/redo. Eight browser tests cover
actual multi-selection, alignment, distribution, snapped dragging, Escape,
zoomed physical pointer coordinates, stale source refusal, pan, device changes,
C# editing, preserved app identity and mobile overflow. Existing Studio and
native/cooperative debugger tests remain mandatory. The full hosted HTTP browser
suite is distinct from offline tests; local environments that block navigation
must not count those blocked tests as passing.

Full unmodified ControlCatalog, unrestricted C# round-tripping and complete
language/async/framework compatibility remain mandatory, not implied by this UI.
