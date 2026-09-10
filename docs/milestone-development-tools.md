# Developer tools: source debugging, visual design and hot reload

<!-- jailbreak-current-documentation:begin -->
> **Historical milestone; current applicability audited 2026-09-10.** The implementation details and test totals below record this milestone, not the complete present-day product. Its old remaining/unsupported lists and UI instructions may have been superseded. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

**Later updates:** [Boundary expansion](boundary-expansion.md) adds content/reparenting, bindings/resources/styles/templates and expanded C# source edits. [In-IDE stepping](cooperative-debugging.md) supplies a separate compiled-continuation transport; the native-only descriptions below document this original milestone.

**Update:** [Keyed panel structural reload and designer duplication](milestone-structural-reload.md) supersedes the initial restart-only rule for supported panel child changes. Other structural/resource/template changes remain restart-required.

Debugging, visual design and hot reload are mandatory core features. The [core contract](core-development-tools.md) describes their required full end state and the integration obligations for every later compiler/runtime/control feature. This milestone delivers a working primary-IDE subset, not completion of that end state.

## Use the workbench

Choose **Developer Tools** in the primary IDE sample list, open **Develop**, then enable **debugger / designer**. This rebuilds with source metadata and starts a fresh development preview. Options, breakpoints and watches are included in local storage and workspace JSON. Release is the default. Disable development tools and rebuild before distributing a release export; development exports contain original C# source in their inline maps.

### Debugger

The C# compiler emits statement sequence points, actual local-variable capture closures, original file/line/UTF-16 column metadata, and Source Map v3 mappings in development exports/previews. Inactive preprocessor branches retain original source offsets. The Generated JS tab's line coordinates bind to the corresponding sequence points. Native browser DevTools can also set ordinary JavaScript breakpoints anywhere in the generated script.

The panel supports source-line breakpoints, hit thresholds, scalar comparison conditions, logpoints, break-next-statement, safe property-path watches and breakpoint snapshots. A filled marker means a known sequence point; an open marker means unbound. Watches only follow own data properties and array indices: they do not invoke getters, calls, eval or prototype traversal. Invalid conditions report an error without changing application execution.

With **Native DevTools breaks** enabled, the emitted `debugger` statement causes a real engine pause. Browser DevTools supplies resume, step into/over/out, live call frames, locals and expression evaluation. Automated Chromium tests attach to the sandboxed iframe's CDP target, receive a real pause in the compiled C# handler, step over, resume and verify execution. The IDE itself displays snapshots; it does not pretend to remotely operate native DevTools. A browser-native pause may also pause in-page UI. An independent, fully in-IDE stepping transport is still required by the full project contract.

XAML construction breakpoints use original XAML element locations, and the live hierarchy exposes XAML/C# source identity, template ownership, effective property values and binding/resource descriptors. **Break on C# throw** pauses on explicit compiled C# throw/rethrow sites and preserves exception identity, including the shared null-throw semantics. It is not a general first-chance exception detector for every runtime/native/binary failure; use DevTools exception options for those failures.

No trace hooks, source identities or embedded source maps are emitted by release compilation. Developer runtime modules are present but inactive in the primary runtime bundle. Thus release source instrumentation is absent, not the dormant tooling module bytes.

### Visual designer

Select a visual from the hierarchy or enable **Select on canvas** and click it. Source navigation identifies the originating file. The properties panel edits supported literal XAML attributes, adds properties and inspects runtime values/bindings. Attribute spans preserve unrelated source, namespaces, comments, whitespace and CRLF. Binding/resource expressions are protected from accidental replacement.

The palette inserts supported controls into panels or empty content hosts. Delete and sibling reordering operate on complete XML element spans. Undo/redo are bounded, preimage-checked source transactions: intervening text edits cannot be silently overwritten. Structural changes update source but require explicit application restart.

