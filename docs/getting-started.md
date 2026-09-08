# Getting started

Open the [deployed primary IDE](https://wieslawsoltes.github.io/Jailbreak/) or build locally with Node.js 22+:

```sh
npm test
npm run gate
npm run build
npm run check
python3 -m http.server --directory site 8080
```

Visit `http://localhost:8080/`. The primary `site/index.html` embeds its compiler worker, runtime, samples and styles, so it can also be opened offline. The module version is `index.module.html`. The secondary IDE is `browser/ide/` and should be served over HTTP.

Choose **Build Profiles**, then **Build profile**. Debug adds one per click; Release adds ten. The inspector shows the source-selection graph, imports, properties, symbols and selected files. Choose the library in its project selector to inspect its independent framework and constants.

To load an existing application, select the containing folder, including `.sln`/`.slnx`, `.csproj`, imported `.props`/`.targets`, C# and XAML files. Browser file selection only provides the files you choose; missing imports are reported. Single-file selection may flatten paths, so folder import is preferred for solutions. Source is compiled locally in a worker. Only the supported subset executes.

Use Ctrl/Command+Enter to build. Save a JSON workspace to preserve all text files and the build profile. Export app writes a standalone HTML application from the last successful, current build. Errors suppress executable output. Open the generated JavaScript or diagnostics to inspect unsupported constructs rather than assuming all .NET/Avalonia dependencies have been loaded.

The two workbenches retain distinct frontend/runtime implementations; the build-profile layer is shared. The [milestone guide](milestone-build-profiles.md) describes their API/result differences.

## Binary Studio and compiled libraries

Open [Binary Studio](https://wieslawsoltes.github.io/Jailbreak/binary/) or the primary toolbar's **MSIL / DLL / NuGet** link. Use the IL/loop/DLL/NuGet examples or load local inputs, compile, select a public method and invoke with JSON arguments. Instance methods accept constructor arguments and retain the instance until rebuild. Export writes an offline method-runner HTML.

In the main source IDE, select **Binary Library** or **Nuget Library**. The C# code-behind calls the real converted library. You may import a managed DLL/nupkg alongside supported source files; the workspace preserves binary bytes as `.binary.json` text records. Do not assume existing HintPath or PackageReference declarations restore/map automatically. See [binary examples and exact API scope](milestone-msil-nuget.md).

For command-line conversion: `npm run compile:binary -- path/to/Library.dll --out test-results/library`. Add `--tfm net8.0` for a package with multiple implementation groups. The CLI emits diagnostics, JavaScript/runtime, and HTML without invoking user methods.
