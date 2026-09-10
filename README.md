# Jailbreak

Browser-native C#, Avalonia XAML and managed IL to JavaScript compilers, reusable runtime/UI libraries, and an integrated desktop-style browser IDE.

**Expected end state:** existing applications and the complete unchanged ControlCatalog from `wieslawsoltes/Avalonia` compile and run in the browser with professional editing, visual design, debugging and state-preserving hot reload. **The full target is not declared complete.** Current supported profiles and exact evidence are documented rather than hidden behind empty API stubs or renamed examples.

## Documentation

[Documentation index](docs/README.md) · [Full requirements](docs/requirements.md) · [Current status](docs/current-status.md) · [Implemented work](docs/completed-work.md) · [Remaining work](docs/remaining-work.md) · [Architecture](docs/architecture.md) · [IDE guide](docs/ide-guide.md) · [Build and verification](docs/build-and-verification.md)

## Development system

Source/project evaluation feeds the C# and XAML compilers. The verified binary route reads real PE/CLI DLLs/EXEs and IL text, validates packages and emits JavaScript with shared managed/runtime operations. Optional verified symbols and cooperative continuations feed the integrated debugger. HTML/SVG and explicitly implemented WebGPU paths have distinct rendering roles.

The IDE exposes actual source/design/binary perspectives, Solution Explorer, editor/language-service tools, menus/command palette and independent docked/floating/auto-hidden tool windows. Designer source transactions, change review, debugging, hot reload and explicit symbol restoration share the real underlying libraries. Informational compatibility/getting-started panes are not a substitute for these tools.

## Build and test

Use the declared engine versions and exact npm scripts in [the build guide](docs/build-and-verification.md). The canonical [toolchain workflow](.github/workflows/toolchain.yml) governs unit/example/browser/CLR checks and Pages deployment. The browser IDE and standalone exports must be built from the same verified source.

## Contribution and acceptance

[Core development-tool obligations](docs/core-development-tools.md) apply to every compiler/control/runtime change. Use real upstream inputs, independent managed reference results, actual browser interactions and source/disposal/error tests. Preserve user work; publish ordinary, granular commits without force-overwriting concurrent source.

[Compatibility](docs/compatibility.md) and [security/trust](docs/security-and-trust.md) distinguish tested profiles from full language/framework support, symbol matching from authentication, debug source disclosure from release output, and committed source from passing deployment. Historical milestones remain indexed with current-applicability notices.
