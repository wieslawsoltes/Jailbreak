# Developer tools laboratory

<!-- jailbreak-current-documentation:begin -->
> **Specialized guide / example; current applicability audited 2026-09-10.** This document is a specialized profile/example, not a full-solution completion claim. Use [current source and CI status](../../docs/current-status.md), [full requirements](../../docs/requirements.md), and [remaining acceptance work](../../docs/remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](../../docs/ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

Open **Develop** and enable the debugger/designer option. Select controls using the visual hierarchy or **Select on canvas**. Edit literal properties without replacing comments or binding expressions. The C#-constructed button maps back to its literal object initializer.

Enable **Hot reload on build**, type a value into the input, click Increment, then change `count += 1` to `count += 10` in C# and build. The root, input, counter and existing handler subscriptions remain alive. Attribute-only XAML edits to supported properties also reload in place. Supported panel insert/delete/reorder edits now reload without restarting. Other structural or constructor changes explicitly require **Restart app**.

Set a breakpoint on the counter increment or label assignment. Native pauses/stepping and live call frames use browser DevTools; the IDE displays snapshots and safe property-path watches. Disable native breaks to test conditional/logpoint reporting without DevTools. Development exports contain source maps and original source; disable tools and rebuild for release exports.

See `docs/core-development-tools.md` for mandatory full-scope requirements and `docs/milestone-development-tools.md` for delivered coverage and current limitations.
