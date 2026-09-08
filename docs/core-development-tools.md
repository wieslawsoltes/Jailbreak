# Mandatory core development tools

Debugging, visual design and hot reload are mandatory parts of Jailbreak's core project, not optional future plugins. Every compiler/runtime feature must include development-tool integration or a precise diagnostic and a tracked compatibility gap. This contract applies to C#, XAML, generated JavaScript, and the MSIL/DLL/NuGet route where source metadata is available.

## Required end state

**Debugger:** an IDE option enables source-aware debugging without changing release execution semantics. Required capabilities are C# and generated-JavaScript breakpoints, conditional/hit-count breakpoints, logpoints, pause/resume, step into/over/out, stack frames, locals, watches, exception breaks, source navigation, XAML construction/binding diagnostics and runtime-tree inspection. Binary methods need IL offsets and Portable PDB source mapping when available. Debugger overhead and source disclosure must be absent in release builds. Unsupported locations must be shown as unbound, never as a successful breakpoint.

**Visual designer:** a live design surface for XAML and supported C#-constructed UI, control palette, hierarchy, selection, layout handles, properties/events/resources/bindings, safe source round-tripping, undo/redo, keyboard and touch use, multiple viewports and theme preview. Both directions matter: source edits update design and supported design edits update source without destroying unrelated code, comments or bindings. Noneditable generated/template instances must be identified clearly rather than silently rewriting their owner.

**Hot reload:** incremental XAML, resources/styles, supported C# method changes and generated JavaScript updates; state-preserving updates when compatible; cancellation/versioning; transactional rollback; and explicit restart-required diagnostics for incompatible changes. Failed builds must not replace a working preview. Reload must be safe with event subscriptions, binding disposal, templates, selection, focus and debugger state.

## Development acceptance rules

1. New language features include original-source locations, debug/release behavior checks and source-map tests where they emit executable JavaScript.
2. New UI controls expose runtime type, inspectable properties and source identity, plus designer editability rules and a live-edit test.
3. New lifecycle/runtime features include reload and disposal regression tests. No silent state loss or partial patch on an unsupported edit.
4. The IDE exposes developer-tool options and persists them in workspace JSON/local storage. Export clearly distinguishes development and release artifacts.
5. CI exercises actual compiled applications in a browser, not only schema presence or mocked tool UI. Full debugger/designer/reload completion remains false until all end-state gates pass.

## Architecture

Reusable source-map/debug metadata, source-edit transactions, runtime inspection and reload planning live outside IDE UI. Compilers produce metadata; the runtime supplies explicitly scoped inspection/reload hooks; the workbench is a client. Preview commands retain the script-only iframe boundary, sender checks and per-preview session identity. Watches must not execute arbitrary code in the IDE origin.

Standard browser debugging uses JavaScript source maps and browser developer tools. In-page controls must not claim they can remotely drive browser DevTools without an explicit supported transport. Native pauses may suspend the page event loop; a fully in-IDE stepping engine needs its own tested execution transport or cooperative compiler mode.

The progress document for each implementation round must distinguish delivered behavior, browser evidence and remaining full-scope gaps. Full unmodified ControlCatalog compatibility remains a separate mandatory goal.

## References

- ECMA-426 source maps: https://tc39.es/ecma426/
- Chrome original-source debugging: https://developer.chrome.com/docs/devtools/javascript/source-maps
- Chrome debugger and stepping: https://developer.chrome.com/docs/devtools/javascript

## Delivered cooperative transport

[In-IDE stepping](cooperative-debugging.md) now supplies compiled-continuation suspension, frame locals and stepping for supported C# methods. Native callbacks and event propagation retain the documented scheduling boundaries; Portable PDB/MSIL and full-scope debugger gates remain open. [Boundary expansion](boundary-expansion.md) records the newer ownership, binding/environment and source-designer support.
