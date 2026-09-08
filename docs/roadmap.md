# Source, binary and UI compatibility roadmap

The long-term goal is to run existing Avalonia applications in browser HTML/JavaScript with reusable compiler, UI, rendering and tooling libraries. **Full unmodified ControlCatalog remains a failing target**, not a redefinition of the selected example gate.

## One architecture, complementary inputs

C#/XAML source is the editable, diagnosable route. MSIL/DLL is the route for existing compiled managed libraries. NuGet is a package/dependency/asset-selection layer over those routes, not a separate virtual machine. Both compiler outputs use shared managed semantics and the primary runtime/type registry; WebGPU remains a renderer capability rather than a substitute for language or framework semantics.

The secondary earlier toolchain is preserved for regressions; feature expansion currently targets the primary route. Consolidation must preserve working behavior and fixtures rather than introduce more parallel implementations.

## Delivered layers

- Source compilers, selected managed adapters, native controls and worker/sandboxed IDE/export.
- Bounded project/source evaluation, imports, conditions, per-project symbols and profiles.
- Selected templates/themes, scoped parts, bindings and linked/merged XAML resources.
- MSIL decoding/verification/JS emission, real managed DLL loading, explicit local NuGet conversion, binary method runner and C#/XAML-to-binary library bridge.
- Typed exception regions, nested finally/fault, rethrow identity and checked arithmetic, with a shared source/binary exception hierarchy and 35 fresh CLR cases per conversion route.

Exact scope is in the milestone guides. A package name or schema entry is not proof of API coverage.

## Mandatory development-tool integration

Full C#/XAML/generated-JavaScript debugging, a full visual designer for C#/XAML UI and state-preserving hot reload are core requirements throughout development, not a final optional phase. Each new compiler/control/runtime capability must add source identity, debug coverage, designer editability rules and reload/disposal evidence, or document a blocking gap. [Core contract](core-development-tools.md) · [current implementation](milestone-development-tools.md).

## Expansion sequence and acceptance evidence

| Layer | Next work | Required evidence |
|---|---|---|
| Managed semantics | Exception filters/custom exceptions, generic/value types, delegates/interfaces, overloads, runtime library adapters | Positive/negative verifier tests and fresh CLR comparisons |
| Assembly/package linking | Assembly versions/load contexts, transitive package graph, exact NuGet TFM reduction, signatures/locks | Conflict/failure tests, reproducible assets, no task execution during ingestion |
| Avalonia binary route | Framework adapters, embedded resources, compiled-XAML loader patterns, reflection gaps | Unchanged upstream DLL/source behavior, not only metadata counts |
| UI | General input/list templates, routed input/layout, binding validation, collections/virtualization | Interaction, ownership/disposal, accessibility and scale gates |
| Rendering | Retained GPU drawing, text/shaping, clipping/transforms, device recovery | Physical GPU runs, rendering comparisons and measured performance |
| IDE | Full debugger transport, full C#/XAML visual design, structural/resource hot reload, unified source/binary graph, caching | Edit→compile→run correctness, stale-result rejection, offline exports |
| Full catalog | Catalog shell, remaining controls, themes/platform integration | Complete original app linked and exercised; retain `--require-full` failure until achieved |

Do not raise compatibility percentages by suppressing unsupported instructions, skipping methods without reporting them, using ref-only assemblies as implementations, or replacing original catalog pages with similar-looking demos. Track integrity, compilation, construction, interaction and visual fidelity as different gates.
