# Jailbreak

A browser-native toolchain for compiling an explicitly supported subset of Avalonia-style XAML and C# to JavaScript, with reusable compiler/runtime libraries and a web IDE.

## Project goal

Load existing solutions and projects, compile XAML and C# without a .NET runtime in the resulting application, and run the Avalonia ControlCatalog in a browser using HTML and an optional WebGPU rendering backend.

This repository is being implemented incrementally. **The full upstream ControlCatalog is the target, not a compatibility claim.** Unsupported language, XAML, project-system, and platform features must be reported rather than silently treated as working.

## Architecture

- `packages/compiler-core`: source files, diagnostics, syntax utilities, intermediate representation.
- `packages/xaml-compiler`: XML/XAML parsing, semantic validation, bindings, JavaScript generation.
- `packages/csharp-compiler`: C# lexer/parser, semantic analysis, JavaScript generation.
- `packages/dotnet-runtime`: reusable collections, events, commands, tasks, and common library adapters.
- `packages/avalonia-runtime`: property system, controls, styles, resources, layout and data binding.
- `packages/renderer`: DOM integration and optional WebGPU primitives.
- `packages/project-system`: virtual files, solution/project loading, dependency graph and compilation.
- `apps/ide`: browser editor, compiler worker, diagnostics, and isolated application preview.
- `tests`: compiler, runtime, integration, browser and upstream compatibility gates.
- `docs`: architecture, compatibility status, implementation notes and development instructions.

## Compatibility baseline

The supplied `https://github.com/wieslawsoltes/Avalonialibrary` endpoint returned HTTP 404 through the connected GitHub API on 2026-09-08. It remains a blocked external gate, not a passing gate.

An additional upstream baseline is `AvaloniaUI/Avalonia`, pinned to commit `27c1ece36cbe17de3b8f95ae88223ba68702ae47` (2026-09-07), including `samples/ControlCatalog`. Catalog coverage will distinguish parsing, compilation, execution and behavioral compatibility.

Jailbreak is an independent compatibility implementation, not an official Avalonia product. See `docs/` for the current implemented scope and limitations as the toolchain develops.
