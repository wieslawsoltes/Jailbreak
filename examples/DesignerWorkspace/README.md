# Designer workspace

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
