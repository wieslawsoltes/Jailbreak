# Integrated Studio IDE

<!-- jailbreak-current-documentation:begin -->
> **Historical milestone; current applicability audited 2026-09-10.** The implementation details and test totals below record this milestone, not the complete present-day product. Its old remaining/unsupported lists and UI instructions may have been superseded. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

Jailbreak Studio is the primary C#/XAML workbench, redesigned around a modern desktop IDE layout. It integrates the actual compiler worker, runtime, debugger, visual designer, hot reload, project evaluator and binary tools. It does not replace those engines with demonstrations, and does not imply full Visual Studio language or framework parity.

## Workspace and execution

The top toolbar has **Release**, **Design session**, **Debug · In-IDE**, and **Debug · DevTools** configurations. They configure the existing development session and rebuild once, rather than starting independent debugger implementations. Start becomes Continue when an invocation is paused. Restart, Stop, Pause at next statement, and step commands reflect actual session availability. The status strip reports build, running, paused and reload states from the compiler/preview messages, not a timer or fabricated progress.

**Code**, **Split**, **Designer**, and **Binary Studio** switch workspaces without cloning the source editor or destroying the running UI. Designer enables a design session when necessary and turns on canvas picking after construction completes. Returning to Code or Split turns picking off. The right inspector offers All tools, Designer and Debugger tabs. Existing development options and advanced operations remain available in All tools.

The inspector remains resizable and moves to a bounded overlay on narrow screens. Light/dark colors only affect the IDE, not the user's application. Buttons use local SVG icons; neither icon fonts nor external CSS/CDNs are required. Editor font size is persisted along with workspace perspective, inspector and bottom-window choices. Existing pane-size preferences continue through the workbench layout library.

## Editing and navigation

The Solution Explorer groups files into collapsible folders, retaining exact source paths and read-only symbol labels. New File uses a validated modal dialog for C#, XAML and project files. Closing a document tab does not delete its source or edits. Reopen closed tabs with Ctrl+Shift+T; close with Ctrl+W. Workspace downloads include all source documents regardless of which tabs are open.

Existing command/file/symbol palettes, literal workspace search, find/replace, comment toggling, go-to-line/column, per-document caret memory and build-profile inspection remain wired to the same editor. Studio registers its additional commands through the reusable shell command registry. Tab/Shift+Tab supports multiline indentation/outdent while preserving line endings; read-only generated and verified binary-source documents remain protected.

A visible-row gutter toggles line breakpoints with the mouse or F9. Only visible marker buttons are materialized. Bound and unbound locations are distinguished; the current paused statement has a marker and highlighted row. These are line-based breakpoints: edits can change what a numbered line contains. The shell does not claim semantic breakpoint relocation or refactoring support.

## Debugger windows

The lower dock now includes **Error List**, **Output**, **Call Stack**, **Locals**, **Watch**, and **Breakpoints**. The debugger windows consume bounded snapshots sent by the existing authenticated development bridge. They do not inspect objects by evaluating code in the IDE origin.

A cooperative pause navigates to its original C#/XAML source, displays the selected frame's locals, and activates the Locals window. Call-stack entries select the corresponding runtime frame. Expand snapshot objects to inspect their visible data. An editable scalar local can be changed using the Edit dialog; the runtime still enforces scope, type and numeric range. Watch paths use the same non-evaluating property-path reader as the original tools. Calls, getters and prototype traversal are rejected. Continuing or stopping clears stale live-frame displays and the execution marker.

The Breakpoints window navigates to source and removes individual or all breakpoints. Conditions, hit counts, logpoints and exception options remain in the debugger inspector. In-IDE stepping uses compiled continuations for the existing C# subset and resumable source-constructor/XAML paths. Native DevTools debugging remains separate for generated JavaScript and verified binary source; adding a toolbar does not create arbitrary MSIL/async continuation support.

### Keyboard commands

