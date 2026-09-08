# Compatibility contract

**The full unmodified Avalonia ControlCatalog is not passing.** Successful compilation or a schema entry does not mean complete framework, API, layout or pixel compatibility.

The user-requested baseline is `wieslawsoltes/Avalonia` at `b709c58c6b1b8aa3b90866c7c001b7bf82b6353b`. Its original CheckBoxPage and RadioButtonPage XAML/code-behind live in `browser/fixtures/control-catalog`, with exact blob hashes and the MIT license. Tests compile those sources through both pipelines; secondary Chromium tests assert states, disabled input, three-state cycling and radio groups. The explicit ContentPage and ScrollPage host adapters are not a full theme port.

A separate official `AvaloniaUI/Avalonia` baseline at `27c1ece36cbe17de3b8f95ae88223ba68702ae47` remains in the root fixture gate. Earlier README text accidentally named `Avalonialibrary`; that is not the repository the user requested and is not a blocker for these fixtures.

## This milestone

Project properties/imports, common conditions, conditioned source items, dependency profiles and C# preprocessing now work in a bounded shared subset. Debug/Release and selected target frameworks are configurable in both IDEs. Exact supported behavior is in [milestone-build-profiles.md](milestone-build-profiles.md).

## Remaining major work

Full SDK/MSBuild task/property-function behavior, NuGet/source generators, assembly boundaries, full C# type/overload/generic/value-type semantics and .NET library coverage remain incomplete. General Avalonia templates/themes, advanced bindings/styles, complete layout and routed-event semantics, platform services and visual parity remain incomplete. Existing notifying auto-properties and numeric/runtime adapters have documented subset differences; JavaScript is not automatically semantically identical to C#.

WebGPU source exists for primitive drawing, with explicit Canvas2D fallback. A browser test using the fallback is not GPU performance or physical-device validation. Most controls are native HTML, not GPU-rendered Avalonia controls.

`npm run gate -- --require-full` intentionally returns a failure while the full catalog target remains unmet. New gates must preserve this distinction rather than reinterpret selected pages as complete coverage.

## MSIL / DLL / NuGet scope

The primary route now converts a bounded ILAsm/CIL subset and genuine managed implementation DLLs, including ordinary calls, object state, properties, arrays and static initialization. Existing C#/XAML can explicitly link those libraries. Local NuGet conversion selects exact implementation asset groups and validates supplied dependencies; general restore, nearest-framework/version resolution and package signature verification remain incomplete.

This does not imply arbitrary Avalonia framework DLL execution. Generic/exception-region/value-type/reflection/platform semantics and compiled-XAML/resource-loader integration remain major gaps. The verifier is not a CLR security verifier. Whole-assembly errors suppress output; ref-only/native images are not successful executable substitutes. The secondary toolchain is unchanged. Full details: [binary milestone](milestone-msil-nuget.md).
