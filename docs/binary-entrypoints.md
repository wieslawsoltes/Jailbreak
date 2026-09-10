# Binary compiler entrypoints and route selection

> Audit input: [`92cfb4ddc1f3`](https://github.com/wieslawsoltes/Jailbreak/tree/92cfb4ddc1f35e1ae3fa9093d7ed04a041d75d4c); documentation reconciled 2026-09-10T11:42:51+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

Use the verified MSIL pipeline for whole-assembly checking and JavaScript emission; use the debug wrapper for PDB/source preparation before that same emission. Use binary-project for C#/XAML linkage and workspace records, NuGet for package validation/asset selection, and the matching MSIL runtime for execution. Preserved compact prototypes are not a substitute for this route.

See the exact [module/export index](api-reference.md). IL text, loose managed binaries and packages have different input validation. Unsupported IL, metadata or executable dependencies stop output; a PDB reader cannot make an unsupported DLL executable.

Native-engine `debug` and cooperative-debug instrumentation are separate modes. Both must retain the ordinary supported semantics and share exception/type/lifetime rules with source callers. SDK-generated async-state-machine IL remains a separate acceptance requirement from source async support.

Verified original source is read-only debugger data; symbol-free methods expose labeled IL. Explicit symbol restoration cannot silently introduce source compilation replacements or execute package/native tasks. Standalone exports must carry the generated runtime/assets they need, with development source disclosure made explicit.