| Command | Shortcut |
| --- | --- |
| Start / Continue | F5 |
| Stop application | Shift+F5 |
| Restart application | Ctrl+Shift+F5 |
| Toggle source breakpoint | F9 |
| Step over / into / out | F10 / F11 / Shift+F11 |
| Command palette / Quick open | Ctrl+Shift+P / Ctrl+P |
| Workspace search / symbols | Ctrl+Shift+F / Ctrl+Shift+O |
| Find / Replace / Go to line | Ctrl+F / Ctrl+H / Ctrl+G |
| Close / Reopen document tab | Ctrl+W / Ctrl+Shift+T |

Command/Control modifiers follow the existing cross-platform shortcut handling. Shortcuts belong to the IDE document; keyboard events inside the isolated application or binary frames do not automatically bubble to the host.

## Visual design and hot reload

The focused Designer shares the live hierarchy, literal property editor, explicit binding/resource editor, palette, resize handles, reparenting commands and preimage-checked undo/redo with the original development tools. Search filters displayed property rows without rewriting source. Toolbox buttons invoke the existing supported insertion command on the selected host. A missing or unsafe selection produces the existing diagnostic, never a fabricated visual.

The toolbar hot-reload toggle controls the same transactional reload planner. It preserves accepted UI instances, input values and event subscriptions according to existing compatibility rules. Structural/binding/resource/template and C# method updates retain their existing supported profiles. Source edits made through the designer still flow into the project compiler. Failed builds and incompatible patches do not silently reconstruct a development preview.

## Binary Studio in the IDE

Binary Studio is embedded on demand in its own script-only iframe with download permission, without same-origin access. It is the existing MSIL/DLL/NuGet application, not a second implementation. The user can invoke compiled methods and export its runner while the C#/XAML application retains state in its separate preview. Returning to Binary Studio retains that binary tool's inputs and results.

The standalone IDE build embeds the complete Binary Studio HTML alongside its compiler/runtime assets. The integrated view therefore works from the offline IDE too. The primary application's preview remains `sandbox="allow-scripts"`. Existing sender-window and per-session-channel validation still applies; the binary frame is never accepted as the primary application message source. The module build loads the same published Binary Studio page relative to its own site.

Portable-PDB source documents and binary dependencies already supported by the source project/compiler remain available. This milestone does not claim to complete unpublished native-PDB reader work or remote symbol restoration.

## Reusable implementation and verification

| Module | Responsibility |
| --- | --- |
| `packages/workbench/studio-model.js` | Serializable preferences, visible lines, diagnostic filtering, source indentation and folder hierarchy |
| `packages/workbench/studio-ui.js` | Local SVG icons, DOM actions and keyboard tab activation |
| `packages/workbench/studio-debug.js` | Call stack, locals, watches, breakpoints, scalar-edit dialog and source gutter |
| `packages/workbench/studio.js` | Toolbar, workspace views, embedded binary tools and tool-window coordination |
| `apps/ide/studio.css` | IDE-only responsive dark/light theme |
| `packages/development/workbench.js` | Public session observation/control adapter over the existing debugger/designer client |

Run `npm test`, `npm run gate`, `npm run build`, `npm run check`, and the normal browser suite. `tests/studio-model.test.js` adds pure state/editing tests; `tests/browser/test_studio.py` exercises actual compiled C# pause/local-edit/continue, watches, design hot reload, integrated binary invocation, errors, files, keyboard tabs and narrow layouts. Existing native debugger, XAML-construction, templates, binary/CLR, reload and build-profile gates remain required.

The local environment can exercise the self-contained IDE with `JAILBREAK_INLINE_TEST=1`; hosted CI exercises the HTTP-served build and remains the deployment gate. No test treats a synthetic debugger event as an actual runtime pause.

The full language/framework, unmodified ControlCatalog, unrestricted source round-tripping, arbitrary MSIL/async debugging and professional editor/refactoring end state remain the mandatory targets defined in `core-development-tools.md`. This milestone integrates existing capabilities into the working IDE; it does not declare those compiler targets complete.

Reference: W3C WAI-ARIA tab keyboard/role pattern, https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ .
