# Compatibility profiles and remaining boundaries

> Audit input: [`92cfb4ddc1f3`](https://github.com/wieslawsoltes/Jailbreak/tree/92cfb4ddc1f35e1ae3fa9093d7ed04a041d75d4c); documentation reconciled 2026-09-10T11:42:51+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

## How to read support

**Implemented profile** means specific behavior has source and acceptance coverage. **Fixture ready** means an independent original/reference exists, not that conversion passes. **Full target open** retains the complete requirement. **Unsupported** must produce diagnostics rather than an empty implementation. None of these categories is equivalent to production certification.

## PROD: Product, architecture and delivery

The repository contains reusable browser compiler/runtime packages and browser workbenches. Canonical routes and actual package inventory must be taken from the audited checkout.

**Not established as complete:** The complete integrated product, unrestricted application compatibility and desktop IDE parity require end-to-end acceptance; the existence of modular packages does not establish that end state.

## PROJECT: Solution, project and dependency handling

Project evaluation, source-workspace imports and binary workspace records have implemented profiles. Exact property/item/framework handling is defined by source and regression cases, not general MSBuild equivalence.

**Not established as complete:** Full original solution/project evaluation, transitive dependencies, generated inputs, build configurations and browser platform adaptation must be demonstrated on unchanged real projects.

## CS: C# source compiler and managed semantics

The primary C# backend implements a tested language subset with shared runtime operations and development continuations. Inspect constructor/ref-out/generic changes in the current source rather than repeating obsolete milestone exclusions.

**Not established as complete:** Complete declared C# language semantics, general type-system/overload behavior and comprehensive .NET library compatibility are not established by the current isolated sample gates.

## XAML: Avalonia-compatible XAML compiler

XAML compilation, runtime construction, names, bindings, resources and templates have source-backed tested profiles. Existing shared traversal supports synchronous and cooperative construction paths.

**Not established as complete:** Full Avalonia XAML syntax/type resolution, binding and template semantics, arbitrary markup extensions and every ControlCatalog document require broader acceptance than individual pages.

## UI: UI framework, layout, rendering and platform services

The primary runtime implements controls/properties/events, HTML layout and vector rendering with optional GPU paths. SVG vector/mask rendering must not be described as GPU tessellation.

**Not established as complete:** Complete Avalonia controls, measure/arrange behavior, data virtualization, input/accessibility and platform parity remain subject to full application and visual gates.

## BINARY: MSIL, DLL/EXE and NuGet conversion

The verified binary route reads real PE/CLI data, checks IL and emits JavaScript. Debug and cooperative execution share the verifier/runtime. Managed-reference fixtures alone must not be reported as ref/out compiler implementation.

**Not established as complete:** Arbitrary SDK-generated async/iterator state machines, general generics/value types/byrefs, reflection and complete framework-call semantics remain mandatory unless exact current acceptance proves them.

## SYMBOL: Symbols, source maps and restoration

Portable and managed MSF7/C13 PDB profiles, compressed portable embedded data and opt-in symbol/Source Link restoration have implementations and dedicated tests in recent source. Verify current identity/checksum and network boundaries.

**Not established as complete:** Legacy MSF2/C11, native machine-code/register records, legacy native embedded source, native async metadata and unrestricted server/authentication/format coverage are distinct outstanding profiles.

## DEBUG: Integrated C#, XAML, JavaScript and MSIL debugging

Native-engine and genuine in-IDE cooperative debugging coexist. Source constructors/XAML construction and verified MSIL methods have continuations; tests define synchronous step-over and unsupported state-machine boundaries.

**Not established as complete:** Full source/binary async state-machine coverage, every callback/accessor/lazy-construction suspension point and complete debugger expression/transport parity are not established by present subset tests.

## DESIGN: Full visual designer and safe C#/XAML round-tripping

Source-backed XAML editing, artboards, Canvas multi-selection/layout commands, Grid tooling, component extraction and straight-line C# initializer/alias/final-write editing have implemented profiles. They must not be called unrestricted imperative analysis.

**Not established as complete:** General branch/loop/interprocedural ownership analysis, arbitrary imperative C# visual edits, all layout constraints/templates/bindings and full professional design-tool parity remain required.

## RELOAD: Transactional state-preserving hot reload

Method/literal/structural/ownership and selected binding/resource/style/template reload profiles are implemented. Preflight, rollback, revisions, cleanup and restart-required behavior are essential parts of those profiles.

**Not established as complete:** Arbitrary type-shape, active-frame/closure migration, resources/templates/imperative edits and external side-effect rollback are not automatically supported by property-store transactions.

## IDE: Professional desktop-style IDE

A modern docked desktop composition exposes actual source/binary/design/debug controllers, menus, palette, editor assistance, review transactions and symbol tools. Earlier combined-inspector and informational-sidebar screenshots are historical.

**Not established as complete:** Full Visual Studio/Rider-level editing, language services, navigation/refactoring, project/dependency tooling, accessibility and desktop integration remain a measured end-state target, not a branding/style claim.

## CATALOG: Complete unchanged upstream ControlCatalog

Pinned, source-hashed isolated upstream pages and browser host adapters are useful incremental gates. A handmade ControlCatalog sample or an isolated page is not the full unchanged upstream project.

**Not established as complete:** Compile/link/construct/run and visually/behaviorally validate the complete pinned original solution/project with its real dependencies, themes, assets and code-behind. Keep fullControlCatalogPassed false until that actual gate succeeds.

## QUALITY: Verification, security, performance and documentation maintenance

Canonical CI, real browser tests, independent CLR fixtures, source integrity and security/lifecycle tests provide evidence for tested profiles, not production certification or universal language support.

**Not established as complete:** Expand full-version conformance, upstream coverage, cross-browser/GPU/accessibility/performance evidence and adversarial testing alongside every remaining implementation target.

## Important distinctions

The supported source compiler, binary compiler and runtime are independently constrained. A DLL/PDB that parses is not necessarily executable. NuGet restoration/conversion does not imply every package target/API/build task is implemented. A source async method and an SDK async state machine are different compiler inputs. A native managed PDB does not enable native machine-code execution. Browser adapters must be explicit.

A full claim requires the pinned version/profile, exact input manifest, independent output expectations, real-browser evidence and exact passing revision. [Acceptance plan](acceptance-plan.md) and [source traceability](requirements-traceability.md) define that process.