A selected visual has a resize handle supporting pointer/touch drag, Shift aspect preservation, arrow-key one-pixel resize and Shift-arrow ten-pixel resize. Width/Height are written as one undoable source edit. The overlay is an accessible design control, not part of the application visual tree.

C#-constructed visuals are mapped at `new` expressions. Existing literal object-initializer values can be edited without rewriting unrelated C#. Expressions, arbitrary imperative construction, generated/template instances and unsupported properties require source editing. Constructor changes explicitly require restart. This is not a general two-way C# AST designer yet.

### Hot reload

Enable **Hot reload on build**, edit source or a design property, then build. The planner checks successful profiles, manifests, dependency metadata, type shapes, constructors/initializers and XAML identity/structure. Supported changes are builtin-control literal properties from the live-property contract and compatible C# method bodies. Original root/control identities, input values, instance fields and event subscriptions survive accepted patches. Both XAML-wired and C# method-group event handlers dispatch to the updated method implementation.

Each patch has a monotonic revision and targets original source identities. Preflight validates every target and method descriptor before applying anything. Property stores and method descriptors are restored on apply/render failure; definitions and source identities advance only after success. The tests cover rejected/stale revisions, simulated renderer failure, state preservation and ten successive reloads without extra handler calls. Source maps and generated line metadata are refreshed for new method bodies.

A failed build leaves the running development app intact. An incompatible patch reports **Restart required** and also leaves it intact until **Restart app** is selected. Initializers, constructors, type members/bases, XAML structure, resource/style/binding changes, binary/package changes and base-dispatch method patches require restart in this milestone. Active method frames and previously captured lambda closures are not migrated; updates apply to subsequent compatible method calls. Arbitrary external side effects from user property callbacks are outside property-store rollback.

## Reusable libraries

| Module under `packages/development` | Responsibility |
|---|---|
| `source-map.js` | UTF-16 source maps, inline embedding and displayed generated locations |
| `watch.js` | Bounded snapshots and non-evaluating property-path watches |
| `designer.js` | XML/C# source inspection, literal edits, palette/reorder and undo transactions |
| `live-properties.js` | Explicit supported live-edit property contract |
| `reload.js` | Compatibility checks and method/property patch generation |
| `runtime.js` | Per-preview breakpoints, origins, hierarchy, bindings, selection and reload application |
| `preview.js` | Authenticated preview command bridge |
| `workbench.js` | Optional IDE tools panel; no runtime objects cross the iframe boundary |

The existing primary C#/XAML compiler, project backend, UI loader/runtime and IDE are extended. The secondary frontend and Binary Studio are preserved. MSIL/Portable PDB source debugging is a mandatory remaining integration, not implied by C# statement maps. Converted libraries can still be inspected in generated JavaScript using browser DevTools.

## Verification and security

Run `npm test`, `npm run gate`, `npm run build`, `npm run check`, then `python -m unittest discover -s tests/browser -p 'test_*.py' -v`. The new focused files are `tests/development.test.js` and `tests/browser/test_development.py`. CI uses an actual HTTP-served site. Local `JAILBREAK_INLINE_TEST=1` exercises the same offline IDE when development-host navigation is unavailable; it is not a mock UI.

All preview commands require the sending parent window and per-session channel. The iframe remains `sandbox="allow-scripts"` without same-origin permission. Designer input and inspection use text nodes. Generated reload code executes only in the preview, never in the IDE origin. This is not a complete hostile-input or denial-of-service audit. Run trusted source; source-map exports disclose source text by design.

The full debugger, full designer, general state-preserving hot reload and full unmodified ControlCatalog remain incomplete. Future work must continue to test source locations, editability, live-update compatibility and lifecycle cleanup alongside ordinary compilation/execution.

## References

- ECMA-426 source-map specification: https://tc39.es/ecma426/
- Chrome original-source debugging: https://developer.chrome.com/docs/devtools/javascript/source-maps
- Chrome pause/step/exception debugging: https://developer.chrome.com/docs/devtools/javascript
