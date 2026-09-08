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
