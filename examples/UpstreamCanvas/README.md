# Unmodified upstream Canvas page

<!-- jailbreak-current-documentation:begin -->
> **Specialized guide / example; current applicability audited 2026-09-10.** This document is a specialized profile/example, not a full-solution completion claim. Use [current source and CI status](../../docs/current-status.md), [full requirements](../../docs/requirements.md), and [remaining acceptance work](../../docs/remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](../../docs/ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

The XAML and C# here are byte-identical to `samples/ControlCatalog/Pages/CanvasPage`
in `wieslawsoltes/Avalonia` at `b709c58c6b1b8aa3b90866c7c001b7bf82b6353b`.
The owned csproj is an isolated browser gate, not the full original project.
`ContentPage` and `ScrollPage` use the existing documented browser host adapters.
The page has no replacement drawing code: its paths, gradient mask, colors and
polylines are constructed from the original XAML by the shared runtime.

Select **Upstream Canvas** in Studio. The source remains editable as in other
samples, but gate integrity always checks the untouched repository fixture.
Full unmodified ControlCatalog remains mandatory and not passing.
