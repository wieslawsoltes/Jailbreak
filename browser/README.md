# Jailbreak browser toolchain

<!-- jailbreak-current-documentation:begin -->
> **Specialized guide / example; current applicability audited 2026-09-10.** This document is a specialized profile/example, not a full-solution completion claim. Use [current source and CI status](../docs/current-status.md), [full requirements](../docs/requirements.md), and [remaining acceptance work](../docs/remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](../docs/ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

This self-contained ES-module workspace preserves the repository's existing delivery scaffold. Its compiler and runtime libraries are usable by other hosts, including the root IDE, without coupling to this workspace's editor.

## Goal and baseline

Compile a documented subset of C# and Avalonia XAML to JavaScript and run it without a .NET runtime. Full unmodified ControlCatalog is the target, not a current completion claim.

The requested repository `wieslawsoltes/Avalonia` is accessible. The baseline for this workspace is its `master` commit `b709c58c6b1b8aa3b90866c7c001b7bf82b6353b`. In particular, `samples/ControlCatalog/Pages/CheckBoxPage.xaml` and its C# code-behind are executable compatibility fixtures. The source file blob SHAs are `4f9c59448bc6188b0675629dfe99fcd571ea9290` and `b63d7084d6ba16880cbb03ca8990230d6cac1471` respectively.

## Layout

- `packages/core`: diagnostic and XML utilities, control schema.
- `packages/xaml`: XAML validation, intermediate object graph and JavaScript emission.
- `packages/csharp`: tokenizer, syntax tree and JavaScript backend.
- `packages/dotnet`: reusable collections, commands, events and common adapters.
- `packages/runtime`: observable properties, bindings, controls, resources and DOM host.
- `packages/renderer`: optional WebGPU primitive renderer and explicit canvas fallback.
- `packages/project`: virtual file system, solution/project readers and compilation.
- `ide`: source editor, compiler worker, generated code and sandboxed preview.
- `fixtures`: attributed upstream source and behavioral gates.
- `tests`: executable compiler/runtime/browser regression tests.

Architecture, language limits, semantic differences, gate results and implementation history are recorded in `../docs/browser-toolchain.md`. Unsupported features must be diagnostics, not invisible no-ops. Rendering selected controls with HTML does not establish pixel-identical Avalonia rendering.
