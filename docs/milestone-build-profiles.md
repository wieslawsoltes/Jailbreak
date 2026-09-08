# Build profiles milestone

The next compatibility milestone adds one shared, browser-safe build-profile package used by both workbenches. The existing compiler backends are retained byte-for-byte in `backend.js`; public frontends perform source-preserving conditional compilation before parsing/emission.

## Conditional compilation

Supported: file-local `#define`/`#undef`, nested `#if`/`#elif`/`#else`/`#endif`, Boolean symbol expressions (`!`, `&&`, `||`, `==`, `!=`, parentheses), active `#error`/`#warning`, regions and nullable-context metadata. Multiline comments, verbatim strings and raw string text are protected from directive recognition. Removed source becomes spaces; original UTF-16 offsets and CR/LF are retained.

Pass `symbols` to either `compileCSharp` frontend, or attach `symbols` to individual input files. No symbols are implicitly inferred from the JavaScript host. Symbols are copied and never leak between files.

`#line` numeric/file remapping is an explicit diagnostic. Nullable metadata does not add nullable-flow analysis. `#pragma warning` suppression does not suppress Jailbreak diagnostics. Active C# syntax still needs support from the selected backend.

Validation: `node --test tests/preprocessor*.test.js`. The lexical/preprocessor tests were run locally; repository-wide and frontend integration results are supplied by the Actions workflow.

## References

- https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/preprocessor-directives
- https://learn.microsoft.com/en-us/visualstudio/msbuild/msbuild-conditions
- https://learn.microsoft.com/en-us/visualstudio/msbuild/build-process-overview

Project evaluation, workbench profile controls, and end-to-end profile gates are added in subsequent commits in this milestone.
