# Requirements traceability

> Audit input: [`92cfb4ddc1f3`](https://github.com/wieslawsoltes/Jailbreak/tree/92cfb4ddc1f35e1ae3fa9093d7ed04a041d75d4c); documentation reconciled 2026-09-10T11:42:51+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

The evidence below is collected from files present in the audited revision. **Located source and tests establish where to inspect a feature, not that its entire requirement is complete.** The canonical workflow and independent full-scope gates determine completion. Empty cells are gaps, not implied implementations.

## PROD — Product, architecture and delivery

**Requirement IDs:** PROD-001, PROD-002, PROD-003, PROD-004, PROD-005, PROD-006, PROD-007, PROD-008.

**Observed implementation files:** [packages/avalonia-runtime/index.js](../packages/avalonia-runtime/index.js), [packages/binary-project/index.js](../packages/binary-project/index.js), [packages/build-profile/index.js](../packages/build-profile/index.js), [packages/compiler-core/index.js](../packages/compiler-core/index.js), [packages/csharp-compiler/index.js](../packages/csharp-compiler/index.js), [packages/dotnet-runtime/index.js](../packages/dotnet-runtime/index.js), [packages/il-runtime/index.js](../packages/il-runtime/index.js), [packages/language-service/index.js](../packages/language-service/index.js), [packages/managed-pe/index.js](../packages/managed-pe/index.js), [packages/msil-compiler/index.js](../packages/msil-compiler/index.js), [packages/msil-runtime/index.js](../packages/msil-runtime/index.js), [packages/native-pdb/index.js](../packages/native-pdb/index.js), [packages/nuget/index.js](../packages/nuget/index.js), [packages/portable-pdb/index.js](../packages/portable-pdb/index.js)

8 additional paths are recorded in [the machine-readable evidence](audit/evidence.json).

**Committed verification files:** [tests/browser/test_design_canvas.py](../tests/browser/test_design_canvas.py), [tests/browser/test_desktop_commit.py](../tests/browser/test_desktop_commit.py), [tests/browser/test_development.py](../tests/browser/test_development.py), [tests/browser/test_docking.py](../tests/browser/test_docking.py), [tests/browser/test_exceptions.py](../tests/browser/test_exceptions.py), [tests/browser/test_grid_tools.py](../tests/browser/test_grid_tools.py), [tests/browser/test_msil.py](../tests/browser/test_msil.py), [tests/browser/test_msil_continuations.py](../tests/browser/test_msil_continuations.py), [tests/browser/test_native_symbols.py](../tests/browser/test_native_symbols.py), [tests/browser/test_profile_inspector.py](../tests/browser/test_profile_inspector.py)

**Implemented-profile interpretation:** The repository contains reusable browser compiler/runtime packages and browser workbenches. Canonical routes and actual package inventory must be taken from the audited checkout.

**Full-scope work still required:** The complete integrated product, unrestricted application compatibility and desktop IDE parity require end-to-end acceptance; the existence of modular packages does not establish that end state.

## PROJECT — Solution, project and dependency handling

**Requirement IDs:** PROJECT-001, PROJECT-002, PROJECT-003, PROJECT-004, PROJECT-005, PROJECT-006, PROJECT-007.

**Observed implementation files:** [apps/ide/app.js](../apps/ide/app.js), [packages/binary-project/index.js](../packages/binary-project/index.js), [packages/binary-project/workspace.js](../packages/binary-project/workspace.js), [packages/nuget/index.js](../packages/nuget/index.js), [packages/nuget/zip.js](../packages/nuget/zip.js), [packages/project-system/backend.js](../packages/project-system/backend.js), [packages/project-system/index.js](../packages/project-system/index.js), [packages/project-system/preview.js](../packages/project-system/preview.js)

**Committed verification files:** [tests/browser/test_profile_inspector.py](../tests/browser/test_profile_inspector.py), [tests/browser/test_workbench_profiles.py](../tests/browser/test_workbench_profiles.py), [tests/build-profile-integration.test.js](../tests/build-profile-integration.test.js), [tests/build-profile.test.js](../tests/build-profile.test.js), [tests/project-runtime.test.js](../tests/project-runtime.test.js), [tests/workspace-journal.test.js](../tests/workspace-journal.test.js)

**Implemented-profile interpretation:** Project evaluation, source-workspace imports and binary workspace records have implemented profiles. Exact property/item/framework handling is defined by source and regression cases, not general MSBuild equivalence.

**Full-scope work still required:** Full original solution/project evaluation, transitive dependencies, generated inputs, build configurations and browser platform adaptation must be demonstrated on unchanged real projects.

## CS — C# source compiler and managed semantics

**Requirement IDs:** CS-001, CS-002, CS-003, CS-004, CS-005, CS-006, CS-007, CS-008, CS-009, CS-010, CS-011, CS-012, CS-013, CS-014.

**Observed implementation files:** [packages/compiler-core/index.js](../packages/compiler-core/index.js), [packages/compiler-core/managed-types.js](../packages/compiler-core/managed-types.js), [packages/compiler-core/xml.js](../packages/compiler-core/xml.js), [packages/csharp-compiler/backend.js](../packages/csharp-compiler/backend.js), [packages/csharp-compiler/constructor-chains.js](../packages/csharp-compiler/constructor-chains.js), [packages/csharp-compiler/index.js](../packages/csharp-compiler/index.js), [packages/csharp-compiler/lexer.js](../packages/csharp-compiler/lexer.js), [packages/csharp-compiler/parser.js](../packages/csharp-compiler/parser.js), [packages/dotnet-runtime/checked.js](../packages/dotnet-runtime/checked.js), [packages/dotnet-runtime/exceptions.js](../packages/dotnet-runtime/exceptions.js), [packages/dotnet-runtime/index.js](../packages/dotnet-runtime/index.js)

**Committed verification files:** [tests/constructor-chains.test.js](../tests/constructor-chains.test.js), [tests/cooperative-debugger.test.js](../tests/cooperative-debugger.test.js), [tests/csharp.test.js](../tests/csharp.test.js), [tests/language-service.test.js](../tests/language-service.test.js)

**Implemented-profile interpretation:** The primary C# backend implements a tested language subset with shared runtime operations and development continuations. Inspect constructor/ref-out/generic changes in the current source rather than repeating obsolete milestone exclusions.

**Full-scope work still required:** Complete declared C# language semantics, general type-system/overload behavior and comprehensive .NET library compatibility are not established by the current isolated sample gates.

## XAML — Avalonia-compatible XAML compiler

**Requirement IDs:** XAML-001, XAML-002, XAML-003, XAML-004, XAML-005, XAML-006, XAML-007, XAML-008, XAML-009, XAML-010.

**Observed implementation files:** [packages/avalonia-runtime/schema.js](../packages/avalonia-runtime/schema.js), [packages/avalonia-runtime/xaml.js](../packages/avalonia-runtime/xaml.js), [packages/compiler-core/xml.js](../packages/compiler-core/xml.js), [packages/xaml-compiler/includes.js](../packages/xaml-compiler/includes.js), [packages/xaml-compiler/index.js](../packages/xaml-compiler/index.js)

**Committed verification files:** [tests/templates-resources.test.js](../tests/templates-resources.test.js), [tests/xaml-continuations.test.js](../tests/xaml-continuations.test.js)

**Implemented-profile interpretation:** XAML compilation, runtime construction, names, bindings, resources and templates have source-backed tested profiles. Existing shared traversal supports synchronous and cooperative construction paths.

**Full-scope work still required:** Full Avalonia XAML syntax/type resolution, binding and template semantics, arbitrary markup extensions and every ControlCatalog document require broader acceptance than individual pages.

## UI — UI framework, layout, rendering and platform services

**Requirement IDs:** UI-001, UI-002, UI-003, UI-004, UI-005, UI-006, UI-007, UI-008, UI-009, UI-010.

**Observed implementation files:** [packages/avalonia-runtime/attribute-lifecycle.js](../packages/avalonia-runtime/attribute-lifecycle.js), [packages/avalonia-runtime/binding.js](../packages/avalonia-runtime/binding.js), [packages/avalonia-runtime/controls.js](../packages/avalonia-runtime/controls.js), [packages/avalonia-runtime/grid-layout.js](../packages/avalonia-runtime/grid-layout.js), [packages/avalonia-runtime/index.js](../packages/avalonia-runtime/index.js), [packages/avalonia-runtime/progress.js](../packages/avalonia-runtime/progress.js), [packages/avalonia-runtime/properties.js](../packages/avalonia-runtime/properties.js), [packages/avalonia-runtime/resources.js](../packages/avalonia-runtime/resources.js), [packages/avalonia-runtime/schema.js](../packages/avalonia-runtime/schema.js), [packages/avalonia-runtime/selectors.js](../packages/avalonia-runtime/selectors.js), [packages/avalonia-runtime/styling.js](../packages/avalonia-runtime/styling.js), [packages/avalonia-runtime/svg-shapes.js](../packages/avalonia-runtime/svg-shapes.js), [packages/avalonia-runtime/template-transaction.js](../packages/avalonia-runtime/template-transaction.js), [packages/avalonia-runtime/templates.js](../packages/avalonia-runtime/templates.js)

3 additional paths are recorded in [the machine-readable evidence](audit/evidence.json).

**Committed verification files:** [tests/browser/test_design_canvas.py](../tests/browser/test_design_canvas.py), [tests/browser/test_upstream_canvas.py](../tests/browser/test_upstream_canvas.py), [tests/grid-editor.test.js](../tests/grid-editor.test.js)

**Implemented-profile interpretation:** The primary runtime implements controls/properties/events, HTML layout and vector rendering with optional GPU paths. SVG vector/mask rendering must not be described as GPU tessellation.

**Full-scope work still required:** Complete Avalonia controls, measure/arrange behavior, data virtualization, input/accessibility and platform parity remain subject to full application and visual gates.

## BINARY — MSIL, DLL/EXE and NuGet conversion

**Requirement IDs:** BINARY-001, BINARY-002, BINARY-003, BINARY-004, BINARY-005, BINARY-006, BINARY-007, BINARY-008, BINARY-009, BINARY-010, BINARY-011, BINARY-012, BINARY-013, BINARY-014.

**Observed implementation files:** [packages/binary-project/index.js](../packages/binary-project/index.js), [packages/binary-project/workspace.js](../packages/binary-project/workspace.js), [packages/managed-pe/bytes.js](../packages/managed-pe/bytes.js), [packages/managed-pe/debug-directory.js](../packages/managed-pe/debug-directory.js), [packages/managed-pe/exception-sections.js](../packages/managed-pe/exception-sections.js), [packages/managed-pe/index.js](../packages/managed-pe/index.js), [packages/managed-pe/metadata-schema.js](../packages/managed-pe/metadata-schema.js), [packages/managed-pe/reader.js](../packages/managed-pe/reader.js), [packages/managed-pe/signatures.js](../packages/managed-pe/signatures.js), [packages/managed-pe/structured.js](../packages/managed-pe/structured.js), [packages/managed-pe/tables.js](../packages/managed-pe/tables.js), [packages/msil-compiler/continuation-sites.js](../packages/msil-compiler/continuation-sites.js), [packages/msil-compiler/debug-metadata.js](../packages/msil-compiler/debug-metadata.js), [packages/msil-compiler/debug.js](../packages/msil-compiler/debug.js)

17 additional paths are recorded in [the machine-readable evidence](audit/evidence.json).

**Committed verification files:** [scripts/verify-exceptions-clr.mjs](../scripts/verify-exceptions-clr.mjs), [scripts/verify-msil-clr.mjs](../scripts/verify-msil-clr.mjs), [tests/msil-cleanup-await.test.js](../tests/msil-cleanup-await.test.js), [tests/msil-cli.test.js](../tests/msil-cli.test.js), [tests/msil-continuations.test.js](../tests/msil-continuations.test.js), [tests/msil-exceptions.test.js](../tests/msil-exceptions.test.js), [tests/msil.test.js](../tests/msil.test.js), [tests/nuget.test.js](../tests/nuget.test.js)

**Implemented-profile interpretation:** The verified binary route reads real PE/CLI data, checks IL and emits JavaScript. Debug and cooperative execution share the verifier/runtime. Managed-reference fixtures alone must not be reported as ref/out compiler implementation.

**Full-scope work still required:** Arbitrary SDK-generated async/iterator state machines, general generics/value types/byrefs, reflection and complete framework-call semantics remain mandatory unless exact current acceptance proves them.

## SYMBOL — Symbols, source maps and restoration

**Requirement IDs:** SYMBOL-001, SYMBOL-002, SYMBOL-003, SYMBOL-004, SYMBOL-005, SYMBOL-006, SYMBOL-007, SYMBOL-008.

**Observed implementation files:** [packages/development/source-map.js](../packages/development/source-map.js), [packages/native-pdb/index.js](../packages/native-pdb/index.js), [packages/native-pdb/legacy-checksum.js](../packages/native-pdb/legacy-checksum.js), [packages/native-pdb/msf.js](../packages/native-pdb/msf.js), [packages/portable-pdb/hash.js](../packages/portable-pdb/hash.js), [packages/portable-pdb/index.js](../packages/portable-pdb/index.js), [packages/portable-pdb/symbols.js](../packages/portable-pdb/symbols.js), [packages/symbol-restoration/index.js](../packages/symbol-restoration/index.js), [packages/symbol-restoration/network.js](../packages/symbol-restoration/network.js), [packages/symbol-restoration/source-link.js](../packages/symbol-restoration/source-link.js), [packages/workbench/symbols.js](../packages/workbench/symbols.js)

**Committed verification files:** [tests/browser/test_native_symbols.py](../tests/browser/test_native_symbols.py), [tests/browser/test_symbol_restoration.py](../tests/browser/test_symbol_restoration.py), [tests/native-pdb.test.js](../tests/native-pdb.test.js), [tests/portable-pdb.test.js](../tests/portable-pdb.test.js), [tests/symbol-restoration.test.js](../tests/symbol-restoration.test.js)

**Implemented-profile interpretation:** Portable and managed MSF7/C13 PDB profiles, compressed portable embedded data and opt-in symbol/Source Link restoration have implementations and dedicated tests in recent source. Verify current identity/checksum and network boundaries.

**Full-scope work still required:** Legacy MSF2/C11, native machine-code/register records, legacy native embedded source, native async metadata and unrestricted server/authentication/format coverage are distinct outstanding profiles.

## DEBUG — Integrated C#, XAML, JavaScript and MSIL debugging

**Requirement IDs:** DEBUG-001, DEBUG-002, DEBUG-003, DEBUG-004, DEBUG-005, DEBUG-006, DEBUG-007, DEBUG-008, DEBUG-009, DEBUG-010, DEBUG-011, DEBUG-012.

**Observed implementation files:** [packages/development/binary-preview.js](../packages/development/binary-preview.js), [packages/development/construction.js](../packages/development/construction.js), [packages/development/cooperative-debugger.js](../packages/development/cooperative-debugger.js), [packages/development/runtime.js](../packages/development/runtime.js), [packages/workbench/binary-client.js](../packages/workbench/binary-client.js), [packages/workbench/debug-context.js](../packages/workbench/debug-context.js)

**Committed verification files:** [tests/browser/test_msil_continuations.py](../tests/browser/test_msil_continuations.py), [tests/browser/test_xaml_construction.py](../tests/browser/test_xaml_construction.py), [tests/cooperative-debugger.test.js](../tests/cooperative-debugger.test.js), [tests/development-reload-locations.test.js](../tests/development-reload-locations.test.js), [tests/development.test.js](../tests/development.test.js), [tests/msil-continuations.test.js](../tests/msil-continuations.test.js), [tests/xaml-continuations.test.js](../tests/xaml-continuations.test.js)

**Implemented-profile interpretation:** Native-engine and genuine in-IDE cooperative debugging coexist. Source constructors/XAML construction and verified MSIL methods have continuations; tests define synchronous step-over and unsupported state-machine boundaries.

**Full-scope work still required:** Full source/binary async state-machine coverage, every callback/accessor/lazy-construction suspension point and complete debugger expression/transport parity are not established by present subset tests.

## DESIGN — Full visual designer and safe C#/XAML round-tripping

**Requirement IDs:** DESIGN-001, DESIGN-002, DESIGN-003, DESIGN-004, DESIGN-005, DESIGN-006, DESIGN-007, DESIGN-008, DESIGN-009, DESIGN-010, DESIGN-011, DESIGN-012.

**Observed implementation files:** [packages/development/csharp-designer.js](../packages/development/csharp-designer.js), [packages/development/design-geometry.js](../packages/development/design-geometry.js), [packages/development/design-surface.js](../packages/development/design-surface.js), [packages/development/design-transactions.js](../packages/development/design-transactions.js), [packages/development/designer.js](../packages/development/designer.js), [packages/development/imperative-designer.js](../packages/development/imperative-designer.js), [packages/development/structure-runtime.js](../packages/development/structure-runtime.js), [packages/development/structure.js](../packages/development/structure.js), [packages/workbench/design-canvas.js](../packages/workbench/design-canvas.js), [packages/workbench/grid-tools.js](../packages/workbench/grid-tools.js)

**Committed verification files:** [tests/browser/test_design_canvas.py](../tests/browser/test_design_canvas.py), [tests/component-refactor.test.js](../tests/component-refactor.test.js), [tests/design-geometry.test.js](../tests/design-geometry.test.js), [tests/designer-roundtrip.test.js](../tests/designer-roundtrip.test.js), [tests/grid-editor.test.js](../tests/grid-editor.test.js), [tests/imperative-designer.test.js](../tests/imperative-designer.test.js)

**Implemented-profile interpretation:** Source-backed XAML editing, artboards, Canvas multi-selection/layout commands, Grid tooling, component extraction and straight-line C# initializer/alias/final-write editing have implemented profiles. They must not be called unrestricted imperative analysis.

**Full-scope work still required:** General branch/loop/interprocedural ownership analysis, arbitrary imperative C# visual edits, all layout constraints/templates/bindings and full professional design-tool parity remain required.

## RELOAD — Transactional state-preserving hot reload

**Requirement IDs:** RELOAD-001, RELOAD-002, RELOAD-003, RELOAD-004, RELOAD-005, RELOAD-006, RELOAD-007, RELOAD-008.

**Observed implementation files:** [packages/avalonia-runtime/xaml.js](../packages/avalonia-runtime/xaml.js), [packages/development/reload.js](../packages/development/reload.js), [packages/development/structure-runtime.js](../packages/development/structure-runtime.js), [packages/development/structure.js](../packages/development/structure.js)

**Committed verification files:** [tests/development-reload-locations.test.js](../tests/development-reload-locations.test.js), [tests/environment-reload.test.js](../tests/environment-reload.test.js), [tests/structural-reload.test.js](../tests/structural-reload.test.js), [tests/tree-ownership-reload.test.js](../tests/tree-ownership-reload.test.js)

**Implemented-profile interpretation:** Method/literal/structural/ownership and selected binding/resource/style/template reload profiles are implemented. Preflight, rollback, revisions, cleanup and restart-required behavior are essential parts of those profiles.

**Full-scope work still required:** Arbitrary type-shape, active-frame/closure migration, resources/templates/imperative edits and external side-effect rollback are not automatically supported by property-store transactions.

## IDE — Professional desktop-style IDE

**Requirement IDs:** IDE-001, IDE-002, IDE-003, IDE-004, IDE-005, IDE-006, IDE-007, IDE-008, IDE-009, IDE-010, IDE-011, IDE-012, IDE-013, IDE-014, IDE-015, IDE-016, IDE-017, IDE-018.

**Observed implementation files:** [apps/binary/app.js](../apps/binary/app.js), [apps/binary/index.html](../apps/binary/index.html), [apps/binary/style.css](../apps/binary/style.css), [apps/binary/worker.js](../apps/binary/worker.js), [apps/ide/app.js](../apps/ide/app.js), [apps/ide/desktop-documents.css](../apps/ide/desktop-documents.css), [apps/ide/desktop-floating.css](../apps/ide/desktop-floating.css), [apps/ide/desktop-menus.css](../apps/ide/desktop-menus.css), [apps/ide/desktop-responsive.css](../apps/ide/desktop-responsive.css), [apps/ide/desktop-tools.css](../apps/ide/desktop-tools.css), [apps/ide/desktop-views.css](../apps/ide/desktop-views.css), [apps/ide/desktop.css](../apps/ide/desktop.css), [apps/ide/index.html](../apps/ide/index.html), [apps/ide/language-worker.js](../apps/ide/language-worker.js)

29 additional paths are recorded in [the machine-readable evidence](audit/evidence.json).

**Committed verification files:** [tests/browser/test_desktop_commit.py](../tests/browser/test_desktop_commit.py), [tests/browser/test_studio.py](../tests/browser/test_studio.py), [tests/docking-model.test.js](../tests/docking-model.test.js), [tests/grid-editor.test.js](../tests/grid-editor.test.js), [tests/workbench.test.js](../tests/workbench.test.js)

**Implemented-profile interpretation:** A modern docked desktop composition exposes actual source/binary/design/debug controllers, menus, palette, editor assistance, review transactions and symbol tools. Earlier combined-inspector and informational-sidebar screenshots are historical.

**Full-scope work still required:** Full Visual Studio/Rider-level editing, language services, navigation/refactoring, project/dependency tooling, accessibility and desktop integration remain a measured end-state target, not a branding/style claim.

## CATALOG — Complete unchanged upstream ControlCatalog

**Requirement IDs:** CATALOG-001, CATALOG-002, CATALOG-003, CATALOG-004, CATALOG-005, CATALOG-006, CATALOG-007.

**Observed implementation files:** [examples/UpstreamCanvas/CanvasPage.xaml](../examples/UpstreamCanvas/CanvasPage.xaml), [examples/UpstreamCanvas/CanvasPage.xaml.cs](../examples/UpstreamCanvas/CanvasPage.xaml.cs), [examples/UpstreamCanvas/LICENSE.Avalonia.txt](../examples/UpstreamCanvas/LICENSE.Avalonia.txt), [examples/UpstreamCanvas/README.md](../examples/UpstreamCanvas/README.md), [examples/UpstreamCanvas/UpstreamCanvas.csproj](../examples/UpstreamCanvas/UpstreamCanvas.csproj), [examples/UpstreamCheckBox/CheckBoxPage.xaml](../examples/UpstreamCheckBox/CheckBoxPage.xaml), [examples/UpstreamCheckBox/CheckBoxPage.xaml.cs](../examples/UpstreamCheckBox/CheckBoxPage.xaml.cs), [examples/UpstreamCheckBox/LICENSE.Avalonia.txt](../examples/UpstreamCheckBox/LICENSE.Avalonia.txt), [examples/UpstreamCheckBox/PROVENANCE.md](../examples/UpstreamCheckBox/PROVENANCE.md), [examples/UpstreamProgressBar/LICENSE.Avalonia.txt](../examples/UpstreamProgressBar/LICENSE.Avalonia.txt), [examples/UpstreamProgressBar/PROVENANCE.md](../examples/UpstreamProgressBar/PROVENANCE.md), [examples/UpstreamProgressBar/ProgressBarPage.xaml](../examples/UpstreamProgressBar/ProgressBarPage.xaml), [examples/UpstreamProgressBar/ProgressBarPage.xaml.cs](../examples/UpstreamProgressBar/ProgressBarPage.xaml.cs), [scripts/gate.mjs](../scripts/gate.mjs)

1 additional paths are recorded in [the machine-readable evidence](audit/evidence.json).

**Committed verification files:** [tests/browser/test_design_canvas.py](../tests/browser/test_design_canvas.py), [tests/browser/test_upstream_canvas.py](../tests/browser/test_upstream_canvas.py), [tests/requested-upstream.test.js](../tests/requested-upstream.test.js)

**Implemented-profile interpretation:** Pinned, source-hashed isolated upstream pages and browser host adapters are useful incremental gates. A handmade ControlCatalog sample or an isolated page is not the full unchanged upstream project.

**Full-scope work still required:** Compile/link/construct/run and visually/behaviorally validate the complete pinned original solution/project with its real dependencies, themes, assets and code-behind. Keep fullControlCatalogPassed false until that actual gate succeeds.

## QUALITY — Verification, security, performance and documentation maintenance

**Requirement IDs:** QUALITY-001, QUALITY-002, QUALITY-003, QUALITY-004, QUALITY-005, QUALITY-006, QUALITY-007, QUALITY-008, QUALITY-009, QUALITY-010.

**Observed implementation files:** [.github/workflows/toolchain.yml](../.github/workflows/toolchain.yml), [packages/development/preview.js](../packages/development/preview.js), [packages/project-system/preview.js](../packages/project-system/preview.js), [packages/symbol-restoration/network.js](../packages/symbol-restoration/network.js), [scripts/check.mjs](../scripts/check.mjs), [scripts/gate.mjs](../scripts/gate.mjs)

**Committed verification files:** [scripts/verify-exceptions-clr.mjs](../scripts/verify-exceptions-clr.mjs), [scripts/verify-msil-clr.mjs](../scripts/verify-msil-clr.mjs), [tests/browser/test_design_canvas.py](../tests/browser/test_design_canvas.py), [tests/browser/test_desktop_commit.py](../tests/browser/test_desktop_commit.py), [tests/browser/test_development.py](../tests/browser/test_development.py), [tests/browser/test_docking.py](../tests/browser/test_docking.py), [tests/browser/test_exceptions.py](../tests/browser/test_exceptions.py), [tests/browser/test_grid_tools.py](../tests/browser/test_grid_tools.py), [tests/browser/test_msil.py](../tests/browser/test_msil.py), [tests/browser/test_msil_continuations.py](../tests/browser/test_msil_continuations.py)

**Implemented-profile interpretation:** Canonical CI, real browser tests, independent CLR fixtures, source integrity and security/lifecycle tests provide evidence for tested profiles, not production certification or universal language support.

**Full-scope work still required:** Expand full-version conformance, upstream coverage, cross-browser/GPU/accessibility/performance evidence and adversarial testing alongside every remaining implementation target.
