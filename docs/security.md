# Execution and workspace boundaries

Project evaluation is pure source selection over user-supplied text files. It never downloads imports, inspects arbitrary host paths, invokes an SDK, restores packages, executes property functions or starts MSBuild tasks. Virtual paths reject traversal/absolute external locations; XML parsers reject DTD/external-entity declarations. Budgets limit source/import/condition/directive sizes and nesting.

The profile inspector displays workspace values through text nodes rather than HTML. Condition operands are parsed before property expansion, preventing substituted property text from becoming new operators. These measures do not constitute a complete hostile-input audit of every compiler path.

Compiler workers can be terminated when an interactive build exceeds its limit. Generated application code runs in an iframe with `sandbox="allow-scripts"`, without `allow-same-origin`. Parent message handlers check the sending window and the current per-preview channel. The preview policy restricts network use and embedded content; consult each export implementation for its exact CSP. Exported standalone applications no longer have an enclosing IDE iframe.

Only run trusted application source. A script-only iframe is an origin boundary, not a guaranteed CPU/memory denial-of-service boundary. Runtime guards and worker limits do not prove arbitrary generated code is safe. User-defined C# adapters or new renderer/browser APIs must be reviewed for capabilities they expose.

Source workspaces and profiles are stored in the user's browser and included in exported JSON. Do not place credentials in source, build properties, profiles or exported applications. GitHub Pages hosts static toolchain files and samples; no compiler backend service receives imported workspace source.

## Binary and package ingestion

Managed DLL/EXE files are parsed as bounded byte buffers; they are not loaded into the host OS. NuGet input is a bounded ZIP/nuspec conversion route without disk extraction or installation/build-script execution. The parser validates file ranges, archive expansion limits and CRC. It rejects unsupported/ref-only/native input rather than invoking a platform loader. No package download, secret lookup or remote dependency restore is implicit.

These are input checks, not a complete hostile-code proof. CIL reference verification is coarse, and successful compilation is not equivalent to CLR verification. The emitted code has instruction/recursion/allocation budgets and executes in a script-only opaque-origin iframe; origin isolation and budgets are not guaranteed denial-of-service protection. Only invoke trusted input. Direct JavaScript API users supply their own execution isolation.

Package signatures and strong names are not authenticity-validated. Package license metadata is reported but conversion grants no license rights. Binary bytes persist in source workspace JSON as base64 and are included in exports; treat libraries as distributed content, not private assets. CLI conversion does not invoke application methods. The CLR comparison script explicitly executes only the owned version-controlled fixture.
