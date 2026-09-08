# Build profiles

This editable solution demonstrates `Directory.Build.props`, nested imports, per-project framework and conditional symbols, conditional source selection, and actual C# `#if` behavior.

Load the containing folder or select **Build Profiles** in the primary workbench. Open **Build profile**, select Debug or Release and choose **Apply & build**. The same button adds one in Debug and ten in Release. The library keeps its own `netstandard2.0` symbols while the app targets `net8.0`.

The inspector shows both evaluated projects. `Native.cs` is always excluded, and `DebugOnly.cs` is excluded in Release. No .NET SDK, NuGet binary or MSBuild task is executed.
