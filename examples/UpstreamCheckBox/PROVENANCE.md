# Unmodified upstream fixture

<!-- jailbreak-current-documentation:begin -->
> **Specialized guide / example; current applicability audited 2026-09-10.** This document is a specialized profile/example, not a full-solution completion claim. Use [current source and CI status](../../docs/current-status.md), [full requirements](../../docs/requirements.md), and [remaining acceptance work](../../docs/remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](../../docs/ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

Source: AvaloniaUI/Avalonia, commit 27c1ece36cbe17de3b8f95ae88223ba68702ae47.
Paths: samples/ControlCatalog/Pages/CheckBoxPage.xaml and CheckBoxPage.xaml.cs.
Git blob hashes: 4f9c59448bc6188b0675629dfe99fcd571ea9290 and b63d7084d6ba16880cbb03ca8990230d6cac1471.
License: MIT; see LICENSE.Avalonia.txt.

The XAML and C# files are byte-for-byte upstream fixtures. The browser runtime provides an explicit ScrollPage resource adapter and its own HTML-backed ContentPage. This is not a compilation of the upstream control theme or the entire upstream application.
