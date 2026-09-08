# Exception regions, checked arithmetic and source/binary recovery

This milestone extends the **existing verified MSIL pipeline** (`packages/msil-compiler/verified.js`). Binary Studio, local NuGet conversion, the source/binary bridge and exported apps use the same implementation. The preserved compact prototype is not silently replaced or presented as having these features.

## Executable scope

The managed PE reader now decodes small and fat CLI exception sections, including aligned chained sections. Clause counts, file-backed ranges, clause flags, instruction boundaries and metadata tokens are bounded and checked. A filter clause can be inspected in the metadata model, but executable conversion of filters is rejected.

The compiler implements typed `catch`, nested `finally`, `fault`, `leave`/`leave.s`, `endfinally` and `rethrow`. IL text supports block-form `.try { ... } catch [Assembly]Type { ... }`, `finally { ... }` and `fault { ... }`. Multiple catch handlers retain metadata order. A catch receives its exception on the evaluation stack; finally/fault starts with an empty stack. `leave` discards the evaluation stack. Rethrow retains the original exception object, while a new exception thrown from cleanup replaces the pending one. `fault` executes only during exceptional unwinding, not ordinary leave.

The verified subset requires well-nested, disjoint exception constructs. Illegal handler entry, mismatched stack joins, branches crossing protected boundaries and returns that bypass cleanup fail before emission. To keep this profile explicit, `endfinally` and `rethrow` require an empty stack; catch-to-associated-try `leave` transfers and labeled-range ILAsm exception syntax are not enabled. These are profile limitations, not a claim that all rejected constructs are invalid CLI. Caller-provided parsed models also receive numeric operand and contiguous-instruction checks before JavaScript emission.

Catch types currently use the supported shared framework exception hierarchy, plus `System.Object`; arbitrary user-defined exception classes and general reference assignability are not implemented. The verifier tracks evaluation-stack categories and exception regions, not full PEVerify/CLR type safety.

## Runtime and shared C# semantics

```
PE/CLI exception tables or IL blocks
        -> checked region tree + protected control-flow edges
        -> JavaScript method/basic-block emission
        -> per-invocation exception continuation frame
```

The emitted JavaScript executes the already compiled operations. No IL opcode parser runs in the application runtime. Methods without exception clauses keep their existing code path. Methods with clauses use a private continuation frame for catch selection and ordered cleanup. Nested handlers inside an active cleanup preserve the enclosing continuation. After cleanup completes, an unhandled exception is propagated outside the generated JavaScript catch, preventing a second unwind of the same region.

`packages/dotnet-runtime/exceptions.js` owns the shared exception hierarchy. `OverflowException` and `DivideByZeroException` derive from `ArithmeticException`; `ArgumentNullException` derives from `ArgumentException`. The existing C# backend registers these same constructors, so a source `catch (OverflowException)` can catch an error produced by a converted DLL. Throwing null produces `NullReferenceException`. Array indexing failures use `IndexOutOfRangeException`. Message and InnerException are available through explicit binary adapters. Exact localized exception messages, stack-trace formatting, all constructor overloads and complete exception APIs are not claimed.

The binary recursion/instruction limits throw a separate host `ExecutionLimitError`. A managed IL catch cannot swallow this termination; this abort deliberately bypasses application cleanup. This is not .NET thread-abort behavior, and it is not a general guarantee about arbitrary JavaScript or C# host code. Existing worker cancellation, isolated previews and export boundaries remain in effect.

## Checked numeric operations

Supported MSIL arithmetic opcodes are `add.ovf`, `sub.ovf`, `mul.ovf` and their `.un` forms on 32-bit and 64-bit evaluation-stack integers. Exact BigInt intermediates prevent JavaScript Number rounding from hiding overflow in large products. Results are normalized back to the signed evaluation-stack bit representation; public unsigned results retain the existing unsigned projection.

`conv.ovf.i1/u1/i2/u2/i4/u4/i8/u8`, including `.un` source interpretation, checks the destination range and throws the shared `OverflowException` when it does not fit. Floating input is truncated toward zero before bounds checking; NaN and infinities fail. `conv.ovf.i` and `conv.ovf.u` native-width conversions remain unsupported. C# **source** `checked`/`unchecked` blocks and expressions are not added by this milestone: this route compiles the checked opcodes already present in DLLs or IL source.

The reusable operations live in `packages/dotnet-runtime/checked.js`. Unchecked arithmetic keeps its existing path. This milestone does not claim an overall performance improvement; parsing, compilation, unwind correctness and GPU rendering performance are separate concerns.

## Try the examples

