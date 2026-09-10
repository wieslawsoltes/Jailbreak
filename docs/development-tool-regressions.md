# Developer-tool regression boundaries

<!-- jailbreak-current-documentation:begin -->
> **Specialized guide / example; current applicability audited 2026-09-10.** This document is a specialized profile/example, not a full-solution completion claim. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

The [core contract](core-development-tools.md) remains mandatory. These guards supplement the [initial developer-tools milestone](milestone-development-tools.md).

## Native debugger test transport

Chromium may place a script-only sandboxed `srcdoc` preview in a separate renderer target or in the page target. The browser regression first attaches to the frame. Only the specific no-separate-session error permits falling back to its parent page session. Other failures are rethrown. The test still requires a native pause inside the compiled C# handler, a step, resume, correct application output, and an inline source map containing the original C# source. It is never skipped based on the process layout.

## Retained debug-site identities during reload

Method-body reload does not replace constructors or property accessors. Their emitted hooks keep their original site IDs. A change that moves these retained sites or renumbers them now requires restart before updating the shared debug metadata. Otherwise an old constructor hook could report a different method's location after adding statements earlier in the compilation. Generated line numbers alone are not identities and do not force restart.

`tests/development-reload-locations.test.js` covers shifted IDs, shifted original positions, and an accepted method change with preserved retained sites. This is deliberately conservative until retained executable bodies can be remapped safely. No source location is presented as successfully rebound merely to make a hot reload appear compatible.
