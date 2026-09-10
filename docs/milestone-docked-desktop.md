# Docked desktop IDE and shared execution tools

<!-- jailbreak-current-documentation:begin -->
> **Historical milestone; current applicability audited 2026-09-10.** The implementation details and test totals below record this milestone, not the complete present-day product. Its old remaining/unsupported lists and UI instructions may have been superseded. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

This milestone replaces the combined inspector and informational sidebar panes
with controller-backed tool windows. Compatibility documentation remains in
`docs/` and the Help menu; the editor no longer spends permanent workspace space
on Getting Started or Compatibility Gates text.

## One composition of existing tools

Solution Explorer, Document Outline, Properties, Layout, Toolbox, Find Results,
Error List, Output, Call Stack, Locals, Watch, Breakpoints, Tasks, Debug Console,
Debug Settings and Symbols & Sources are independent registered tool windows.
The docking host **moves their actual DOM nodes**, retaining existing event
handlers and source transactions. It does not clone the preview or reconstruct
its application while a tool is moved. Designer selection, Grid/artboard edits,
hot reload, watches and source assistance still use their existing controllers.

The menu bar provides pointer/keyboard menus and nested Tool Windows/Layout
menus. The command palette and menu items use the same command registry and
availability predicates. Alt+F/E/V/P/B/D/T/W/H opens menus; arrow keys navigate,
Enter invokes and Escape closes. Ctrl+Shift+P opens the command palette.

Drag a tool title or tab to a docking target, double-click the title to float,
or use the title's menu to dock, auto-hide, move or close it. Floating windows
have bounded position/size and keyboard resizing. Auto-hidden windows open as
flyouts and can be pinned. Side, bottom and internal group splitters support
pointer and keyboard movement. Code, Design, Debug and Binary presets are
available, as are reset and up to twelve named layouts. Layout data contains
validated tool IDs and geometry, not source files or code. Persistent storage
is used when permitted; opaque/file contexts retain named layouts for the
current page session instead and report that fallback.

## Source and binary sessions

The source preview and the embedded Binary Studio remain independent isolated
execution sessions. The selected document perspective determines which session
owns the main Start/Continue, stepping and stop commands and the shared stack,
locals, watches and breakpoint windows. Switching contexts does not merge their
tasks or discard the other session's application state.

The embedded Binary Studio omits its standalone header, promotional sidebar
and redundant execution controls. IL, disassembly, JavaScript/package views,
method/argument selection and diagnostics remain the actual binary compiler.
The standalone/exported binary runner still includes its own usable controls.

Keyboard events do not naturally bubble through iframes. A **fixed shortcut
allowlist** relays trusted palette, navigation and execution gestures through
the existing authenticated preview channels. Each hop checks its sender window
and session channel. The parent also checks the currently selected source or
binary context. No arbitrary event, script, keylogging or editing-command
transport is introduced. Standalone exports do not intercept IDE shortcuts.

## Verification

`tests/docking-model.test.js` verifies registered identities, docking transitions,
active tabs and restored geometry. `tests/browser/test_docking.py` operates real
menus, title dragging, floating/redocking, auto-hide, named layouts, toolbox hot
reload, isolated source/binary sessions and mobile layouts. Existing browser
tests now navigate the exposed tool windows through `desktop_ui.py` instead of
clicking retired hidden controls; their original compilation, state, debugger,
rendering and source-edit assertions remain required.

The source/runtime limitations in the mandatory-target contract remain in
force. This is not unrestricted docking-tree topology, native OS tool windows,
full language-service/refactoring parity or full ControlCatalog compatibility.
Source and binary execution remain in script-only sandboxed frames; no network
permission is granted to applications by the IDE's opt-in symbol downloader.
