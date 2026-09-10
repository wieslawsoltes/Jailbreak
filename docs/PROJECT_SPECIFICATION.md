# Jailbreak — complete product specification, implementation status, and remaining work

**Document purpose:** one coherent description of the requested finished product, the work already implemented, the evidence supporting that work, and the work still required. This is the product-level specification; individual milestone documents provide implementation details and historical evidence.

**Project:** [wieslawsoltes/Jailbreak](https://github.com/wieslawsoltes/Jailbreak)  
**Reference implementation:** [wieslawsoltes/Avalonia](https://github.com/wieslawsoltes/Avalonia), including its original ControlCatalog  
**Browser application:** [Jailbreak Studio](https://wieslawsoltes.github.io/Jailbreak/)  
**Review date:** 2026-09-10  
**Status:** substantial implemented compiler/runtime/IDE functionality; the complete requested compatibility target has **not** been accepted.

> The required end product is an integrated browser development environment that loads existing Avalonia solutions, compiles their XAML and C# — or compatible managed assemblies — into JavaScript, runs their UI using the browser runtime, and supports source-level debugging, source-backed visual design, and state-preserving hot reload. The full unchanged upstream ControlCatalog is a required acceptance target. A handcrafted catalog, selected original pages, or a polished IDE alone does not satisfy that target.

## Contents

1. [Product scope and non-negotiable requirements](#1-product-scope-and-non-negotiable-requirements)
2. [Status vocabulary and evidence baseline](#2-status-vocabulary-and-evidence-baseline)
3. [End-to-end architecture and reusable libraries](#3-end-to-end-architecture-and-reusable-libraries)
4. [Solutions, projects, workspaces, and output](#4-solutions-projects-workspaces-and-output)
5. [C# source compiler and language semantics](#5-c-source-compiler-and-language-semantics)
6. [XAML compiler](#6-xaml-compiler)
7. [Avalonia-compatible UI framework and rendering](#7-avalonia-compatible-ui-framework-and-rendering)
8. [MSIL, DLL/EXE, and NuGet compilation](#8-msil-dllexe-and-nuget-compilation)
9. [Symbols and original-source restoration](#9-symbols-and-original-source-restoration)
10. [Integrated debugger](#10-integrated-debugger)
11. [Visual designer and source round-tripping](#11-visual-designer-and-source-round-tripping)
12. [Hot reload and lifecycle correctness](#12-hot-reload-and-lifecycle-correctness)
13. [Desktop-style integrated development environment](#13-desktop-style-integrated-development-environment)
14. [Security, accessibility, performance, and portability](#14-security-accessibility-performance-and-portability)
15. [ControlCatalog acceptance](#15-controlcatalog-acceptance)
16. [Verification and continuous integration](#16-verification-and-continuous-integration)
17. [Remaining-work register and implementation order](#17-remaining-work-register-and-implementation-order)
18. [Definition of the fully working solution](#18-definition-of-the-fully-working-solution)
19. [Deliverables and documentation maintenance](#19-deliverables-and-documentation-maintenance)

---

## 1. Product scope and non-negotiable requirements

The following requirements consolidate the original request and its subsequent extensions. An initially small executable subset was permitted as a development milestone, not as a reduction of the final scope.

| ID | Required outcome |
| --- | --- |
| CORE-01 | Compile existing Avalonia-compatible XAML and C# applications to HTML/JavaScript without replacing their application logic with handwritten JavaScript. |
| CORE-02 | Provide a C# compiler, XAML compiler, compatible runtime/framework, and renderer as reusable libraries with explicit public boundaries. |
| CORE-03 | Use plain HTML/JavaScript for the product and provide real WebGPU rendering capabilities. Identify actual rendering backends and fallbacks accurately. |
| CORE-04 | Extend the architecture toward the complete required language/framework/API compatibility, rather than treating unsupported constructs as successful no-op implementations. |
| CORE-05 | Compile and execute the complete unchanged upstream ControlCatalog through a reproducible, pinned-source acceptance gate. |
| CORE-06 | Support real MSIL input, managed DLL/EXE compilation, and NuGet conversion, sharing the source compiler's appropriate infrastructure and runtime services. |
| CORE-07 | Make source/debug metadata, debugger integration, designer support, hot reload, and disposal testing mandatory parts of core development. |
| CORE-08 | Integrate the capabilities into one professional Studio workbench, including source and binary workflows, not disconnected demonstrations. |
| CORE-09 | Commit source, tests, examples, and documentation to this repository, directly to `main` when requested, without overwriting concurrent work. |
| CORE-10 | Keep the verified IDE published on GitHub Pages and support generated runnable/offline artifacts. |
| CORE-11 | Retain clear diagnostics, source provenance, security boundaries, and honest capability reporting throughout development. |

### Interpretation of compatibility

Compatibility means that the relevant original source, metadata, and behavior are supported, not just that an identically named type or property exists. Each claimed feature needs positive execution tests, negative tests where applicable, and integration with the development tools.

“Full language/framework compatibility” remains a broad requested end state. The implementation must turn it into a versioned, exhaustive feature/API inventory. An API that depends on a desktop operating system needs an explicit browser implementation, adapter, alternate deployment design, or a documented unresolved requirement. An unsupported diagnostic is the correct interim behavior, but is not completion of the requirement. No narrower browser-only definition may silently replace the requested scope.

Visual Studio and Rider establish the requested standard for layout, discoverability, workflows, and tool integration. Jailbreak retains its own identity. Similar visual presentation does not establish editor, language-service, debugger, or framework parity with either product.

## 2. Status vocabulary and evidence baseline

### 2.1 Statuses used here

| Status | Meaning |
| --- | --- |
| Implemented profile | Ordinary source implements a defined subset with associated regression coverage. The enclosing full requirement may remain open. |
| Verified checkpoint | A specific reachable commit and its corresponding verification results were observed. |
| Acceptance fixture | An independently built input or oracle exists. This does not prove that Jailbreak can compile or execute it. |
| Unverified/pending | Local code, uploaded Git objects, proposed patches, or a workflow submission exist, but successful integration and acceptance have not been established. |
| Open full target | The requested complete outcome has not passed its end-to-end acceptance gate. |

A tool UI, schema entry, test name, uploaded blob, staged delivery file, or successful fixture build is not interchangeable with an implemented feature. Similarly, a source commit, a successful build, a passing browser test, and a deployed site are separate pieces of evidence.

### 2.2 Recorded repository checkpoints

The following are the last substantiated checkpoints available for this consolidation. They are deliberately immutable historical references, not assertions that later commits cannot exist. A later commit must be assessed before its functionality is promoted in this document.

| Evidence | Recorded result | What it establishes |
| --- | --- | --- |
| [`3fa76ef4f17c9cc58f4b12d14a42fe144ef7fc03`](https://github.com/wieslawsoltes/Jailbreak/commit/3fa76ef4f17c9cc58f4b12d14a42fe144ef7fc03) | Ordinary-source desktop recovery checkpoint. | The recovered docked IDE and symbol-restoration integration are not merely proposed patches at this checkpoint. |
| [Toolchain run `34444201563`](https://github.com/wieslawsoltes/Jailbreak/actions/runs/34444201563) | Completed successfully for `3fa76ef4…`, including the canonical verification/Pages workflow. | Corrects older reports that this desktop recovery was still publication-unverified. It does not certify full ControlCatalog or universal compatibility. |
| [Desktop finalization run `34443891205`](https://github.com/wieslawsoltes/Jailbreak/actions/runs/34443891205) | Completed successfully; retained source and verification artifacts. | Additional recovery evidence, including mobile layout/non-occlusion work. |
| [`4ac5d173fb8bf34b611f668c3d90e071653547a2`](https://github.com/wieslawsoltes/Jailbreak/commit/4ac5d173fb8bf34b611f668c3d90e071653547a2) | Committed SDK-built `ref`/`out` acceptance fixture source and independent CLR-oracle builder. | A concrete executable compatibility target for managed references. This commit alone is not compiler/runtime support for references. |
| [Managed-reference fixture run `34452085336`](https://github.com/wieslawsoltes/Jailbreak/actions/runs/34452085336) | Fixture build and independent CLR execution succeeded. | Establishes expected behavior and real Debug/Release DLL, PDB, and package inputs. |

Historical conversation reports repeatedly mixed pending transport, actual source publication, and verification. This document resolves the confirmed desktop-recovery case above and treats other uncertain work conservatively. It does not repeat old “not committed” statements when a later verified commit contradicts them.

### 2.3 Pending managed-reference implementation

A preserved implementation payload was uploaded as Git blob `ae727e9401dfcbc9c82c84ed9fdb3315d3a8f97e`. The subsequent finalization attempt described identity/source-hash validation, ordinary source commits, and a 14-case acceptance matrix across nine combinations:

- Debug DLL, Release DLL, and NuGet inputs;
- release JavaScript, source-debug, and cooperative-debug execution modes.

The available record does **not** establish successful materialization, execution of that entire matrix, or deployment of that payload. Before continuing this work, inspect current ordinary compiler/runtime source and Actions evidence. Reuse and reconcile the preserved implementation when valid; do not discard it or count the object upload as delivered support.

### 2.4 Overall product status

The source and binary compilers, runtime, debugger, designer, reload system, and IDE all have substantial implemented profiles. The complete original ControlCatalog, unrestricted C# round-tripping, arbitrary SDK-generated async-state-machine compatibility, and complete language/framework coverage remain open full targets. Selected native-symbol formats and the explicit restoration workflow are implemented profiles, not unrestricted symbol-server or native-debugging compatibility.

## 3. End-to-end architecture and reusable libraries

### 3.1 Required compilation and execution routes

```text
Solution / projects / source / resources
             |
             v
       Project evaluation
             |
       +-----+--------------------+
       |                          |
       v                          v
 C# parse / bind / lower     XAML parse / validate / lower
       |                          |
       +------------+-------------+
                    |
                    v
          JavaScript + UI definitions
                    |
                    v
     Shared runtime + compatible UI framework
                    |
          HTML / SVG / WebGPU backends
                    |
               Browser app

IL text ------------------+
                          |
Managed DLL/EXE -> PE/CLI --+-> verified IL -> JavaScript
                          |                       |
NuGet -> validated assets-+                       +-> shared runtime bridge

PDB / embedded symbols / approved restoration
             |
             v
 Identity + checksum + IL/source-range verification
             |
             v
 Source maps / sequence points / scopes / debugger metadata

IDE <-> reusable compiler, source-edit, debug, design, and reload APIs
IDE <-> isolated source/binary application sessions
```

### 3.2 Existing component responsibilities

| Location | Responsibility |
| --- | --- |
| `packages/compiler-core` | Shared source locations, diagnostics, XML infrastructure, identifier/JavaScript serialization helpers. |
| `packages/csharp-compiler` | C# parsing and source-to-JavaScript lowering, including supported development continuations. |
| `packages/xaml-compiler` | XAML parsing/validation and runtime UI definitions/source identities. |
| `packages/project-system` | Workspace/project evaluation, source compilation orchestration, preview and export construction. |
| `packages/avalonia-runtime` | Compatible control/property/binding/resource/style/template/lifecycle behavior and browser UI integration. |
| `packages/managed-pe` | Bounded managed PE/CLI metadata, method bodies, and PE debug-directory reading. |
| `packages/msil-compiler` | IL decoding, validation, normal/debug/cooperative JavaScript emission. `verified.js` is the documented integrated pipeline; preserved prototypes must not be mistaken for equivalent entry points. |
| `packages/msil-runtime` | Converted-method execution services, managed types/operations/adapters, binary debugger and export support. |
| `packages/nuget` | Validated package input, supported executable-asset/dependency selection, and compilation orchestration. |
| `packages/binary-project` | Source/binary interoperability and serializable binary workspace records. |
| `packages/portable-pdb` and `packages/native-pdb` | Portable/embedded and managed Windows symbol profiles, normalized into shared metadata. |
| `packages/symbol-restoration` | Explicitly approved bounded symbol-store and Source Link retrieval. |
| `packages/development` | Debug sessions/continuations, source-backed designer transactions, inspection, construction, structural/environment reload. |
| `packages/workbench` | IDE composition, commands/navigation, source intelligence, editor/refactoring workflows, docking, source/binary context routing. |
| `apps/ide` and `apps/binary` | Browser workbench clients. Business/compiler semantics should remain in reusable packages. |
| `tests`, `tests/fixtures`, `scripts`, `.github/workflows` | Regression tests, original/owned inputs, independent oracles, build and publication gates. |

### 3.3 Architectural obligations

Reuse diagnostics, type services, coercion/numerics, exceptions, source maps, debugger scheduling, source transactions, and lifecycle hooks where they genuinely share semantics. Do not force the C# syntax parser to parse stack-based IL, and do not duplicate an opcode implementation merely to add debugging.

Generated JavaScript execution is the product route. A converted DLL must not be replaced by a handwritten source equivalent. Existing native-browser, cooperative-debug, and release execution paths must produce equivalent results for accepted inputs. Debug-only transformations may change scheduling to permit pauses, but must not silently change application semantics.

The runtime and workbench must support multiple independent sessions. A global loader, breakpoint store, or callback must not accidentally redirect one runtime to another runtime's XAML, symbols, or application state.

## 4. Solutions, projects, workspaces, and output

### Required finished behavior

**PROJ-01:** Load existing solutions and their projects, source files, resources, references, and dependencies with a visible project/startup configuration. Resolve relative paths and project relationships deterministically.

**PROJ-02:** Evaluate the required project properties, conditional source/resource selection, target frameworks, configuration, imports, references, and generated inputs used by the compatibility target. Do not silently drop unsupported project semantics.

**PROJ-03:** Support practical browser file/folder import and serialized workspace round-tripping. A user selecting one project file does not automatically grant access to neighboring files; request the necessary folder/files and report missing inputs.

**PROJ-04:** Build source and compatible binary dependencies together, display source-positioned diagnostics, inspect generated output, and run/export the resulting application.

**PROJ-05:** Distinguish release artifacts from development artifacts. Original-source disclosures and executable debug hooks must be explicit. Export should retain the dependencies required by the selected supported application without an undocumented network dependency.

**PROJ-06:** Keep build cancellation, stale-result rejection, source-size limits, workspace persistence, and artifact provenance reliable. A failed build must not execute new invalid output.

### Work already implemented

The project system and IDE provide source/workspace import, project/build-profile selection, source and binary compilation entry points, diagnostics, generated-JavaScript inspection, isolated preview execution, workspace download, and offline application/IDE exports. File and symbol documents are distinguished; verified library source remains read-only debug data rather than additional source compilation input.

Binary workspace records can retain DLL bytes with their matching PDB and original source. NuGet records feed the package route. Existing limits, supported project evaluation, mixed-input restrictions, and the execution profile must remain visible rather than being interpreted as arbitrary MSBuild compatibility.

### Work remaining

Complete the project-evaluation inventory needed by the original ControlCatalog and its dependency closure, then extend to the broader required solution/project space. Resolve generated code/source generators, build tasks, analyzers, transitive dependencies, reference assemblies versus executable implementations, multi-targeting, and platform-specific assets explicitly. Downloading a package must not implicitly authorize running its build tasks.

Add reproducible project-level build reports that identify selected inputs and missing semantics, not just a count of successful example workspaces.

## 5. C# source compiler and language semantics

### Implemented profile

The source compiler handles the subset exercised by the committed UI/library examples, including common declarations, fields/properties/events, supported control flow and expressions, UI construction, supported methods/calls, and integration with the shared runtime. It emits optional source locations and cooperative continuations for supported debugging paths.

Ordinary and cooperative constructor execution have been extended, including the documented constructor-delegation profile. Source-level asynchronous execution exists in the supported profile. That is distinct from compiling an SDK-generated async state machine from an existing DLL.

The language-service/designer work also parses C# to resolve supported symbols, local aliases, initializer values, and final imperative property assignments. Those analysis features do not constitute a complete C# binder.

### Required completion inventory

| ID | Required semantic area | Remaining acceptance work |
| --- | --- | --- |
| CS-01 | Lexing, parsing, preprocessing, namespaces, imports, aliases, partial and nested declarations. | Publish a versioned grammar/feature matrix, preserve original offsets through preprocessing, and test valid/invalid forms used by upstream source. |
| CS-02 | Types, inheritance, interfaces, accessibility, overload resolution, conversions, constructors, properties, indexers, events, delegates, records, and structs. | Close binding and runtime-semantic gaps with CLR comparisons; do not substitute argument-count dispatch for general overload resolution where signatures require more. |
| CS-03 | Expressions and control flow, pattern matching, switch forms, exceptions/filters, iteration, disposal, and checked contexts. | Verify source lowering and debug lowering independently. Existing MSIL checked arithmetic does not by itself implement all source `checked`/`unchecked` constructs. |
| CS-04 | Generic types/methods, constraints, variance, inference, nullable semantics, and compatible metadata behavior. | Implement the required full type-system path and maintain equivalent source and binary runtime behavior. |
| CS-05 | Value semantics, boxing/unboxing, `ref`/`out`/`in`, ref returns/locals, readonly behavior, arrays, and numeric conversions. | Establish aliasing, lifetime, storage, copying, overflow, and precision rules; do not model all managed values as interchangeable JavaScript objects/numbers. |
| CS-06 | Lambdas, closures, method groups, LINQ/query behavior, iterators, async/await, tasks, cancellation, and exception propagation. | Complete semantics beyond the existing profile, including captured state across debugging/reload and independently compiled SDK inputs. |
| CS-07 | Reflection, attributes, dynamic/runtime metadata, interop, unsafe/native dependencies where required. | Define executable implementations or explicit unresolved platform requirements; metadata recognition alone is not support. |
| CS-08 | Debug and designer metadata for all accepted constructs. | Carry source identities, scopes, liveness, editability, and reload classification through each lowering stage. |

General language coverage must be measured by construct and semantic case. A construct that parses but emits wrong code is unsupported; successful compilation is not sufficient evidence.

The initial implementation uses JavaScript-compatible runtime machinery. Exact managed integer widths, 64-bit values, floating-point edge behavior, equality, nullability, evaluation order, disposal, and exception identity need explicit tests. JavaScript defaults are not automatically the corresponding C# semantics.

## 6. XAML compiler

### Required finished behavior

**XAML-01:** Support the original Avalonia XAML constructs and namespaces used by existing applications and the full ControlCatalog: class association, namescopes, object/property elements, content properties, attached properties, collections, types, converters, resources, markup extensions, events, bindings, templates, styles, themes, and custom controls.

**XAML-02:** Resolve names/types/members against the compatible framework and source/binary type models. Reject unsupported or unresolved constructs with useful file/span diagnostics. Do not suppress errors to make an original page appear compatible.

**XAML-03:** Preserve original source identities for construction stepping, visual selection, navigation, binding diagnostics, source edits, and reload matching.

**XAML-04:** Keep generated UI definitions, class initialization, field/name exports, and event wiring consistent across release, native-debug, cooperative-debug, designer, and exported applications.

### Work already implemented

The compiler and loader support the committed UI profile, original-source spans, namescope integration, compatible property/content construction, bindings/resources/styles/templates, and code-behind event integration. Original CheckBox and Canvas page fixtures demonstrate selected unchanged upstream inputs with explicit host adapters.

Cooperative construction now uses the same traversal as normal construction for supported visual/property-element paths. It is not a second XAML interpreter that fabricates a parallel tree.

### Work remaining

Complete the upstream construct/extension inventory, including generated/compiled binding semantics, custom application types, complex template/resource graphs, theme selectors, and any unresolved loader behavior. Audit all source identities across generated/template instances and error paths.

Lazy resource/template evaluation, native callbacks/accessors, and other remaining synchronous step-over regions need separate acceptance for fully resumable construction. A construction pause before a visual is allocated is not proof that every XAML extension, resource factory, or template can suspend safely.

## 7. Avalonia-compatible UI framework and rendering

### Work already implemented

The runtime provides a compatible profile of controls, observable/property behavior, binding, resources/styles/themes/templates, namescopes, input/event wiring, and browser lifecycle/rendering. It contains actual HTML controls and retained SVG rendering as well as existing optional WebGPU functionality. The unchanged Canvas page exercises real vector geometry, gradients, opacity masks, and color behavior.

Canvas positioning and Grid defaults/spans have received targeted semantic fixes. Reordering retains DOM/control identities, and disposal removes owned subscriptions and rendering resources in tested cases.

### Required completion areas

| ID | Required area | Completion criteria |
| --- | --- | --- |
| UI-01 | Styled/direct/attached properties, metadata, priorities, inheritance, coercion, validation, change notification. | Original application property behavior agrees with reference execution, including precedence and invalidation. |
| UI-02 | Binding paths, modes, converters, validation, commands, collection notifications, dynamic resources, data context. | Correct updates, errors, rebinding, inheritance, and disposal under normal execution and reload. |
| UI-03 | Styles, selectors, pseudoclasses, themes, control/data templates, resource lookup. | Correct selection, precedence, instantiation, recycling, resource scopes, and cleanup; no placeholder template behavior. |
| UI-04 | Layout: measure/arrange, minimum/maximum sizes, alignment, margin/padding, Grid/Canvas/stack/wrap/dock/scroll behavior. | Test logical layout results and rendered geometry; CSS auto-layout is not assumed equivalent to Avalonia layout. |
| UI-05 | Controls and application services. | Every control/API in the target inventory has actual behavior and tests, including custom controls, item presentation, selection, virtualization, scrolling, popups/dialogs, menus, and application lifetime where required. |
| UI-06 | Routed input/events, focus, keyboard, pointer/touch, capture, text editing/IME, clipboard, drag/drop, accessibility. | Expected interactions work with real browser input and assistive semantics. |
| UI-07 | Graphics/text/images, clipping, transforms, opacity, geometry, drawing, animation and rendering invalidation. | Validate pixels/geometry and resource lifetime, including backend differences and high-DPI behavior. |
| UI-08 | WebGPU acceleration and fallbacks. | Identify supported paths, exercise actual GPU submission/rendering, recover or diagnose unavailable/lost devices, and retain functional explicit fallbacks. |
| UI-09 | Platform-dependent APIs. | Supply documented implementations/adapters or track unresolved requirements; do not silently claim browser equivalents for absent operating-system services. |

The original Canvas page uses the retained SVG backend; it must not be described as newly implemented WebGPU tessellation. Full rendering and framework parity remain open. Every backend requires its own correctness and performance evidence.

## 8. MSIL, DLL/EXE, and NuGet compilation

### 8.1 Work already implemented

The binary route reads real managed PE/CLI images, metadata, method signatures/bodies, fields/properties/types/references, and supported exception/debug information. It also accepts an ILAsm-style source subset. The integrated verifier checks supported instructions, operands, branches, stack/control-flow conditions, and executable dependencies before generating JavaScript.

The executable profile covers the tested arithmetic/comparison/control-flow operations, loops/recursion, supported calls/virtual dispatch, constructors, instance/static storage, arrays, numeric conversions, throws, and typed exception regions. Checked arithmetic/conversions and shared exception classes allow source C# to catch errors raised by converted DLLs.

The cooperative route reuses the verifier/emitter/runtime and preserves method arguments, locals, evaluation stack, instruction position, call frames, and exception/unwind state across accepted pauses. It supports mixed source/binary calls and debugger-local mutation in the tested profile. It is not a runtime opcode interpreter.

The NuGet converter validates local archives, selects supported executable assets, and passes them through the same compiler. The source/binary bridge exposes supported converted classes/methods/properties to the source UI pipeline. Reference assemblies, native libraries, package build tasks, and arbitrary external dependencies must not be treated as executable implementations by default.

### 8.2 Remaining binary requirements

**IL-01:** Complete managed metadata/signature/type-model coverage required by real upstream binaries, including constructed generics, value types, references, custom attributes and relevant runtime metadata.

**IL-02:** Complete executable instruction semantics and verification for the required profile. Typed stack merges, managed-reference lifetime/aliasing, value copying, boxing, array covariance/rank, constrained calls, dispatch, numeric precision, and invalid IL must be handled explicitly.

**IL-03:** Complete exception semantics beyond the supported region profile, including filters and other currently restricted cases where required. Preserve identity and cleanup order across calls, suspension, cancellation, and failure.

**IL-04:** Execute SDK-generated async/iterator state machines, not only equivalent source-level examples. This depends on type/value/reference/generic semantics and the required task/builder/awaiter framework APIs. Validate completion, suspension, failure, cancellation, state ownership, and resume under the debugger.

**IL-05:** Complete cross-assembly linking, generic/static initialization, framework adapters, and source/binary interoperability. Avoid duplicate type universes with incompatible equality or exception behavior.

**PKG-01:** Extend asset selection, dependency resolution, framework compatibility, symbols/source handling, and package diagnostics to the required existing projects. Restore policy and network permission must be explicit. A downloaded package does not expand the compiler's execution capability automatically.

**IL-06:** Keep conversion separate from invocation. Inspecting/converting DLL/EXE or package bytes must not execute their methods or native code on the host.

### 8.3 Managed-reference acceptance target

The committed `reference-src` fixture covers local aliasing, `out`, fields/static fields, array-element references, strings, exact wide integers, floating point, narrowing, argument mutation, exception cleanup, null receivers, and bounds failures. Its independent CLR results are the expected behavior.

Before marking reference support implemented, require the complete 14-case matrix across the nine recorded input/execution combinations, negative verification tests, pointer/reference escape and lifetime tests, mixed source/binary calls, debugger inspection/mutation, and lifecycle/cleanup evidence. This work is also a dependency for broader SDK state-machine compatibility.

## 9. Symbols and original-source restoration

### Implemented profiles

| Area | Established implementation scope |
| --- | --- |
| Portable PDB | Metadata, document/source spans, method sequence points, scopes/locals, relevant custom records, and matching against assembly metadata/IL bounds. |
| Embedded portable data | Bounded compressed embedded Portable PDB/source handling and exact decompression/source-checksum checks. |
| Managed Windows PDB | MSF7/C13 container, identity, modules, managed procedure tokens, lexical IL-slot locals, source lines/columns and checksums, validated against independently built Windows fixtures. |
| Original-source identity | DLL/PDB identity plus supported checksum and instruction/scope validation before presenting source as verified. No synthetic original C# from disassembly. |
| Symbol-store/Source Link restoration | Explicitly approved request planning and bounded retrieval, independent symbol/source origin approval, cancellation, identity/checksum revalidation, and explicit workspace attachment. |
| Studio integration | Read-only verified symbol documents, shared source/IL debugger locations, and a Symbols & Sources workflow. |

Legacy MD5 source matching exists for relevant Windows compiler inputs. MD5 and PDB identity data are not publisher authentication. Source bytes, including line endings, must satisfy their matching checksum before being called verified.

### Remaining symbol requirements

**SYM-01:** Inventory and implement the additional required Windows/native formats and records. Current managed MSF7/C13 support does not cover arbitrary native machine code, register locations, C++ types, MSF2/C11, native Edit-and-Continue relocation, legacy native embedded-source encodings, or every compiler-specific record.

**SYM-02:** Complete async/iterator/source-state mapping in conjunction with actual state-machine execution, including optimized or unavailable locals and hidden points. Never display a fabricated live value/location as resolved.

**SYM-03:** Extend restoration compatibility deliberately: symbol packages/feeds, compression formats, authentication, offline caches, provenance, failure recovery, and supported CORS behavior need explicit requirements/tests. The existing credential-free approved-server path is not arbitrary-feed compatibility.

**SYM-04:** Preserve read-only/debug-only treatment of restored source, release source-disclosure boundaries, and atomic attachment to the unchanged selected assembly/workspace record.

Restoration must not use a metadata path as an implicit local file read or network permission. No successful restore may return a mismatched PDB/source merely to avoid an error.

## 10. Integrated debugger

### 10.1 Required finished debugger

**DBG-01:** Debug C#, XAML construction/binding activity, generated JavaScript, and converted IL/DLL/NuGet code from the same IDE, with accurate original source when available and explicitly labeled disassembly otherwise.

**DBG-02:** Provide breakpoints with bound/unbound status, enable/disable, conditions, hit counts and logpoints; pause/continue/step into/over/out; selected frames; locals/watches; supported value editing; exception modes; and task/session selection.

**DBG-03:** Preserve real execution state through pauses, recursion, nested/cross-assembly calls, construction, asynchronous suspension, exceptions, cancellation, and cleanup. Report unavailable values honestly.

**DBG-04:** Support fully usable in-IDE stepping without requiring native DevTools. Keep native DevTools integration as a distinct supported mode for JavaScript-engine debugging, not a pretend in-page remote-control feature.

**DBG-05:** Preserve development metadata through compiler changes and reload, and omit emitted development hooks/source maps from release output. Dormant tooling module bytes and emitted application instrumentation are different measurements.

### 10.2 Work already implemented

The development session supplies supported source-line conditions/hit counts/logpoints, safe watches/snapshots, source navigation, and native breakpoint hooks. Source C# continuations add in-IDE stepping, mixed call frames, supported async flows, scalar-local edits, task management, execution budgets, and cancellation.

Source constructors and supported XAML construction paths are resumable. Partial construction is staged rather than installed as the running application; cancellation disposes partial objects and restores exported names. Type-specific runtime loader routing prevents another runtime context from hijacking an existing instance's XAML initialization.

Converted methods share the cooperative scheduler and Studio's stack/local presentation. PDB-free methods expose read-only `[IL]` locations; verified originals retain `[symbol]` identity. The binary runner and offline development exports include corresponding debugger behavior. Source and binary IDE sessions retain separate tasks/breakpoints while sharing presentation and toolbar routing.

Existing exception/cancellation tests cover important distinctions such as `finally` versus `fault`, replacement exceptions, rethrow identity, suspended type initialization, and cleanup awaiting another initialization task.

### 10.3 Work remaining

Extend these guarantees to every accepted language/IL/runtime feature. SDK async-state-machine debugging, general value/reference/generic state, optimized variable availability, native callback transitions, remaining template/resource/accessor construction regions, and all required exception modes need acceptance.

Safe workbench watches currently favor bounded own-data-property paths and scalar comparisons; unrestricted expression evaluation is not implicitly available in the IDE origin. Any richer evaluator must have an explicit runtime-side execution policy and accurately report side effects.

Keep current-frame highlighting, breakpoint rebinding, task ownership, and stale-frame/value-edit rejection correct across document edits, session switches, export/import, and supported hot reload.

## 11. Visual designer and source round-tripping

### 11.1 Required finished designer

**DES-01:** Display and manipulate the actual compiled UI with live state and compatible rendering, not a screenshot or independent mock control tree.

**DES-02:** Provide Document Outline, searchable Toolbox, Properties, events/bindings/resources/styles/templates, Layout, visual selection/multi-selection, source navigation, and clear ownership/editability information.

**DES-03:** Provide precise artboard editing: zoom/pan/fit, rulers, guides, snapping, device/view/theme previews, pointer/touch/keyboard interaction, movement/resizing, alignment/distribution, container layout and constraints.

**DES-04:** Round-trip supported XAML and C# edits while preserving comments, formatting, unrelated code, source semantics, and application-owned state. Every edit must be previewable/undoable and reject stale or ambiguous source.

**DES-05:** Complete general imperative C# visual round-tripping with control-flow, alias, escape, ownership, and interprocedural analysis. Existing object-initializer/local-alias support is a milestone, not the complete requirement.

**DES-06:** Support safe insertion, duplication, deletion, reordering, reparenting, and reusable-component extraction, including namescope/event/binding/reference updates and multi-file transactions.

### 11.2 Work already implemented

The designer uses runtime source identities and controller-backed tool windows. Literal XAML edits preserve surrounding source. Binding/resource expressions are protected from accidental literal replacement, with explicit editing paths for supported expressions. Names are made unique during supported duplication; stale preimages reject unsafe writes.

The artboard includes viewport presets, zoom/fit, logical rulers/grid, panning, selection/multi-selection, pointer/touch/keyboard movement and resizing, snapping/constraint modifiers, alignment/distribution, and atomic source-backed layout edits. Preview gestures do not mutate source until commit; Escape/cancellation can discard the gesture. Canvas geometry tools operate within an explicitly constrained ownership/layout profile.

The Grid inspector supports actual tracks, insertion/removal, child placement/spans and source transactions, together with corrected runtime default placement and span behavior. Grid editing does not by itself establish the full Avalonia measure/arrange algorithm.

C# editing supports literal object initializers and flow-ordered final literal assignments through supported local aliases. Reassigning an alias ends its previous ownership. Computed values, ambiguous branches, captured references, and unknown helper effects are protected rather than rewritten speculatively.

Reusable-component extraction and workspace review share a bounded source transaction/journal. Supported extraction validates the new multi-file project before Apply and requests restart for incompatible type/document-set changes.

### 11.3 Work remaining

Complete nonliteral expression-aware edits, branch/loop/path-sensitive assignments, interprocedural control construction, captured/escaped ownership, factory methods, collections and template-generated visuals. Preserve semantics rather than promising unrestricted rewriting of arbitrary code without analysis.

Extend layout manipulation beyond the current literal/same-container profiles: transformed visuals, nested ownership, responsive constraints, margins/opposing anchors, general Grid/stack/dock behavior, multi-selection resize, complex template/resources/style edits and custom controls. A rejection is preferable to corrupting source, but a rejected mandatory scenario remains backlog.

Complete typed property/event editors, reliable binding/resource/theme navigation, design-time data and error reporting, and accessibility/keyboard parity across all designer operations. Keep C# constructor restart requirements explicit until safe instance migration is implemented.

## 12. Hot reload and lifecycle correctness

### Required behavior

**REL-01:** Classify every edit as compatible, restart-required, or invalid before replacing a running application. Failed builds and rejected changes retain the last working development preview.

**REL-02:** Apply accepted changes transactionally using source/build/session/revision checks. Preserve root/control identity, user input/caret/focus, instance fields, selection, active bindings, and event subscriptions where compatibility is claimed.

**REL-03:** Dispose replaced objects/subscriptions/templates/rendering resources after successful ownership transfer, and restore prior ownership/definitions on failure. Continue cleanup when one disposer throws without concealing the original failure.

**REL-04:** Define policies for active debugger frames, awaiting tasks, closures, type/static initialization, resource side effects, and application-owned callbacks. Do not claim general rollback of arbitrary external side effects.

### Implemented profile and boundaries

| Edit/lifecycle area | Implemented behavior | Remaining boundary |
| --- | --- | --- |
| Supported C# method bodies | Existing method dispatch and source/debug metadata can be updated without reconstructing accepted instances. | Constructors/initializers/type shape, captured closures, active frames and other incompatible cases require explicit handling/restart. |
| Literal XAML properties | Supported live-property changes preserve instances and property stores, with preflight and rollback. | Not every property setter is side-effect-free or safely reversible. |
| Panel children | Insert/delete/reorder supported children; named or unambiguous matches retain identities. | Ambiguous state transfer must be rejected; arbitrary tree surgery is not implied. |
| Content hosts/reparenting | Supported ownership moves and content replacement update namescopes/data context/subscriptions with rollback. | General ownership-sensitive templates/custom callbacks need broader coverage. |
| Bindings/resources/styles/templates | Defined replacement/subscription/environment profiles and cleanup tests exist. | Not unrestricted graph replacement with arbitrary application state migration. |
| Source identity/debug state | Revision and source matching prevent stale patches; retained constructor/accessor hooks are guarded. | General retained-code remapping and active-frame migration remain acceptance work. |
| Failed construction/render/application | Staged nodes, property/method/name/ownership state are restored in tested failure paths. | External user-code side effects cannot be assumed reversible merely from property snapshots. |

Complete incremental compilation/reload planning, dependency invalidation, cancellation/versioning, compatible resource/template updates, and runtime disposal tests alongside each new feature. “Hot reload succeeded” must refer to the applied running revision, not just a successful source compile.

## 13. Desktop-style integrated development environment

### 13.1 Required workspace structure

The user explicitly rejected permanent text-only **Compatibility Gates** and **Getting Started** panels and the oversized combined inspector. Keep explanatory compatibility material in documentation or deliberate help/report surfaces; do not consume primary workbench space with those panels.

The intended workbench has one menu system, one execution/session toolbar, a central document/editor/designer area, and real tool windows. Source and Binary Studio are integrated perspectives with separate runtime state, not nested complete IDEs.

| ID | Area | Required finished experience |
| --- | --- | --- |
| IDE-01 | Menus and commands | Actual File/Edit/View/Project/Build/Debug/Refactor/Tools/Window/Help menus, keyboard navigation, nested groups, enabled/checked context, and one shared command registry with the palette. |
| IDE-02 | Docking | Dock, split, float/redock, auto-hide, close/reopen, resize, reset, presets and named persisted layouts; move existing views without cloning controllers/state. |
| IDE-03 | Project navigation | Solution Explorer, file/project hierarchy, startup/configuration, resources/references, source versus read-only symbols, active-file navigation and missing-input diagnostics. |
| IDE-04 | Editing | Stable tabs/documents, caret/selection/scroll history, syntax presentation, find/replace/search, commands/shortcuts, source-aware completion/navigation/refactoring and reliable undo/redo. |
| IDE-05 | Debugger windows | Call Stack, Locals, Watch, Breakpoints, Tasks, Debug Console and Debug Settings, with source highlighting and commands routed to the selected actual runtime. |
| IDE-06 | Designer windows | Document Outline, Properties, Layout, Toolbox, source/visual selection, binding/resource/event workflows and live artboards. |
| IDE-07 | Build/run | Release/design/cooperative/native-debug modes where supported; Start/Continue, Stop, Restart, Pause and stepping; Error List, Output, generated code, export and build/reload state. |
| IDE-08 | Binary workflow | IL/DLL/EXE/NuGet/symbol loading, generated/disassembled/verified source, methods/arguments, conversion diagnostics and unified debugger presentation without mixing sessions. |
| IDE-09 | Source changes | Source-aware rename and component extraction, multi-file change preview/preflight, atomic application, bounded shared undo/redo, conflict/stale-input rejection. |
| IDE-10 | Desktop-quality operation | Keyboard/pointer/touch access, light/dark themes, legibility, context-sensitive controls, accessible focus, responsive layout and no tool-window occlusion of the usable mobile artboard. |

### 13.2 Work already implemented

The recorded desktop-recovery checkpoint contains the controller-backed docking/menus composition, separate tool windows, context-aware source/binary presentation, source-backed designer integration, symbols/restoration tools, and browser acceptance of the exposed UI. This supersedes earlier reports describing that composition as only local.

Existing editor capabilities include command/file/symbol navigation, literal and Unicode-aware search, find/replace, line/column navigation, caret persistence, document read-only protections, source-aware assistance/definitions/references/rename for the implemented semantic profile, and a shared multi-file transaction workflow.

The execution toolbar, breakpoints/current-source highlighting, debugger tables/value editing, Code/Split/Designer/Binary perspectives, artboard tools, and binary session switching operate actual compiled applications. Inline/offline exports are part of the product workflow, not just a screenshot deliverable.

### 13.3 Remaining desktop parity work

Desktop parity is a complete workflow target, not a CSS milestone. Complete the source binder/language service and its use in completion, diagnostics, symbol resolution and safe refactoring. Extend editor usability for large files/workspaces, richer editing and navigation, consistent history, and robust accessibility.

Complete project/reference/package management, dependency/build inspection, testing/debugging workflows, configuration persistence, source-control integration expectations, and any remaining desktop counterpart workflows through a prioritized feature inventory. Items inferred from “desktop parity,” rather than explicitly specified, must be labeled as such until their required scope is agreed; do not claim they were implemented merely because a menu category exists.

Audit command routing in every perspective and focus context, including sandboxed previews, modal dialogs, floating windows and paused tasks. Commands unavailable for the selected runtime must be disabled or explained, not forwarded to a hidden unrelated session.

Maintain visual consistency without repeatedly discarding working integrated controllers. New UI revisions must retain and test existing designer, refactoring, symbol, source/binary, and reload capabilities.

## 14. Security, accessibility, performance, and portability

### Security and trust requirements

**SEC-01:** Application execution stays outside the IDE origin. Preserve the script-only isolated preview boundary and explicit sender/session validation for runtime commands and replies. Source/binary sessions must not cross-contaminate state.

**SEC-02:** Parsing, conversion, inspection, and request planning do not execute application/native code or implicitly authorize filesystem/network access. Imported packages must not run build tasks without a separately designed explicit policy.

**SEC-03:** Restore symbols/source only with explicit consent and approved destinations. Enforce streaming byte/request/time limits, cancellation, credential and redirect policy, assembly/symbol/source verification, and stale-workspace rejection before attachment.

**SEC-04:** Preserve bounded parsing, archive checks, cancellation, input/source limits, safe rendering of inspected text, and negative tests. Malicious or oversized input must not be accepted as a successful empty implementation.

**SEC-05:** Distinguish source integrity matching from authenticity. Debug exports containing original source need clear labeling. Do not describe browser sandboxing or execution budgets as a completed universal hostile-code/denial-of-service audit.

### Accessibility and portability

**QUAL-01:** All important menu, palette, docking, editor, debugger and designer operations need keyboard access, labeled controls, visible focus, and consistent state announcements. Touch and narrow layouts must retain an operable editor/artboard and reachable tools.

**QUAL-02:** Maintain tested dark/light themes, scaling/high-DPI behavior and responsive layouts. Publish a browser/backend support matrix from actual testing; do not infer universal WebGPU or filesystem support from one Chromium run.

### Performance and resource behavior

**QUAL-03:** Measure compiler/build latency, cancellation responsiveness, designer dragging/zoom, large-source editing/search, framework layout/rendering, debugger overhead, memory and disposal. Worker-based compilation and GPU-backed paths must be measured where claimed.

No complete quantitative performance budget has been established by the recorded milestones. Choose and document representative workloads, environments, budgets and regression thresholds before declaring the product “fast” or desktop-equivalent. Release/debug overhead and rendering-backend performance should be reported separately.

## 15. ControlCatalog acceptance

### 15.1 What has been achieved

Selected original upstream files, including CheckBoxPage and CanvasPage, have been retained with provenance/hash checks and exercised through explicit isolated browser-host adapters. The original Canvas fixture renders actual shapes/geometry/gradient/mask behavior with browser pixel checks. These are meaningful upstream gates.

The repository also contains example workspaces intended for Jailbreak's supported profile. A workspace named ControlCatalog must not be confused with the complete original upstream solution. The recorded upstream fixture metadata retains `fullControlCatalogPassed` as false.

### 15.2 Required full gate: CAT-01

1. Pin the requested fork, an exact commit, projects, all original source/resources, and dependency versions. Preserve licenses and original-source hashes. New progress must not silently switch to a more convenient upstream revision.
2. Evaluate the original project/solution structure and build its required dependency closure. Report every unsupported project, C#, XAML, binary/API or platform requirement.
3. Compile/link the complete original catalog, not only selected pages and not replacement page implementations. Any minimal browser launch/theme/platform adapter must be separately enumerated and must not rewrite or suppress catalog behavior.
4. Start the complete catalog and exercise navigation, controls, binding, themes/resources/templates, custom drawing, input, layout and application behavior using real browser tests.
5. Establish interaction and visual comparisons against the pinned reference. A loaded root or nonempty DOM is insufficient. Specify what tolerances and environment-dependent differences are permitted.
6. Run representative paths in release, native-debug and cooperative-debug modes and exercise designer/source inspection and supported reload paths without corrupting the original program.
7. Export and run the resulting application with documented required assets/runtime and no hidden substitute logic.
8. Publish a complete machine-readable report: total pages/features, compile/link/run/interaction/visual status, remaining diagnostics, adapters, backend/environment, source hashes and tested commit.

Only after all required portions pass may the full-catalog flag change. An increasing number of green selected pages is progress, not a substitute for a full-project gate.

## 16. Verification and continuous integration

### 16.1 Existing verification layers

The repository uses Node unit tests, trusted example compilation/construction, pinned upstream hash checks, actual Chromium browser workflows, SDK/Windows-built binary fixtures and independent CLR comparisons. The canonical Toolchain verification and Pages workflow is the hosted delivery gate.

Common documented commands include:

```sh
npm test
npm run gate
npm run build
npm run check

python -m unittest discover -s tests/browser -p 'test_*.py' -v
```

Use the current `package.json`, scripts and canonical workflow for the exact SDK/browser setup and oracle commands. The managed-reference builder is `node scripts/build-reference-fixture.mjs`; it builds and executes repository-owned fixture code, not arbitrary uploaded applications on the host.

Earlier test totals vary by milestone. This document does not combine totals from different revisions or turn historical counts into a current result. Record exact counts/artifacts for each accepted implementation checkpoint.

### 16.2 Mandatory end-to-end acceptance scenarios

| Gate | Evidence required |
| --- | --- |
| ACC-01 — original solution | Load the complete pinned original ControlCatalog project/solution and pass CAT-01, including unchanged-source and dependency evidence. |
| ACC-02 — source application | Existing XAML/C# application compiles, starts, interacts and exports without substitute logic. Debug/release behavior agrees. |
| ACC-03 — real binary/package | Independently SDK-built Debug/Release DLL/EXE and NuGet inputs compile to JS and agree with independent CLR results, including failure paths. |
| ACC-04 — references/value semantics | Aliasing, mutation, lifetime, copying, numerical and negative-verification cases pass all required source/binary/debug modes. |
| ACC-05 — SDK state machines | Actual compiled async/iterator IL resumes/completes/fails/cancels correctly and remains debuggable across real awaits. |
| ACC-06 — source/binary debugger | Pause inside original C# or converted method, inspect mixed frames, edit a supported real local, step out and verify the changed application result. |
| ACC-07 — construction debugger | Pause/step/cancel C# and XAML construction, verify partial-tree disposal/name rollback, and successfully construct again. |
| ACC-08 — designer round-trip | Edit supported XAML and imperative C# UI, inspect source diff, compile, run, undo/redo and retain unrelated code/format/bindings. Ambiguity must be diagnosed. |
| ACC-09 — layout and structure | Real Canvas/Grid/container editing, group operations, insert/duplicate/reorder/reparent and extraction retain correct names, event/binding ownership and undo boundaries. |
| ACC-10 — hot reload | Verify identity/input/caret/field/subscription retention; inject build/construct/render failure and verify rollback; reject stale or incompatible patches explicitly. |
| ACC-11 — symbol integrity/restoration | Match DLL/PDB identity and checksums, validate source/scopes, reject mismatch/ambiguity/malformed data, require approvals and reject stale attachment. |
| ACC-12 — integrated IDE | Actual menus/palette/windows/docking/focus/workspace switching run commands against the intended session; no retired hidden-panel navigation in acceptance tests. |
| ACC-13 — release/privacy | Release application emission omits debug hooks/source maps; development export explicitly includes verified source when configured. |
| ACC-14 — backend/input/accessibility | Test actual rendering backends, input/focus/keyboard/touch/high-DPI and responsive non-occlusion in declared supported environments. |
| ACC-15 — publication | Source is reachable on `main`, exact revision passes canonical CI, artifacts identify that revision, and Pages deployment is confirmed separately. |

### 16.3 Delivery discipline

Before a feature is reported as delivered: reconcile with current `main`; preserve valid uncommitted work; commit ordinary source/tests/docs; run relevant negative and regression gates; verify hosted results; confirm deployed revision when deployment is claimed. Never force-push over concurrent source, hide a failing test by narrowing the assertion, or alter original fixtures merely to obtain a pass.

A documentation-only commit can clarify status but does not itself pass any open compatibility gate. Green CI means the implemented test suite passed at that revision, not that every requested feature has tests or is complete.

## 17. Remaining-work register and implementation order

### 17.1 Full-target register

| Workstream | Current substantiated position | Work needed before full acceptance |
| --- | --- | --- |
| Complete unchanged ControlCatalog | Selected original pages and functional example workspaces; full-catalog acceptance remains false. | Full pinned solution/dependency inventory, all missing source/XAML/API/platform semantics, all-page navigation/interaction/visual tests and reproducible export. |
| Complete C# source language/runtime | Functional common UI/library profile, development continuations, constructor work and source intelligence. | Exhaustive language/version matrix and correct binding/type/value/reference/generic/closure/async/metadata semantics. |
| Full compatible UI framework | Functional controls/property/binding/style/template/rendering profiles. | Full target control/API inventory, measure/arrange/input/accessibility/text/rendering/platform compatibility with reference behavior. |
| General imperative visual round-trip | Initializers, supported straight-line aliases/final literal writes, safe source transactions/extraction. | Path-sensitive/interprocedural ownership/escape analysis and semantics-preserving edits of all required construction patterns. |
| Complete resumable construction | Supported source constructors and shared XAML visual traversal can pause/cancel. | Remaining lazy resources/templates/markup/native callback/accessor regions, construction exceptions and cancellation acceptance. |
| Arbitrary required managed IL | Verified normal/cooperative AOT subset with real DLL/NuGet/CLR evidence. | References/value types/generics and remaining instructions/linking/framework semantics; safe verification and uniform source/binary behavior. |
| SDK async/iterator state machines | Supported source async and cooperative IL are separate working profiles. | Actual SDK state-machine metadata/IL plus builders/awaiters/tasks/values, independent CLR and debugger acceptance. |
| Managed references | Real SDK Debug/Release/package fixtures and 14-case CLR oracle committed; implementation finalization unverified in the recorded evidence. | Reconcile preserved payload, commit actual source, run nine-mode matrix plus negative/alias/lifetime/debug tests and canonical CI. |
| Symbols and restoration | Portable/embedded and managed Windows MSF7/C13 profiles; explicit approved restoration integrated. | Remaining formats/records/state-machine mappings/feeds/compression/authentication/cache policies with real fixtures and security tests. |
| Desktop IDE parity | Integrated docked workbench, commands, source/binary debugging, source-backed designer/refactoring and restoration workflows. | Full language-service/editor/project/testing/package/source-control workflow inventory and production-level performance/accessibility/reliability. |
| Product hardening | Many unit/browser/oracle regressions and verified publication checkpoints. | Complete negative/security/backend/browser matrix, quantified performance/resource budgets, upgrade/migration, lifecycle and long-running integration coverage. |

All rows above remain product requirements. “Implemented profile” does not retire the unfinished part of a workstream.

### 17.2 Recommended dependency order

This order is an implementation plan, not a change in required scope or a completion claim.

**Stage A — establish the current source and executable backlog.** Reconcile pending managed-reference work and any later commits with the verified baseline. Produce the full pinned ControlCatalog build/diagnostic inventory. Keep the integrated desktop workbench and existing tests intact. Avoid spending another round recreating already committed UI.

**Stage B — close shared semantic foundations.** Finish managed references, value/storage semantics, type binding and generic behavior required by both source and binary routes. Use independent Debug/Release/package CLR fixtures and all development modes. Extend framework primitives driven by the full catalog's actual failures.

**Stage C — support real SDK async/iterator binaries.** Implement required state-machine IL, generic/value/reference machinery and task/builder/awaiter services. Add original-source state mapping and real suspended-state debugger tests, including exceptions/cancellation. Do not substitute source-level async examples.

**Stage D — expand unchanged application/framework coverage.** Implement missing project/XAML/control/layout/style/template/input/rendering/platform behavior from the catalog inventory, promote original-page gates, then run the complete catalog as one application.

**Stage E — complete source-backed development workflows.** Use the richer type/flow model for general imperative designer editing, safe refactoring, richer completion/navigation, and full required resource/template/container editing. Extend compatible hot reload and remaining construction regions while preserving ownership/debug correctness.

**Stage F — harden and accept the complete product.** Run full-catalog, language/framework, source/binary/debug/designer/reload, symbol, accessibility, backend and performance gates. Document approved environmental differences. Publish versioned source and reproducible artifacts only after the actual end-state criteria pass.

IDE usability, individual tool windows, accessibility, tests and documentation continue throughout these stages; they are not postponed until compatibility work ends.

## 18. Definition of the fully working solution

The project meets the requested full-working-solution target only when all of the following are demonstrated together:

1. A user opens the supported existing solution/project and its required sources/resources/dependencies in Studio without rewriting the application for Jailbreak.
2. The source or real managed-binary route builds the application to JavaScript with correct required language/framework behavior and clear diagnostics for genuinely invalid input.
3. The resulting UI runs correctly in the declared browser/backend environment, including complete original ControlCatalog acceptance and its required interactions/visuals.
4. Source, XAML, generated JS and managed libraries can be debugged through the intended integrated modes with real source/IL locations, frames, values, asynchronous state and cancellation semantics.
5. The visual designer can perform the required XAML and imperative C# edits, preserve meaning/unrelated source, expose genuine constraints/errors, and support atomic undo/redo/refactoring workflows.
6. Compatible source/UI/environment updates hot-reload without unexplained state loss; incompatible changes request restart; failed updates leave a working application and no leaked ownership/subscriptions/resources.
7. Symbols/restored original source are validated, read-only where appropriate, and fetched/attached only through explicit trusted-user policies. Release artifacts do not silently disclose development source.
8. Menus, commands, docking, editor, debugger, designer, project, binary and build tools form one usable desktop-quality workflow across supported input/accessibility/layout scenarios.
9. The reusable libraries, examples, original fixtures, independent oracles, complete test reports, architecture and usage documentation are committed, reproducible, and reachable in the repository.
10. The exact accepted source passes the canonical hosted pipeline and is published as the expected browser/offline product. No required capability is represented only by a mock UI, transport blob, test fixture or unverified local checkpoint.

Until then, describe the product as a substantial implementation with explicit remaining acceptance work. Do not reset completed profiles to “not implemented,” but do not promote the entire product from selected successful examples.

## 19. Deliverables and documentation maintenance

### Required deliverables

- Reusable compiler/runtime/UI/rendering/development-tool/workbench source with documented entry points and dependencies.
- Integrated Studio and Binary Studio experiences, source/project/workspace import, generated JS inspection, and runnable browser/offline outputs.
- Owned C#/IL/DLL/PDB/NuGet examples plus preserved upstream fixtures and independent CLR/reference evidence.
- Automated positive/negative unit, browser, original-project, semantic, lifecycle, rendering, security and publication gates.
- One coherent product specification — this document — plus detailed implementation guides, capability matrices, APIs, examples, limitations and evidence in `docs`.
- A versioned completion report identifying required targets passed, remaining failures/adapters/environment differences, tested source revision, artifacts and deployment.

### Existing detailed documentation

The following guides provide deeper implementation context; their historical limitations must be read alongside later source and milestone updates, rather than copied as current facts without reconciliation:

- [Architecture](architecture.md), [roadmap](roadmap.md), and [mandatory-target status](mandatory-targets-status.md).
- [Core development-tools contract](core-development-tools.md).
- [MSIL/NuGet](milestone-msil-nuget.md), [binary entry points](binary-entrypoints.md), [exception handling](milestone-exceptions.md), and [MSIL continuations](milestone-msil-continuations.md).
- [Portable PDB](milestone-portable-pdb.md), [managed Windows PDB](milestone-native-pdb.md), and [symbol restoration](milestone-symbol-restoration.md).
- [Initial developer tools](milestone-development-tools.md), [in-IDE debugger](milestone-in-ide-debugger.md), and [resumable XAML](milestone-resumable-xaml.md).
- [Structural reload](milestone-structural-reload.md), [ownership reload](milestone-ownership-reload.md), and [binding/environment reload](milestone-binding-environment-reload.md).
- [Designer round-trip](milestone-designer-roundtrip.md), [imperative designer](milestone-imperative-designer.md), [design canvas](milestone-design-canvas.md), [Grid inspector](milestone-grid-inspector.md), and [workspace refactoring](milestone-workspace-refactoring.md).
- [Original upstream Canvas](milestone-upstream-canvas.md), [Studio integration](milestone-studio-ide.md), and [docked desktop](milestone-docked-desktop.md).

### Updating this document

For each future implementation round, update the relevant requirement/status row and evidence ledger. State the exact source/API profile added, source commit, tests and negative cases, development-tool/reload/disposal integration, remaining restrictions, and hosted publication result. Keep historical evidence immutable and distinguish superseded limitations from still-open work.

Do not update a full-target flag from prose alone. Do not count the same tests across different snapshots as one result. Do not remove a mandatory requirement because it is difficult or because a narrower demonstration works. Preserve this document as the coherent product-level reference, with implementation details and reports linked rather than duplicated into contradictory status narratives.