In **Binary Studio** (`/binary/`), select **Exceptions IL**, **Exception DLL** or **Exception NuGet**. Use JSON arguments with these methods:

| Method | Arguments | Expected result |
| --- | --- | --- |
| IL `CleanupOrder` | `[]` | `123` |
| `SafeDivide` | `[84,0]` | `-1` (caught in the DLL) |
| DLL `CatchFinally` | `[0]` | `-4`; a subsequent `Trace` call returns `12345` |
| DLL `NestedCatchInFinally` | `[0]` | `789` |
| DLL `RethrowIdentity` | `[]` | `true` |
| DLL `CheckedAdd` | `[2147483647,1]` | `OverflowException` |
| DLL `CheckedLong` | `["9007199254740993","1"]` | exact 64-bit value, without Number rounding |

The disassembly view includes decoded exception clauses. File upload uses the same compiler as built-in examples, and conversion errors disable invocation and export. Standalone binary exports retain exception handling without a network request.

In the main C#/XAML IDE, choose **ExceptionLibrary**. **Recover inside DLL** shows a handled divide-by-zero result. **Catch DLL overflow in C#** proves the source and binary paths share exception identity and runs a source `finally`. **Run nested cleanup** shows `Nested result: -4; cleanup order: 12345`. The exported HTML runs the same application.

```sh
npm run build
npm run compile:binary -- examples-il/Exceptions.il --out output/exceptions
npm run compile:binary -- site/binary/examples/Jailbreak.ExceptionExamples.dll --out output/recovery
npm run compile:binary -- site/binary/examples/Jailbreak.ExceptionExamples.1.0.0.nupkg --tfm net8.0 --out output/recovery-package
npm run test:exceptions-clr
```

Only the last command requires a .NET SDK: it builds and executes **owned test fixtures**, not user-uploaded binaries. Normal conversion and browser execution do not use a .NET runtime.

## Evidence and reproducibility

`tests/fixtures/exception-src` is an owned, dependency-free C# project with its own CLR oracle. It produces 22 methods and 35 independent cases covering normal and exceptional execution, catch hierarchy/order, null and bounds failures, cleanup ordering, nested handlers during unwind, replacement exceptions, rethrow identity, inner messages, checked 32/64-bit arithmetic and conversions. Fault handlers and malformed region layouts have separate handcrafted IL/reader tests because the C# fixture does not emit fault handlers.

`tests/fixtures/msil/exceptions.json` retains the SDK-built DLL, local NuGet package, SHA-256 values, source commit, recorded CLR results and reflection-produced exception tables. Node tests compare the reader's clauses with reflection and compare both conversion routes with the oracle. The binary payloads are also used by the interactive samples; library calls are not replaced with source reimplementations.

`scripts/verify-exceptions-clr.mjs` independently rebuilds and packs the project, reruns the CLR oracle, recompiles those fresh bytes through DLL and NuGet routes, and checks all 35 results, exception types and cleanup traces. It writes `test-results/exceptions-clr/comparison.json`. The canonical Pages workflow runs this gate in addition to the existing 12-case CLR gate, all Node tests, sample compilation/hydration, syntax checks and browser tests before deployment.

`tests/browser/test_exceptions.py` covers editable IL, real DLL upload, a NuGet example, nested unwind, shared source/binary catches and network-free exports. Current workflow results establish publication status; this document does not substitute for CI.

## Remaining big-picture work

Exception filters, custom exception subclasses, catch-to-try re-entry, generic/value types, interfaces/delegates, complete assembly identities and overload binding, compiled-XAML loading, reflection, transitive NuGet restore and arbitrary framework adapters remain separate extensions. The full unchanged ControlCatalog still does not pass. DOM interaction tests do not establish full Avalonia layout/theme fidelity or WebGPU rendering performance.

See [architecture](architecture.md), [binary entry points](binary-entrypoints.md), [the original binary milestone](milestone-msil-nuget.md) and [roadmap](roadmap.md).

## Specifications

- ECMA-335, partitions II.25.4.5-6 and III: https://ecma-international.org/publications-and-standards/standards/ecma-335/
- Microsoft Learn, OpCodes.Leave: https://learn.microsoft.com/en-us/dotnet/api/system.reflection.emit.opcodes.leave
- Microsoft Learn, OpCodes.Endfinally: https://learn.microsoft.com/en-us/dotnet/api/system.reflection.emit.opcodes.endfinally
- Microsoft Learn, checked unsigned-source conversion: https://learn.microsoft.com/en-us/dotnet/api/system.reflection.emit.opcodes.conv_ovf_u1_un
