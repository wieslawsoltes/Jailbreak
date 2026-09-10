# Original ProgressBarPage

<!-- jailbreak-current-documentation:begin -->
> **Specialized guide / example; current applicability audited 2026-09-10.** This document is a specialized profile/example, not a full-solution completion claim. Use [current source and CI status](../../docs/current-status.md), [full requirements](../../docs/requirements.md), and [remaining acceptance work](../../docs/remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](../../docs/ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

Repository: https://github.com/wieslawsoltes/Avalonia
Commit: b709c58c6b1b8aa3b90866c7c001b7bf82b6353b
Directory: samples/ControlCatalog/Pages

Original, unchanged XAML and C# code-behind. Git blob IDs:
- ProgressBarPage.xaml: 3b80b5a6bb97d019c8e6669ce244273ab0cecd55
- ProgressBarPage.xaml.cs: 244161a61e34c1ffe407410c27283df466cda1bb

The primary runtime uses explicit ContentPage/ScrollPage adapters. Gates cover dynamic range/value bindings, percentage text and its supported format subset, indeterminate state and orientation. This is not an assertion of full Avalonia theme/pixel parity. The secondary pipeline does not yet support ProgressTextFormat.
