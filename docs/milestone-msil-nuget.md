# MSIL, managed DLL and NuGet conversion

## The integrated model

Jailbreak now has a second **input route**, not a replacement UI runtime. The primary C#/XAML workbench compiles source applications, Binary Studio compiles IL and managed assemblies, and source applications can explicitly link converted libraries. Both routes run native JavaScript with the existing managed-style adapters. Conversion itself does not invoke application methods.

```
C# source ───────────────→ existing C# parser / symbol resolution / JS emitter ─┐
XAML source ────────────→ existing object IR / templates / include linker ─────┤
                                                                             ├→ shared type registry / browser UI
IL text ──→ ILAsm subset parser ─┐                                             │
DLL/EXE ──→ bounded PE/CLI reader├→ typed stack + control-flow verification ────┤
.nupkg ───→ bounded ZIP / nuspec┘             → JavaScript method functions ───┘
```

The concrete source bridge is `packages/binary-project`. It first converts all supplied binary libraries, exposes their full type names to the existing C# resolver, then emits registrations before source classes and XAML. Application methods can call static library methods, construct supported binary objects, use their properties and call instance methods. `examples/BinaryLibrary` and `examples/NugetLibrary` exercise this route with the **actual SDK-built assembly**, not C# source substituted for the DLL.

## Reuse rather than duplicate semantics

`compiler-core` supplies diagnostics, source positions, escaping and managed type spelling. `dotnet-runtime` supplies integer arithmetic/overflow, division, strings, arrays, bounds checks and exceptions. The primary Avalonia runtime owns a binary-runtime instance and shares its normal type registry with converted wrappers. Existing XAML, templates, UI controls, renderer, project profiles, worker host, preview/export and source editing remain in use.

The C# syntax parser is deliberately not reused to parse bytecode: CIL is a stack machine with explicit branches and metadata tokens, not a C# syntax tree. `msil-compiler` therefore has a verifier and basic-block emitter. Each emitted method is an ordinary JavaScript function with a basic-block dispatch loop and explicit operations. **There is no runtime opcode decoder/interpreter, CLR, .NET download or decompilation back to C#.** The dispatcher still has overhead compared with structured/SSA optimization; performance parity with .NET is not claimed.

## Reusable modules

| Module | Responsibility |
|---|---|
| `managed-pe/reader.js`, `tables.js`, `signatures.js`, `index.js` | File bounds, PE32/PE32+, RVA mapping, CLI streams, ECMA table layouts, coded indices, heaps, signatures, types/methods/fields/properties and tiny/fat method bodies |
| `msil-compiler/instruction-set.js` | Explicit opcode/operand table, bounded decoding, branch-boundary checks and disassembly |
| `msil-compiler/text.js` | Token parser for the documented ILAsm subset |
| `msil-compiler/verification.js` | Stack-category propagation, stack joins, argument/local/member checks, max-stack validation and supported-instruction policy |
| `msil-compiler/emitter.js`, `index.js` | Native JS basic blocks, deterministic registration units and structured results |
| `msil-runtime/adapters.js`, `index.js`, `export.js` | Exact external-call adapters, binary objects/fields/calls/type initialization, execution budgets, wrappers and offline runner export |
| `nuget/zip.js`, `index.js` | Local package validation/decompression, manifest/asset selection, dependency checks and reuse of DLL compilation |
| `binary-project/index.js`, `workspace.js` | Source/binary linking and text-serializable imported binary records |

## Binary formats and compilation policy

The reader accepts file-backed managed PE32 and PE32+ images with one CLI assembly/module and supported metadata. It reads common table layouts with dynamic heap/simple/coded-index sizes, resolves signatures, member ownership and property accessors, and records resources/assembly references. Inspection is bounded, not a guarantee that every assembly or metadata form is readable. An EXE is treated as an assembly for method conversion; native entry points and application lifetime are not launched.

Compilation is **strict whole-assembly conversion**. Every method must be supported; unsupported methods do not become empty stubs. A compilation error suppresses the entire executable output. Native/mixed-mode/ReadyToRun images, reference-only assemblies, unoptimized pointer tables, multi-module references, generic metadata, explicit MethodImpl overrides, field-RVA data and literal-field semantics are rejected in this milestone. Custom attributes are not instantiated. Embedded resource metadata is reported but resources/compiled XAML are not automatically activated.

Verification covers evaluation-stack categories, underflow, argument/local indices, declared max-stack, valid branch boundaries, stack joins, returns and required linked calls. Unsupported opcodes and currently unreachable blocks are explicit errors. This is **not the CLR verifier or a security proof**: reference assignability, exact array element tracking, full object/value-type rules and every ECMA constraint are not implemented. Only trusted programs should be invoked, even after successful conversion.

