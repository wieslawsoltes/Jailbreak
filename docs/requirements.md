# Full solution requirements and acceptance contract

> Audit input: [`9b73d1167983`](https://github.com/wieslawsoltes/Jailbreak/tree/9b73d1167983076687cf078a3992144e4a18794a); documentation reconciled 2026-09-10T11:23:03+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

Compile existing Avalonia XAML and C# applications, including the complete unchanged upstream ControlCatalog, into browser-executable HTML and JavaScript using reusable compilers, runtime, rendering and development-tool libraries. This contract records the requested end state, not a declaration that it has been delivered.

## Definition of the expected finished solution

The finished product is one usable, documented browser development system: existing solution/project inputs compile through the appropriate source or binary route; the full pinned unchanged ControlCatalog runs correctly; the UI is editable and debuggable; compatible updates preserve state; applications and the IDE export and deploy reproducibly. A smaller implementation profile is a delivery milestone, not a change to this expectation.

## Non-negotiable acceptance rules

**1.** Source compilation and binary conversion are separate supported routes into shared browser runtime and development tooling; neither may silently replace an imported application with a handwritten substitute.

**2.** Full unchanged ControlCatalog execution, unrestricted safe C# visual round-tripping, SDK-generated async-state-machine compatibility, complete declared language/framework coverage, symbol restoration and desktop IDE parity remain mandatory acceptance targets until independently demonstrated.

**3.** A file, exported API, example, uploaded blob, queued workflow or passing unrelated test is not proof of complete capability or publication.

**4.** Debugging, source identity, designer editability, reload compatibility and disposal evidence are core development obligations for every feature, not optional final-phase work.

**5.** Retain full requirements when documenting partial profiles. Unsupported behavior must diagnose explicitly and must not be hidden by empty stubs, rewritten upstream pages or suppressed errors.

**6.** Publish ordinary source and documentation to main in focused commits without force-overwriting concurrent work. Record exact tested revisions and canonical CI outcomes.

**7.** The IDE must expose operational tool windows and commands rather than permanent text-only compatibility/getting-started panes or one oversized combined inspector. Honest compatibility details remain in documentation.

**8.** Historical milestone results describe their original scope and revision. Current status must be reconciled with present source and test evidence, not inferred from conversational progress reports.

## Requirement catalogue

Each stable ID describes a requirement, not a completed checkbox. The [traceability matrix](requirements-traceability.md), [current evidence](current-status.md) and [remaining plan](remaining-work.md) distinguish the implemented profile from the required end state. No requirement is marked complete merely by this documentation update.

### PROD — Product, architecture and delivery

| ID | Required capability | Completion gate |
| --- | --- | --- |
| PROD-001 | Generate HTML/JavaScript from existing Avalonia XAML and C# applications without requiring a downloaded .NET runtime. | Execute generated applications and libraries in a clean browser; identify every additional runtime/asset dependency and prohibit source substitutes. |
| PROD-002 | Keep compiler core, XAML compiler, C# compiler, MSIL compiler, metadata readers, runtime, renderer and IDE reusable independently. | Document canonical entrypoints and test each library independently and through the primary IDE. |
| PROD-003 | Maintain one explicit compatibility contract across source, binary and NuGet routes. | Equivalent supported programs agree across routes; unresolved APIs and unsupported semantics produce actionable errors. |
| PROD-004 | Provide browser-hosted IDE and standalone offline IDE/application exports. | Build exports from the same tested source; verify standalone execution without hidden network or source-compilation substitutes. |
| PROD-005 | Publish frequently and granularly to the requested main branch and GitHub Pages. | Confirm non-forced branch updates and successful canonical verification/deployment for the exact final revision. |
| PROD-006 | Document all requirements, implementation, APIs, constraints, evidence and unfinished work under docs. | Every requirement maps to implementation/evidence or a visible gap; documentation links and current-status claims are checked. |
| PROD-007 | Preserve licensing, attribution and provenance of upstream/open-source fixtures and dependencies. | Record pinned sources and hashes; keep upstream fixture bytes and licensing material intact. |
| PROD-008 | Keep release output and developer instrumentation distinct. | Release excludes emitted debug hooks and original-source maps; explicitly distinguish that from dormant tooling modules bundled in runtime assets. |

### PROJECT — Solution, project and dependency handling

| ID | Required capability | Completion gate |
| --- | --- | --- |
| PROJECT-001 | Load solutions, projects and complete source/resource folder trees. | Resolve project references, active configuration, startup project and entry view without requiring neighboring files to be guessed from a single-file browser permission. |
| PROJECT-002 | Evaluate relevant project properties, conditions, item includes/excludes, target frameworks and build profiles. | Compare selected inputs and effective settings with the declared project-evaluation profile; reject unsupported build semantics explicitly. |
| PROJECT-003 | Handle resources, themes, assets, generated inputs and partial/code-behind files coherently. | Asset names and assembly-qualified resources resolve identically in IDE, hosted and offline output. |
| PROJECT-004 | Resolve dependencies for source libraries, converted assemblies and NuGet packages. | Validate identities, version/framework compatibility and unresolved references without executing package tasks or arbitrary downloaded build code. |
| PROJECT-005 | Persist portable workspaces and separate editable source from binary/symbol attachments. | Round-trip source, settings and verified attachments; symbol documents never become substitute compilation units. |
| PROJECT-006 | Provide predictable incremental/cancellable builds and stale-result rejection. | Late worker results cannot replace newer builds, imports or edits; failed development builds preserve the running app. |
| PROJECT-007 | Make project diagnostics navigable and actionable. | Report original file/range, error code, unsupported feature and dependency chain instead of suppressing failures to run a sample. |

### CS — C# source compiler and managed semantics

| ID | Required capability | Completion gate |
| --- | --- | --- |
| CS-001 | Lex and parse the declared C# version with exact source locations and preprocessing. | Positive and negative syntax/preprocessor cases preserve original UTF-16 source ranges through diagnostics, debug maps and editor navigation. |
| CS-002 | Bind namespaces, usings, aliases, partial/nested types, accessibility and symbols correctly. | Resolve source and imported types consistently and reject ambiguity or missing symbols without JavaScript-name guessing. |
| CS-003 | Implement type checking, overload resolution, conversions and operator semantics. | Use independent C# reference cases, including overflow, signedness, nullable behavior, boxing and failure paths. |
| CS-004 | Support fields, properties, accessors, indexers, events, methods and object/collection initializers. | Retain initialization/evaluation order, instance/static state and event lifetime in ordinary and debug execution. |
| CS-005 | Support constructors, base dispatch and delegating this constructors without duplicate execution. | Evaluate arguments and initialization exactly once; test chains, failure, cancellation, virtual effects and XAML initialization. |
| CS-006 | Implement control flow, pattern matching, exceptions and cleanup. | Test nested branches/loops/switches, throw/rethrow identity and try/catch/finally/filter semantics against declared C# behavior. |
| CS-007 | Implement delegates, lambdas, closures and method groups. | Preserve captures, binding, identity and unsubscribe behavior across execution, debugging and compatible hot reload. |
| CS-008 | Implement interfaces, inheritance, virtual dispatch, structs, enums and value semantics. | Verify copying, default values, equality, dispatch, layout-independent managed operations and source/binary interoperability. |
| CS-009 | Implement general generics and constraints. | Resolve closed/open generic types and methods, constraints and runtime identity without silently erasing observable managed semantics. |
| CS-010 | Implement ref/out/in references and reference-return/lifetime rules. | Compare aliases, locals, arguments, fields, arrays, mutation, exceptions and invalid escape cases with independent CLR results. |
| CS-011 | Implement async/await, tasks, cancellation and iterators. | Preserve completion, suspension, failure and cleanup across multiple awaits/yields, nested callers and debugger pauses. |
| CS-012 | Implement commonly used library/UI APIs and expand to the complete declared framework profile. | Use behavior tests for collections, LINQ, strings, numeric/date types, notification, commands, tasks and platform adapters; API-name registration alone is insufficient. |
| CS-013 | Emit JavaScript with deterministic source attribution and explicit unsupported-feature diagnostics. | No executable success output for a failed compilation; ordinary and instrumented builds produce equivalent supported behavior. |
| CS-014 | Provide extension points for remaining C# and framework functionality. | Document parser/binder/lowering/runtime boundaries and add acceptance tests for each new semantic feature. |

### XAML — Avalonia-compatible XAML compiler

| ID | Required capability | Completion gate |
| --- | --- | --- |
| XAML-001 | Parse and resolve namespaces, x:Class, x:Name and assembly/type references. | Map XML nodes and attributes to original ranges; resolve actual controls/custom classes and diagnose unknown elements/properties. |
| XAML-002 | Implement attribute, property-element, attached-property and content syntax. | Preserve evaluation order, content/collection rules, value conversion and original-source identity. |
| XAML-003 | Implement namescopes, code-behind association and event wiring. | FindControl/FindName and generated owner fields resolve the correct instance; disposal/reload do not leave stale names or handlers. |
| XAML-004 | Implement bindings, binding modes, converters and data-context inheritance. | Test one/two-way updates, replacement, subscriptions, validation/errors, null paths and data-context changes. |
| XAML-005 | Implement element/relative/template bindings and compiled-binding requirements. | Check actual scope/type resolution and observable updates, including templated and reparented controls. |
| XAML-006 | Implement resource dictionaries, includes, static/dynamic resources and lookup precedence. | Resolve lexical/application/theme resources and update live consumers without accumulating subscriptions. |
| XAML-007 | Implement styles, selectors, setters, themes and property precedence. | Match supported selectors and correctly resolve local/style/theme/inherited values and live updates. |
| XAML-008 | Implement control/data templates, templated parents and lazy resource construction. | Test construction, ownership, namescope isolation, data changes, teardown and replacement failure. |
| XAML-009 | Support custom controls, user controls and markup extensions required by existing apps. | Compile unchanged application documents and execute their actual custom logic; never replace unsupported views with placeholders. |
| XAML-010 | Expose incremental/source-edit and resumable-construction metadata. | Designer selection, construction debugging and reload retain accurate original identities and reject ambiguous/stale edits. |

### UI — UI framework, layout, rendering and platform services

| ID | Required capability | Completion gate |
| --- | --- | --- |
| UI-001 | Provide Avalonia-compatible control/property/event APIs. | Implement observable property metadata, precedence, inheritance, notifications and routed-event behavior, not only class names. |
| UI-002 | Implement complete required control families and custom-control composition. | Verify every required catalog control's interaction, state, styles, keyboard operation and lifecycle. |
| UI-003 | Implement accurate layout, measurement and arrangement. | Test Grid/Canvas/panels/content hosts, tracks, spans, min/max/margins/alignment, invalidation and edge cases against upstream behavior. |
| UI-004 | Provide actual rendering through browser HTML/SVG and WebGPU components. | Document which backend renders each feature; use rendered-image/pixel and interaction checks with fallback/device-loss handling. |
| UI-005 | Implement text, images, shapes, geometries, brushes, gradients, masks and transforms. | Verify geometry bounds, text measurement, clipping, effects and repeated-update resource cleanup, not DOM presence alone. |
| UI-006 | Support pointer, mouse, touch, keyboard, focus and accessibility. | Retain logical interaction and focus on supported edits; expose accessible names/roles and mobile usable controls. |
| UI-007 | Support application/platform services through declared browser adapters. | Provide explicit behavior for storage, clipboard, dialogs, resources, timing and threading constraints; do not pretend unsupported OS calls succeeded. |
| UI-008 | Provide correct ownership, mount/unmount, event/binding cleanup and resource disposal. | Repeated construction/reload/removal leaves no extra listeners, stale names or GPU/DOM resources even when cleanup code throws. |
| UI-009 | Support data-driven controls, collections and virtualization needed by real applications. | Verify collection notifications, selection, template recycling, scroll state and large-data behavior. |
| UI-010 | Maintain responsive rendering and evaluation on representative large projects. | Record reproducible compiler/render latency and memory budgets; avoid blocking IDE controls during heavy work. |

### BINARY — MSIL, DLL/EXE and NuGet conversion

| ID | Required capability | Completion gate |
| --- | --- | --- |
| BINARY-001 | Read actual PE/CLI DLL and EXE metadata and executable method bodies. | Validate tables, signatures, tokens, assembly identities, sizes and method boundaries without loading binaries into the host OS. |
| BINARY-002 | Compile editable IL text and expose disassembly/control-flow information. | Changing supported IL changes emitted behavior; malformed instructions and control flow fail before execution/export. |
| BINARY-003 | Emit JavaScript from verified IL rather than replacing imported libraries or interpreting opcodes at runtime. | Reuse canonical verifier/emitter and shared runtime operations; inspect output and execute original SDK-built fixtures. |
| BINARY-004 | Implement stack/type verification, arithmetic, conversions, branches, calls and arrays. | Reject invalid stack joins, operands and targets; compare values and errors with independent CLR execution. |
| BINARY-005 | Implement fields, construction, virtual calls, static initialization and cross-assembly identity. | Test initialization ordering, recursion, state, interleaved debugger tasks and method dispatch across source/library boundaries. |
| BINARY-006 | Implement exception regions, filters, leave/rethrow and cleanup semantics. | Validate region structure and reproduce typed catch order, original exception identity, finally/fault and cancellation cleanup. |
| BINARY-007 | Implement checked numerics and exact supported 64-bit behavior. | Compare signed/unsigned overflow, narrowing, NaN/infinity and exact values beyond JavaScript's safe integer range. |
| BINARY-008 | Implement managed references and value types required by SDK output. | Test address/indirection/copy/initialization, aliases, null/bounds and escape rules in ordinary and suspended execution. |
| BINARY-009 | Implement generic types/methods and framework adapters needed by real assemblies. | Resolve metadata/signature substitutions and managed behavior without shape-specific fixture replacements. |
| BINARY-010 | Compile SDK-generated async and iterator state machines. | Execute independently built Debug/Release DLLs and packages with multiple awaits, cancellation, exceptions, cleanup and debugger resumes. |
| BINARY-011 | Convert local NuGet packages and resolve approved dependencies. | Validate archive paths/size, metadata, framework assets and exact supplied dependencies; distinguish reference assemblies from executable implementations. |
| BINARY-012 | Link converted libraries into C#/XAML projects. | Invoke actual imported library methods, objects and properties from source applications and share managed exceptions and type identity. |
| BINARY-013 | Expose CLI, reusable library and IDE conversion APIs. | Keep outputs/reports/runtime dependencies coherent and runnable across all interfaces; conversion itself does not invoke application methods. |
| BINARY-014 | Do not fabricate behavior for native code, unsafe features or missing APIs. | Emit specific diagnostics until implementations and corresponding independent acceptance cases exist. |

### SYMBOL — Symbols, source maps and restoration

| ID | Required capability | Completion gate |
| --- | --- | --- |
| SYMBOL-001 | Read Portable PDB documents, points, scopes, locals and state-machine metadata. | Match DLL identity/checksum, method extent, instruction boundaries, source ranges and original byte checksums. |
| SYMBOL-002 | Read supported Windows/native managed PDB formats. | Compare against independently generated Windows compiler and CLR symbols; reject unsupported native-machine/register or legacy records explicitly. |
| SYMBOL-003 | Handle compressed embedded PDB and original-source data. | Bound decompression, validate declared size/checksum and distinguish portable and legacy-native encodings. |
| SYMBOL-004 | Restore symbols and original source only with explicit user approval. | Preview requests without I/O, separate symbol-server and source-origin approval, omit credentials, bound/cancel requests and reject redirects or invalid responses. |
| SYMBOL-005 | Expose verified original source separately from editable application source. | Read-only symbol documents remain debugger attachments; missing symbols yield labeled IL disassembly rather than invented C#. |
| SYMBOL-006 | Attach restored data transactionally to the correct workspace input. | Reject stale DLL records and mismatched identities/checksums; unsuccessful download/validation cannot alter the running app or workspace. |
| SYMBOL-007 | Preserve source locations across composed generated scripts and reload. | Validate UTF-16 source maps, hidden points, generated wrappers and retained executable bodies. |
| SYMBOL-008 | Keep symbol/source matching distinct from security trust. | Document that PDB identities, CRC and legacy MD5 checksums are not publisher authentication or permission to execute/download content. |

### DEBUG — Integrated C#, XAML, JavaScript and MSIL debugging

| ID | Required capability | Completion gate |
| --- | --- | --- |
| DEBUG-001 | Provide source-line and generated-JS/IL breakpoints with bound/unbound state. | Break only at actual executable source/IL sites and preserve original source identity through imports, preprocessing and reload. |
| DEBUG-002 | Support conditions, hit counts, logpoints and exception breaks. | Validate conditions, retain event/hit semantics and distinguish explicit throw-site instrumentation from general first-chance native-engine exceptions. |
| DEBUG-003 | Provide pause/continue/step into/over/out/cancel inside the IDE. | Suspend actual compiled continuations without freezing IDE controls or simulating a completed invocation. |
| DEBUG-004 | Inspect call stacks, frames, locals, watches and tasks. | Show actual suspended state, validate edits, keep scoped data and prevent unsafe expression evaluation in the IDE origin. |
| DEBUG-005 | Step across C# callers, converted DLLs and cross-library calls. | Retain evaluation stack, call frames, arguments, locals, virtual dispatch and return values across pauses. |
| DEBUG-006 | Resume C# constructors and XAML construction. | Pause before actual allocation/hydration work; cancellation disposes partial trees and restores names without publishing a half-built app. |
| DEBUG-007 | Debug asynchronous state machines, competing tasks and cancellation. | Retain cleanup/await/initialization state and prove independence of task budgets and correct completion/failure ordering. |
| DEBUG-008 | Use one integrated debugger presentation for isolated source and binary sessions. | Route toolbar/menu/keyboard commands to the selected context without mixing tasks, watches, breakpoints or state. |
| DEBUG-009 | Retain full browser DevTools compatibility where native engine debugging is used. | Test real engine pause/step/resume and original-source maps; do not claim the in-page UI controls a native paused event loop without transport. |
| DEBUG-010 | Keep debugger overhead/source disclosure out of emitted release code. | Verify absence of emitted continuations/hooks/original maps in release while accurately documenting any dormant tooling bundle bytes. |
| DEBUG-011 | Integrate debugging with hot reload and visual design. | Reject unsafe edits during suspended state and stale retained hooks rather than presenting incorrect rebound locations. |
| DEBUG-012 | Provide offline exported application/library debugging. | Execute, pause, inspect, mutate permitted locals and resume the exported original library without hidden network dependencies. |

### DESIGN — Full visual designer and safe C#/XAML round-tripping

| ID | Required capability | Completion gate |
| --- | --- | --- |
| DESIGN-001 | Edit the actual compiled application's UI in a live artboard. | Designer actions affect real source/runtime objects, not screenshots or a separate mock tree. |
| DESIGN-002 | Provide hierarchy, toolbox, selection, properties, bindings, events and resources. | Expose source identity and editability, support keyboard/touch, distinguish template/generated/ambiguous instances. |
| DESIGN-003 | Round-trip XAML edits without destroying unrelated source. | Preserve comments, whitespace, namespaces, CRLF and protected expressions with span-based preimage-checked transactions. |
| DESIGN-004 | Round-trip C#-constructed UI including imperative construction and mutation. | Trace actual ownership/aliases/final writes and safe control flow; refuse unsafe rewrites until branch/interprocedural support is implemented. |
| DESIGN-005 | Support insert/delete/duplicate/reorder/reparent and reusable component extraction. | Retain unique names, references, project inputs, correct ownership and one atomic undo unit; validate extracted projects before Apply. |
| DESIGN-006 | Provide professional artboard navigation and multi-selection. | Implement zoom/fit/rulers/grid/pan/viewports, accessible gestures, deterministic selection and state preservation. |
| DESIGN-007 | Provide snapping, guides, movement, resizing, alignment and distribution. | Apply logical-coordinate changes as one source transaction; cancellation and stale selections leave source untouched. |
| DESIGN-008 | Support Grid/panel/Canvas layout editing and general layout constraints. | Test tracks, rows/columns, spans, placement and container rules rather than visually forcing CSS coordinates. |
| DESIGN-009 | Provide rich typed property editors and explicit binding/resource editing. | Distinguish literals, expressions and effective runtime values; edits cannot silently replace a binding with a constant. |
| DESIGN-010 | Keep designer undo/redo consistent with text edits and refactor transactions. | Group operations across files, reject intervening stale preimages and preserve source/runtime state on failures. |
| DESIGN-011 | Support theme, viewport and interactive preview workflows. | Changing view/zoom/theme must not unnecessarily reconstruct user state; designer and Interact input modes remain distinct. |
| DESIGN-012 | Expose every designer capability as a reusable library and integrated desktop tool. | Commands/properties/layout/outline/toolbox share actual sessions with editor, debugger, compiler and reload. |

### RELOAD — Transactional state-preserving hot reload

| ID | Required capability | Completion gate |
| --- | --- | --- |
| RELOAD-001 | Reload supported XAML and C# changes without restarting the app. | Retain root/control identity, fields, input/caret/focus and event subscriptions for compatible edits. |
| RELOAD-002 | Reload structural edits and retained-control ownership changes. | Stage construction/reparenting, update namescope/owner fields/DOM order and restore them all on failure. |
| RELOAD-003 | Reload supported bindings, resources, styles and templates. | Replace subscriptions and tear down old templates; reject unsupported semantics without leaving partially applied state. |
| RELOAD-004 | Validate all targets, type/method shapes and revisions before application. | No stale build, source or debugger site may mutate the running session. |
| RELOAD-005 | Provide transactional failure handling and explicit restart-required reasons. | Failed build/apply preserves the previous running app; distinguish rollback of managed stores from arbitrary user callback side effects. |
| RELOAD-006 | Preserve debugger correctness across updates. | Keep retained executable source IDs valid and disallow unsafe patches during paused continuations or incompatible initialization. |
| RELOAD-007 | Prevent subscription/listener/resource leaks across repeated updates. | Run repeated edit/undo/removal and exceptional-disposal tests with retained handler counts and resource ownership. |
| RELOAD-008 | Integrate text, designer and refactor edit workflows. | One workspace journal and compatibility planner governs Apply/Undo/Redo/Restart, with cancellation and user-visible diagnostics. |

### IDE — Professional desktop-style IDE

| ID | Required capability | Completion gate |
| --- | --- | --- |
| IDE-001 | Use a coherent modern Visual Studio-style layout under Jailbreak branding. | Provide compact toolbars, central document groups, hierarchy/properties/debug windows, consistent typography and light/dark themes. |
| IDE-002 | Remove permanent text-only Getting Started and Compatibility Gates panels and the clunky mega-inspector. | Operational tool windows take workspace space; full honest compatibility information is maintained in docs and discoverable links. |
| IDE-003 | Provide real menus and one searchable command registry/palette. | Support keyboard/menu semantics, nested groups, availability, shortcuts and commands wired to real actions rather than fake filtered panels. |
| IDE-004 | Provide genuine docking, floating, auto-hide, close/reopen and saved layouts. | Move existing views/controllers without cloning, validate persisted geometry/IDs and preserve sessions through pointer/keyboard layout changes. |
| IDE-005 | Expose Solution Explorer and project/configuration/resource management. | Load and operate on actual source/project files with validated new-file, configuration and startup behavior. |
| IDE-006 | Provide source tabs, document groups, close/reopen and caret/selection restoration. | Keep editable and generated/symbol documents correctly distinguished and preserve per-document state. |
| IDE-007 | Provide syntax highlighting, find/replace, navigation and editor history. | Operate on exact source ranges and real compiler inputs; protect read-only documents and group programmatic edits. |
| IDE-008 | Provide completion, definitions, references, rename and broader language services. | Use resolved symbols/scopes/inheritance and C#/XAML links; ambiguous transformations fail safely and cross-file changes preview/validate before Apply. |
| IDE-009 | Provide desktop-grade multi-file edit review and reusable refactoring. | Preview diffs, select changes, detect stale files, commit atomically, and undo/redo without overwriting unrelated edits. |
| IDE-010 | Integrate Error List, Output, build profiles and asynchronous compilation. | Navigate actionable original diagnostics, display true build state, reject stale results and expose cancellation/restart decisions. |
| IDE-011 | Integrate Call Stack, Locals, Watch, Breakpoints, Tasks and Debug Settings. | Single toolbar and tool windows operate actual selected runtime context, including binary calls and local mutation. |
| IDE-012 | Integrate Document Outline, Properties, Layout, Toolbox and artboard editing. | Designer commands share current source/session, disposal and history; no duplicate decorative inspector. |
| IDE-013 | Integrate Binary Studio without nesting a second full IDE shell. | Expose IL/disassembly/generated JS/package/symbol views and isolated execution through coherent parent commands while preserving session separation. |
| IDE-014 | Integrate explicit symbol/source restoration and attachment workflows. | Preview requests, obtain approval, cancel, validate and attach atomically with visible source identity/trust boundaries. |
| IDE-015 | Provide keyboard-accessible and responsive desktop/tablet/mobile use. | Prevent tool-window occlusion and horizontal document overflow; support accessible splitters, menus, focus restoration and gesture cancellation. |
| IDE-016 | Retain useful offline and browser storage/file workflows. | Document browser permissions, persistence failures and folder-file limitations; do not claim filesystem capabilities the browser did not grant. |
| IDE-017 | Expose source/design/split/binary perspectives without losing working state. | Switch sessions/views without reconstructing source apps or mixing binary tasks, controls or breakpoint state. |
| IDE-018 | Continue toward desktop IDE feature parity, beyond visual resemblance. | Maintain an explicit feature inventory for advanced editing, semantic refactoring, project/dependency UX, testing/profiling and accessibility; only tested behavior counts. |

### CATALOG — Complete unchanged upstream ControlCatalog

| ID | Required capability | Completion gate |
| --- | --- | --- |
| CATALOG-001 | Use the requested wieslawsoltes/Avalonia fork and an explicit pinned revision. | Record source provenance, input manifest and hashes; do not silently switch to a different fork/version. |
| CATALOG-002 | Compile the full unchanged original ControlCatalog project and solution inputs. | Preserve original pages/code-behind and project dependencies; no substitutes, excluded failing views or suppressed diagnostics counted as success. |
| CATALOG-003 | Run all catalog pages and their real behaviors in the browser. | Verify initial construction, page navigation, inputs, commands, data/template behavior and lifecycle cleanup. |
| CATALOG-004 | Validate rendering and interaction against reproducible upstream expectations. | Use reference screenshots/pixels and UI assertions with documented platform/theme tolerances; DOM-presence tests alone do not prove parity. |
| CATALOG-005 | Make platform/browser adaptation explicit and minimal. | List every adapter and distinguish host adaptation from changes to original application logic or source. |
| CATALOG-006 | Keep partial page gates distinct from full-project acceptance. | Publish selected-page results independently; set a full-pass flag only with complete-input provenance and whole-application evidence. |
| CATALOG-007 | Include debugging, visual editing, reload and offline export in integration acceptance. | Exercise representative real upstream source identities, state-preserving edits and lifecycle paths after full application construction. |

### QUALITY — Verification, security, performance and documentation maintenance

| ID | Required capability | Completion gate |
| --- | --- | --- |
| QUALITY-001 | Use independent CLR oracles for managed source/binary semantics. | Build real owned SDK/Windows fixtures independently; compare emitted values, errors, side effects and cleanup rather than only fixture generation. |
| QUALITY-002 | Exercise actual compiled applications in browser tests. | Test real interactions, native/cooperative pauses, designer edits, reload, state, pixels and offline exports instead of mocked events or placeholder panels. |
| QUALITY-003 | Verify malformed/unsupported inputs and executable-output blocking. | Invalid code, IL, metadata, archives or symbols fail with diagnostics and cannot run/export as successful output. |
| QUALITY-004 | Preserve preview isolation and authenticate IDE/runtime commands. | Validate sender window and per-session channel; keep script-only sandbox/CSP protections. Opaque origin alone must not be described as a network firewall. |
| QUALITY-005 | Bound resource use and cancellation throughout compilation, parsing, downloads and debugging. | Enforce sizes, counts, expansion, task/frame/step budgets and cancellation cleanup without corrupting other sessions. |
| QUALITY-006 | Maintain regression gates for new core features and developer-tool integration. | Each language/control/runtime change adds positive/negative behavior, source mapping, editability, reload and disposal evidence or a tracked blocking gap. |
| QUALITY-007 | Record exact source, test and deployment revisions with provenance. | Distinguish local tests, fixture-build success, committed implementation, canonical CI success and Pages deployment; never use one as proof of another. |
| QUALITY-008 | Maintain up-to-date requirements, architecture, APIs, status, roadmap and historical records. | Audit every authored Markdown document, identify historical/superseded claims, validate links and map requirements to evidence and remaining work. |
| QUALITY-009 | Protect user work during writes, integration and multi-file edits. | Use source preimages, staged validation, atomic journals and non-forced publication; preserve dirty local or concurrent remote work. |
| QUALITY-010 | Define measurable performance, usability and compatibility acceptance. | Publish reproducible workloads/browser/platform versions and gaps; full desktop/product parity is not established by visual similarity or one passing benchmark. |

## Scope and compatibility versions

Pin the C# language version, .NET API/assembly profile, Avalonia revision, supported project-evaluation semantics and browser/rendering targets for each acceptance report. The complete required compatibility profile must be explicit; a later release cannot silently redefine unsupported inputs away to make the full gate pass. Browser platform adapters may be necessary, but their behavior and effect on upstream source must be documented and tested.
