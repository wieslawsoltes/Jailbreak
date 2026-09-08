# Execution and workspace boundaries

Project evaluation is pure source selection over user-supplied text files. It never downloads imports, inspects arbitrary host paths, invokes an SDK, restores packages, executes property functions or starts MSBuild tasks. Virtual paths reject traversal/absolute external locations; XML parsers reject DTD/external-entity declarations. Budgets limit source/import/condition/directive sizes and nesting.

The profile inspector displays workspace values through text nodes rather than HTML. Condition operands are parsed before property expansion, preventing substituted property text from becoming new operators. These measures do not constitute a complete hostile-input audit of every compiler path.

Compiler workers can be terminated when an interactive build exceeds its limit. Generated application code runs in an iframe with `sandbox="allow-scripts"`, without `allow-same-origin`. Parent message handlers check the sending window and the current per-preview channel. The preview policy restricts network use and embedded content; consult each export implementation for its exact CSP. Exported standalone applications no longer have an enclosing IDE iframe.

Only run trusted application source. A script-only iframe is an origin boundary, not a guaranteed CPU/memory denial-of-service boundary. Runtime guards and worker limits do not prove arbitrary generated code is safe. User-defined C# adapters or new renderer/browser APIs must be reviewed for capabilities they expose.

Source workspaces and profiles are stored in the user's browser and included in exported JSON. Do not place credentials in source, build properties, profiles or exported applications. GitHub Pages hosts static toolchain files and samples; no compiler backend service receives imported workspace source.
