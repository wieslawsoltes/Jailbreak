# Designer workspace

<!-- jailbreak-current-documentation:begin -->
> **Specialized guide / example; current applicability audited 2026-09-10.** This document is a specialized profile/example, not a full-solution completion claim. Use [current source and CI status](../../docs/current-status.md), [full requirements](../../docs/requirements.md), and [remaining acceptance work](../../docs/remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](../../docs/ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

Run this actual C#/XAML sample, then switch to Designer. Enable Hot reload. Select
Preview, then Shift-click Validate and Publish. Align Top and Distribute
Horizontally write their literal Canvas coordinates as one undoable source edit.
Drag the selection label to move the group. Snap uses an 8-pixel grid; Alt bypasses
snapping, Shift constrains the movement axis, and Escape cancels an unfinished drag.

Changing zoom never changes the application viewport dimensions, reconstructed
control identities or source. Device presets change the actual iframe viewport;
this is not a screenshot. Split/Code/Binary views retain the existing iframe.

Select CodeAction in the hierarchy: the inspector shows `Created in C#`, from the
last `action.Content` assignment rather than the overwritten initializer. Editing
it updates that exact assignment. Constructor edits still require an explicit
restart; changing the source is not confused with method-body hot reload.

This example exercises the supported literal Canvas and straight-line C# designer
profile. Arbitrary control flow and dynamic property expressions remain protected.
