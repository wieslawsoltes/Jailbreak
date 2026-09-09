# Unmodified upstream Canvas page

The XAML and C# here are byte-identical to `samples/ControlCatalog/Pages/CanvasPage`
in `wieslawsoltes/Avalonia` at `b709c58c6b1b8aa3b90866c7c001b7bf82b6353b`.
The owned csproj is an isolated browser gate, not the full original project.
`ContentPage` and `ScrollPage` use the existing documented browser host adapters.
The page has no replacement drawing code: its paths, gradient mask, colors and
polylines are constructed from the original XAML by the shared runtime.

Select **Upstream Canvas** in Studio. The source remains editable as in other
samples, but gate integrity always checks the untouched repository fixture.
Full unmodified ControlCatalog remains mandatory and not passing.
