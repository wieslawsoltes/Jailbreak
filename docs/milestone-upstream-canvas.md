# Unchanged upstream Canvas page and retained vectors

<!-- jailbreak-current-documentation:begin -->
> **Historical milestone; current applicability audited 2026-09-10.** The implementation details and test totals below record this milestone, not the complete present-day product. Its old remaining/unsupported lists and UI instructions may have been superseded. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

`examples/UpstreamCanvas/CanvasPage.xaml` and `.xaml.cs` exactly match the requested
`wieslawsoltes/Avalonia` repository at
`b709c58c6b1b8aa3b90866c7c001b7bf82b6353b`. The gate checks their Git blob hashes,
then compiles and constructs the page in release, native-debug and cooperative
constructor modes. The owned csproj isolates the page with the existing
`ContentPage` and `ScrollPage` host adapters. No drawing code replaces its XAML.
**The complete original ControlCatalog project is still not passing.**

## Runtime implementation

`vector-model.js` provides finite point/geometry data, path figures and line,
quadratic and cubic segments, linear gradients and stops. Public JS models are
available in the existing runtime API for compiled C#; XAML constructs the same
models. `svg-shapes.js` retains the existing native SVG element backend while
adding path-object emission, polylines, opacity masks, gradient paint and correct
unclipped negative-coordinate geometry. WebGPU remains the existing primitive
surface backend; these SVG shapes are not described as WebGPU tessellation.

Each SVG has one bounded definitions container. Paint updates replace its old
resources instead of accumulating gradients/masks. Opacity masks use alpha, not
black/white luminance. Literal HSV/HSVA colors normalize to RGB; HSL/HSLA uses
native CSS color syntax. Resource URLs are generated internal IDs, never source
URL strings. Native DOM attributes are set without inserting source markup.

`Canvas.Get/SetLeft/Top/Right/Bottom` and their attached properties now share the
XAML coordinate keys. Unset edges use NaN. Left/Top take precedence; otherwise
Right/Bottom apply, and absent edges resolve to zero. Number.NaN is no longer
emitted as an invalid CSS dimension that accidentally suppresses the other edge.

## Evidence and development tools

Six unit tests verify upstream hashes, all eight instantiated shapes, all three
compilation modes, typed C# attached-property calls, finite geometry, color
conversion and rejection of unsupported vector object properties. Three browser
tests verify actual path data, mask resources and representative output pixels;
repeated paint updates, edge precedence and resource cleanup; debugger/source
identity, visual inspection and offline export without network access. Vector
children retain normal source identities and construction checkpoints. Property
replacement triggers the existing invalidation path. Geometry objects/resources
with nested mutations require assignment/rebuild; no unimplemented observable
geometry tracking is claimed. Designer movement remains restricted by the
literal-Canvas rules in the canvas milestone.

## Exact scope

This implements the vector constructs used by this page plus cubic segments,
linear gradient fills/strokes and ordinary shape stretching. ArcSegment object
models, geometry combinations, dash/cap/join control APIs, unfilled subfigures,
transforms, arbitrary brush kinds and pixel parity for every geometry/stretch
combination remain separate targets. Invalid unsupported object slots report a
compile/runtime diagnostic, not an empty placeholder.

## Primary sources

- https://github.com/wieslawsoltes/Avalonia/blob/b709c58c6b1b8aa3b90866c7c001b7bf82b6353b/samples/ControlCatalog/Pages/CanvasPage.xaml
- https://github.com/wieslawsoltes/Avalonia/blob/b709c58c6b1b8aa3b90866c7c001b7bf82b6353b/src/Avalonia.Controls/Canvas.cs
- https://www.w3.org/TR/SVG2/painting.html
- https://www.w3.org/TR/SVG2/pservers.html
