# Build profiles

<!-- jailbreak-current-documentation:begin -->
> **Specialized guide / example; current applicability audited 2026-09-10.** This document is a specialized profile/example, not a full-solution completion claim. Use [current source and CI status](../../docs/current-status.md), [full requirements](../../docs/requirements.md), and [remaining acceptance work](../../docs/remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](../../docs/ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

This editable solution demonstrates `Directory.Build.props`, nested imports, per-project framework and conditional symbols, conditional source selection, and actual C# `#if` behavior.

Load the containing folder or select **Build Profiles** in the primary workbench. Open **Build profile**, select Debug or Release and choose **Apply & build**. The same button adds one in Debug and ten in Release. The library keeps its own `netstandard2.0` symbols while the app targets `net8.0`.

The inspector shows both evaluated projects. `Native.cs` is always excluded, and `DebugOnly.cs` is excluded in Release. No .NET SDK, NuGet binary or MSBuild task is executed.