## Executable IL subset

The implemented core covers argument/local loads and stores, primitive constants, strings/null, duplicate/pop, unchecked integer arithmetic and shifts, floating arithmetic, numeric/reference comparisons, conditional/unconditional branches, switch, supported conversions, direct/virtual calls, constructors, instance/static fields, one-dimensional arrays, return and throw. Private fields and accessors work through metadata tokens. Signed 32-bit arithmetic uses existing helpers; signed 64-bit arithmetic wraps using BigInt. Binary Studio accepts decimal strings for 64-bit invocation arguments and renders BigInt results as strings.

The callable adapter inventory is exported by `adapterInventory()`. It currently includes selected `System.Object`, `System.String`, `System.Math` and `System.Console` methods with **exact signatures**, not arbitrary methods having similar names. Binary references must resolve to a supplied assembly or that adapter inventory. Unknown executable dependencies fail conversion. Runtime assembly lookup currently uses simple names and rejects duplicate names; it is not a strong-name/version/publisher validation or CLR load-context implementation.

Unsupported areas include general generics, interfaces/explicit overrides, delegates/function pointers, boxing, byrefs/pointers, custom value types/decimal, exception-handler regions/filter/finally/rethrow, checked conversion/arithmetic opcodes, reflection, `calli`, indirect loads/stores, native platform calls, async state-machine framework dependencies and arbitrary .NET APIs. Floating-to-integer conversions outside the documented exact numeric range throw rather than silently claiming CLR out-of-range behavior. Static constructors are lazily initialized per type with cached failure; exact `beforefieldinit` scheduling parity is not claimed. Same-arity overloads must be invoked by metadata token; source-bridge overload resolution is not a complete external C# type checker.

## IL source examples

`examples-il/Arithmetic.il` and `Loops.il` are editable in Binary Studio. The text parser supports simple `.assembly`/`.module` declarations, classes, ordinary fields/methods, signatures, `.maxstack`, sequential `.locals init`, labels and supported instruction operands. It validates encoded numeric widths and short-branch displacement. Complex ILAsm directives, custom metadata declarations, modifiers and exception blocks remain unsupported. Parsing/verification diagnostics retain a source location and separate IL offset where available.

```js
import { compileIL, compileAssembly } from './packages/msil-compiler/verified.js';

const arithmetic = compileIL(`
.assembly Example {}
.class public Example.Math {
  .method public static int32 Add(int32 a, int32 b) cil managed {
    .maxstack 2
    ldarg.0
    ldarg.1
    add
    ret
  }
}`);
// Uint8Array/ArrayBuffer from a local file; parsing never invokes library code.
const library = compileAssembly(dllBytes, { path: 'Library.dll' });
if (!library.success) console.error(library.diagnostics);
else console.log(library.code, library.assemblies);
```

`compileAssemblies([{path, bytes}, ...])` links explicitly supplied managed assemblies. Results contain `success`, `code`, `diagnostics`, assembly descriptors, per-method disassembly/public signatures and statistics. `createBinaryRuntime().register(...)` is called by the emitted source. Load every registration before `link()`/`getType()`. Generated JS uses an `MS` runtime variable; it is not a self-executing standalone module unless paired with the runtime or HTML export. The HTML runner establishes that runtime automatically.

## NuGet conversion, not restore

`inspectNuget(bytes)` validates a supplied package and reports identity, authors, license metadata, dependencies, frameworks, entries, ignored asset groups and signature presence. It does not restore dependencies or execute package code.

`convertNuget(bytes, {targetFramework:'net8.0'})` selects **exactly** `lib/net8.0/*.dll` and uses the same managed assembly compiler. A single available implementation group can be selected automatically. Multiple groups require a choice. `ref/` assemblies are never substituted for implementations. Native/RID-specific assets, build tasks, analyzers, generators, tools and content files are listed but not executed/converted. Their presence produces warnings.

`convertNugetPackages([{path, bytes, targetFramework?}, ...], options)` handles an explicit local dependency set. Package IDs are checked case-insensitively; duplicate package identities fail. Selected manifest dependencies must be supplied and satisfy supported numeric version intervals. Nearest-framework reduction, prerelease/floating resolution, remote feeds, transitive downloading, lock files, authenticated restore and native package execution are **not implemented**. Supply each package's intended framework explicitly when needed.

The ZIP reader supports stored and Deflate entries through standard `DecompressionStream('deflate-raw')`. It checks bounds, sizes, CRC, duplicate/case-colliding paths, traversal, overlapping data, compression ratios and expansion limits. Encryption, symlinks, multidisk and ZIP64 are rejected. CRC detects corruption, not authenticity: package signatures are reported but not verified. Conversion grants no additional license rights; inspect and retain upstream licenses when distributing output.

