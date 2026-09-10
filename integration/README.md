# Reviewed source integration

<!-- jailbreak-current-documentation:begin -->
> **Specialized guide / example; current applicability audited 2026-09-10.** This document is a specialized profile/example, not a full-solution completion claim. Use [current source and CI status](../docs/current-status.md), [full requirements](../docs/requirements.md), and [remaining acceptance work](../docs/remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](../docs/ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

`series.json` lists readable source patches with SHA-256 checksums. The integration workflow applies each pending patch once, creates ordinary source commits, runs unit/example/build checks, pushes without force, then dispatches the full browser/CLR/Pages pipeline. An uploaded patch is not equivalent to a successful deployment.

Studio stages 010–012 connect the reusable IDE modules to the existing debugger, designer, editor and compiled application. The offline build uses `scripts/html-assets.mjs` to escape nested Binary Studio HTML as JavaScript JSON data. `tests/inline-assets.test.js` covers nested script boundaries, source line endings and literal backslashes. The checked-in source is validated again after materialization; no failing gate is skipped.
