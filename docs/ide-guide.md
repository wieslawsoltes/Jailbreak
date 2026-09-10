# Using the integrated desktop IDE

> Audit input: [`9b73d1167983`](https://github.com/wieslawsoltes/Jailbreak/tree/9b73d1167983076687cf078a3992144e4a18794a); documentation reconciled 2026-09-10T11:23:03+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

## Workspace model

Jailbreak is one development environment with source, split, designer and binary perspectives. The central document area contains editable source, the actual compiled preview or binary documents. Operational tool windows are docked independently; informational Compatibility Gates/Getting Started panes and the old oversized combined inspector are not the desired layout. Compatibility and learning material lives in this documentation.

## Menus, commands and docking

Use the menu bar or command palette to discover commands available in the current context. Tool-window commands expose Solution Explorer, Document Outline, Properties, Layout, Toolbox, Find Results, Error List, Output, Call Stack, Locals, Watch, Breakpoints, Tasks, Debug Console, Debug Settings and Symbols & Sources where registered. Docking moves the existing view/controller; floating, auto-hide, close/reopen and named layouts must not reset its runtime session. Layout reset recovers hidden/off-screen windows.

Keyboard shortcuts are defined by the current command registry rather than by screenshots in older milestone guides. Check the displayed shortcut/availability before invoking an operation; platform-reserved browser shortcuts and native paused-engine behavior may differ.

## Open, build and run

Open a folder or complete set of files to include the solution/projects, XAML, code-behind, resources and dependencies. A browser permission for one project file does not grant access to neighboring files. Choose the startup project/build profile/entry view, edit source, and build through the primary pipeline. Navigate errors in Error List and inspect build/application output. Failed development builds retain the previous working preview; incompatible successful edits require explicit restart.

## Debug source and converted libraries

Choose the execution mode appropriate to release, design, in-IDE continuation debugging or native DevTools. Bind breakpoints to actual source/IL points, then inspect the selected session in Call Stack, Locals, Watch and Tasks. Permitted scalar local edits affect the suspended invocation. Conditions/logpoints and exception settings have explicit supported expression/event semantics. Native-engine stepping is not the same transport as cooperative in-IDE stepping.

When the binary workspace is selected, shared execution/debugger commands route to its isolated runtime, not the source preview. Original **[symbol]** documents require identity and checksum verification. **[IL]** documents display actual disassembly. A library's symbol file does not expand its executable opcode/type/API compatibility.

## Design and hot reload

Use Document Outline or canvas picking to select real controls. Properties edits literals or explicit expressions according to source editability; Layout exposes available Canvas/Grid operations; Toolbox inserts actual supported controls. Artboard zoom/pan/grid/snapping and multi-selection use logical coordinates. Text, designer and refactor changes share preimage-checked history where integrated.

Canvas sibling operations and Grid track/cell tools have different compatibility rules. Template/generated instances, computed assignments and ambiguous C# ownership require source editing or additional analysis rather than silent rewrites. Straight-line C# aliases/final literal writes are not unrestricted control-flow analysis.

Enable hot reload for compatible method/property/tree/environment changes. Constructor/type-shape or unsupported structural changes must report restart requirements. Cancelling a gesture, encountering stale source or failing a patch must leave the prior source/app coherent.

## Review changes and restore symbols

Use the available change-review/refactor tools for multi-file operations: inspect the proposed diff and diagnostics, apply only if every preimage is current, and retain grouped undo. For Symbols & Sources, preview candidate requests first, approve symbol servers and source origins separately, and attach only validated bytes to an unchanged library record. Network/authentication/CORS and format limitations remain explicit.

## Offline, persistence and release

Standalone IDE/application exports use the same tested build inputs. Development exports may include original source maps and debugging controls; rebuild in release before distributing source-free output. Persistence failures need visible session-only behavior, not a false Saved indicator. Source/binary workspaces, layouts and debugger tasks have different lifetimes and must not be merged accidentally.

See [compatibility](compatibility.md), [security](security-and-trust.md), [verification](build-and-verification.md), and [remaining desktop work](remaining-work.md). Full desktop editing/refactoring/project tooling is not declared equivalent to Visual Studio or Rider merely because the layout resembles them.