## Using the workbenches

Open `/binary/` through **MSIL / DLL / NuGet** in the primary IDE toolbar. Choose the IL, loops, real DLL or real NuGet example; or open your own `.il`, managed `.dll`/`.exe` files, or local `.nupkg` set. Build, inspect disassembly/emitted JavaScript/package report, select a public method, enter JSON arguments and invoke. Instance methods accept constructor arguments and preserve the instance until recompilation. Compiler errors disable invocation/export. Export writes an offline HTML method runner. Binary Studio permits homogeneous input sets; arbitrary mixed source/binary/package project graphs are not automatically resolved there.

The existing primary source IDE imports DLL/nupkg files as `*.binary.json` records alongside its source workspace. These retain bytes through JSON save/restore and compile through `compileWorkspaceInputs`. Try **Binary Library** or **Nuget Library**, then click **Call converted DLL**: the C# handler invokes the binary calculator and a stateful binary counter. Exported UI HTML contains the converted library and runs offline. The low-level API equivalents are `compileBinaryProject(files, assemblies, options)` and `compileNugetProject(files, packages, options)`.

These imported records are explicit library inputs. Existing MSBuild `Reference`/HintPath or NuGet `PackageReference` declarations are **not automatically rewritten/resolved**. A mixed set of loose DLL and nupkg records requires an explicit library-linking workflow and currently produces a diagnostic. The source IDE retains its earlier total/per-file text limits; base64 increases input size. Binary Studio's separate default input limit is 32 MiB. The secondary workbench does not yet expose the binary route.

## CLI and examples

```sh
# Convert only; do not invoke user methods in the CLI process.
npm run compile:binary -- examples-il/Arithmetic.il --out test-results/arithmetic
npm run compile:binary -- Library.dll Dependency.dll --out test-results/library
npm run compile:binary -- Package.nupkg --tfm net8.0 --out test-results/package
```

Outputs: `.js` registrations, `.runtime.js`, `.json` manifest/diagnostics, and an offline `.html` runner. Errors write diagnostics and remove stale executable outputs. The browser site also publishes the owned example DLL/nupkg under `/binary/examples/` with source and SHA-256 provenance in `tests/fixtures/msil/fixture.json`.

## Evidence and performance boundaries

The portable positive fixture was built by the real .NET SDK from `tests/fixtures/msil-src` at commit `2121104088536c85fca332e952cdb02f15400667`, Actions run `34249361811`. Its SHA-256-checked DLL has 21 methods. The fixture manifest includes independently recorded CLR results and a reference-only negative DLL. Tests compare conversion of both the DLL and SDK-created nupkg, not a handcrafted-only PE image.

`npm run test:clr` requires the .NET 8 SDK **only for tests**. It rebuilds and packs the owned fixture, executes an independent CLR oracle, converts the fresh DLL/package and compares 12 result values. CI runs this before browser tests. Browser/runtime use of the compilers does not require dotnet. See the actual workflow for current success; a test being installed is not itself proof it passed.

Local validation covers 37 new Node tests, eight new Chromium checks, unchanged prior Node gates and 11 example compile/construction gates. Tests include malformed PE/ZIP, reference-only DLL rejection, stack/branch diagnostics, 32/64-bit arithmetic, array behavior, constructors/properties/static state, explicit virtual dispatch, budgets, dependencies, package metadata, actual file upload, source-library interoperation and offline export. The UI and emitted app are tested separately. No production-scale throughput, native-code performance, complete CLI verifier, arbitrary NuGet ecosystem compatibility or full Avalonia DLL conversion is claimed.

## Next layers in the same architecture

The follow-on work is incremental: richer reference/value-type verification, exception regions and structured control flow; generic/delegate/interface semantics and framework adapters; stronger assembly identity and overload binding; actual NuGet dependency/TFM resolution and authenticated provenance; embedded resources/compiled-XAML activation; then larger unchanged Avalonia library/catalog conversion gates. The existing source route remains essential for source generators, editing and transparent diagnostics. Each extension needs negative tests and a CLR or upstream behavioral oracle before its compatibility gate can pass.

## Specifications

- ECMA-335 CLI: https://ecma-international.org/publications-and-standards/standards/ecma-335/
- PE format: https://learn.microsoft.com/en-us/windows/win32/debug/pe-format
- NuGet framework assets: https://learn.microsoft.com/en-us/nuget/create-packages/supporting-multiple-target-frameworks
- nuspec: https://learn.microsoft.com/en-us/nuget/reference/nuspec

These describe the source formats. They do not imply implementation of every behavior in those specifications.
