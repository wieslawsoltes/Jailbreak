# Boundary expansion acceptance ledger

Baseline: `cf1d3a73b2c642e90a2bb04e8fe1b5494b08cc98` (keyed panel reload). The [core tools contract](core-development-tools.md) remains mandatory. A passing subset is not completion of the full debugger, designer, Avalonia runtime or unmodified ControlCatalog.

## Required acceptance evidence

| Boundary | Evidence required before claiming support |
|---|---|
| Retained-control reparenting | Identity, data context, logical/visual parent, namescope, event ownership, cycle prevention and rollback |
| Content-host child/root replacement | Existing host identity, staged construction, borrowed content protection, failed-render rollback and disposal |
| Binding changes | New source path, mode, old subscription teardown, local-value precedence and failure recovery |
| Resource/style/template edits | Resource precedence, reactive subscribers, independent template namescopes, old-part teardown and explicit unsupported cases |
| Two-way C# visual design | Parser-based edits, escaped literals, added/removed initializer properties, stale-preimage rejection and compile/run evidence |
| Independent IDE debugging | Real suspend/resume/step semantics without falsely representing snapshots as a paused engine |
| MSIL/PDB debugging | Verified document/method/IL mapping, locals scopes, malformed input rejection and actual binary stepping |
| Full original ControlCatalog | Pinned requested-fork sources, unchanged original app compilation, construction, interaction and visual gates; retain full-gate failure until achieved |

Implementation results and focused regression paths will be recorded here as each stage is verified. Unsupported cases must fail explicitly rather than drop source constructs or guess which live object owns state.

## Stage 1: logical ownership edits

Content-host child insertion, deletion and replacement, including the application's content root, now preserve the host. Named controls and whole existing subtrees can move between existing supported panels/content hosts in one document/namescope. Explicit `Children`, `Content`, and `Child` property elements are supported. Inherited context and enabled state are refreshed after moves; source bindings keep their original target identity and change context. The runtime preflights ownership, rejects cycles, preserves trailing C# children and refuses to overwrite application-owned content.

Regression paths: `tests/tree-ownership-reload.test.js` and two additional browser tests in `tests/browser/test_development.py`. Local checks: 222 Node tests, 15 development-browser tests, build and syntax checks. Local Chromium uses the self-contained offline document because HTTP navigation is blocked in the execution environment; hosted CI exercises HTTP.

Moves into newly constructed hosts, extracting retained descendants from removed hosts, cross-document/namescope moves, and templated hosts remain explicit restart cases. The application instance itself is not replaced; content-root replacement is distinct from changing its C# type.

## Stage 2: subscription and environment reload

The primary runtime now owns one replaceable subscription slot per XAML attribute. Reload can add, replace and remove supported Binding/StaticResource/DynamicResource expressions and XAML event handlers, while preserving separately installed C# event subscriptions. New bound subtrees activate only after all staged names have attached. OneTime bindings refresh on DataContext replacement. Failed initial binding evaluation cleans up partial observers.

Inline resource dictionaries retain their observable identity during replacement. Dynamic-resource clients update; unchanged StaticResource references retain their original object. Style replacement respects local values, and dynamic resources in style/control-theme setters are now compiled and resolved reactively. Direct ControlTemplate and ContentTemplate property-element edits use held old parts so failed render transactions restore the original template instance; successful commits dispose old parts and namescopes. A bounded layout drain keeps render-time template updates inside the transaction.

Regression paths: `tests/environment-reload.test.js` (13 cases) and two further browser tests. Local checks: 235 Node tests and 17 development-browser tests. Browser evidence covers a combined resource/style/template update, real DOM color, retained input and root, old-part disposal and a working compiled click handler.

Still excluded: OneWayToSource initialization during a changed binding, arbitrary custom resource constructors, include-file environment changes, arbitrary ItemTemplate/ItemsPanel replacement, moving templated hosts, and rollback of external side effects from user callbacks. Normal source compilation remains the boundary for supported binding syntax; this does not add arbitrary markup extensions.

Semantics references: [binding modes](https://docs.avaloniaui.net/docs/data-binding/data-binding-syntax), [logical-tree inheritance](https://docs.avaloniaui.net/docs/data-binding/data-context), [property precedence](https://docs.avaloniaui.net/docs/properties/value-precedence).

## Stage 3: source-round-tripping designer

C# object initializer editing now adds and removes typed literal properties, creates an initializer on `new Control()`, handles signed numbers and character/string escapes, and preserves comments/trivia and line endings using compiler token spans. The editor refuses expression-based values, identity mutations, unsupported property types and stale transactions. These constructor changes remain restart-required: source editing support is not constructor state migration.

The primary Develop panel exposes **Set binding/resource**, **Remove property**, and **Move into** a named host. Literal edits still protect bindings; the explicit expression action parses and validates supported markup. XAML moves preserve the existing element bytes, reject cycles, nonempty content slots, namespace-resolution changes and template-scope moves, and are one undoable transaction.

Regression paths: `tests/designer-roundtrip.test.js` (12 cases) plus three browser gates. Local verification: 247 Node tests and 20 development-browser tests. General imperative C# UI reconstruction, custom typed expressions and arbitrary AST refactorings remain outside these operations.
