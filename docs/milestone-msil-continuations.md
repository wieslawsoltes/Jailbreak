# Cooperative MSIL debugging in Studio

The source and binary compiler now share the existing cooperative debugger. **Debug · In-IDE** can step from compiled C# into a converted DLL, inspect/edit in-scope scalar values, step through recursive and cross-assembly calls, and return to the original C# caller. This uses emitted JavaScript generators, not an IL interpreter or a synthetic execution trace.

## One verifier, one instruction implementation

`packages/msil-compiler/emitter.js` emits both the ordinary synchronous functions and optional continuation functions from the **same verified instructions and opcode implementation**. `debug: true, cooperativeDebug: true` enables the additional factory in `MS.register`; ordinary and release compilation omit that factory. Existing registered synchronous methods keep their ABI.

Arguments, locals, evaluation stack, instruction position and exception state are captured per invocation. Each instruction has a resumable checkpoint: verified PDB locations are visible source stops; intervening instructions are silent scheduling/cancellation boundaries. Calls, constructors, static fields and type initializers use continuation dispatch. Runtime adapters are explicit synchronous step-over regions. Budget state is task-local, including when two invocations interleave, while source and binary calls in the same task share their binary budget.

`packages/msil-runtime/continuations.js` reuses the runtime's member resolver, virtual dispatch, coercion and allocation rules. It never reads or decodes IL bytes. Static initialization has one owner; competing debugger tasks await it, and synchronous access to a suspended initialization fails rather than reading partially initialized static data. Cancellation and failure release waiters and cache a type-initialization failure.

## Exception and cancellation semantics

The existing exception-frame engine preserves typed catches, original rethrow identity, `leave`, nested `finally`/`fault`, and cleanup continuations across pauses. Normal execution and exceptions use the existing verified path. Explicit debugger cancellation discards the normal continuation and runs outstanding **finally** handlers, not **fault** handlers. Cancelling inside an already executing IL cleanup defers cancellation until that cleanup and its nested calls finish; its effects are not replayed. Cleanup is separately bounded so an infinite cleanup cannot lock the IDE. Fatal instruction/recursion-limit errors retain the existing runtime's fail-fast policy; they are not ordinary catchable managed exceptions.

A suspended binary call participates in the source task's unwinding, including source `finally` blocks. Hot reload remains blocked while any invocation is suspended/active. Async C# callers can await before and after these DLL calls with their existing task semantics; this does **not** add lowering for arbitrary SDK-generated async state-machine IL.

## Source provenance and inspection

Identity-checked PDBs retain original source locations, checksum-verified source text and scoped local names. Hidden sequence points do not become source breakpoints. Without symbols, the compiler generates explicitly labeled **[IL]** read-only disassembly documents with real instruction offsets and `local0`, `local1`, etc. Authored `.il` input retains its original source coordinates. Disassembly is never labeled reconstructed or verified original C#.

The Locals window also exposes `$ilOffset` and `$evaluationStack`. Supported scalar edits use the same paused-frame identity/range validation as C# locals and are applied directly to the suspended invocation. Int64, reference/array replacement, booleans represented as IL stack integers, and characters remain read-only in this milestone. The 32-bit unsigned stack representation is displayed/edited as its signed i4 bit pattern, not silently reinterpreted as an unrestricted JavaScript number.

## IDE and offline runner

In Studio, select **Pdb Library**, choose **Debug · In-IDE**, open `[symbol] Calculations.cs`, and set a breakpoint on `total += i`. Click **Call library Sum**. Call Stack shows both the DLL and C# caller; Locals permits changing `total`. Remove the breakpoint, step out, then continue. In **Binary Library**, `[IL]` documents provide the same stepping without a PDB.

Binary Studio has an **In-IDE IL debugger** compilation option and accepts DLL/EXE with adjacent PDB inputs. Its isolated runner supports break-on-entry, source/IL breakpoints, step into/over/out, cancellation, frame inspection and scalar local edits. Exported HTML retains those debugger controls and source maps offline. Release exports omit them. Preview commands still require both the parent-window identity and the current channel; application execution never moves into the IDE origin.

```js
const compiled = await compileBinaryInputs(inputs, {
  debug: true, cooperativeDebug: true
});
// Register compiled.code into your already isolated execution context first.
const co = binaryRuntime.createDebugger({ report: (event, data) => { /* UI */ } });
const task = co.run(binaryRuntime.invokeSteps(co, assemblyName, methodToken, args));
// For a paused task: co.command(task.taskId, 'into' | 'over' | 'out' | 'continue' | 'cancel').
const result = await task.promise;
```

## Command-line conversion

`npm run compile:binary -- library.dll library.pdb --cooperative --out output/debug-library` emits the same standalone debugger without executing any input methods. Use `--debug` for native-engine source maps only, or omit both flags for release output. NuGet accepts `--cooperative --tfm net8.0`, and authored `.il` files retain their original coordinates. Source/IL/debug metadata remain absent from release output. Input paths are explicit; no disk symbol probing or remote restoration is triggered.

## Acceptance evidence

`tests/msil-continuations.test.js` checks the owned DLL CLR results, all 35 exception cases for DLL and NuGet, real PDB locals/edits, recursive/cross-assembly calls, source/DLL stack transitions, nested unwind state, cancellation during cleanup, async source callers, initialization contention/failure, budget isolation, honest disassembly labeling and release stripping. CLI regression tests verify debug/release output, package conversion, failed-build output removal and that conversion never runs input methods. `tests/browser/test_msil_continuations.py` uses actual compiled code in Studio and the offline runner, including local mutation that changes application results. The fresh-SDK CLR exception workflow now compares synchronous and cooperative DLL/NuGet conversions to the independently executed CLR oracle.

## Mandatory work not completed by this milestone

The complete unmodified ControlCatalog, general imperative C# designer analysis, full language/framework semantics, native PDB reader integration/restoration, and arbitrary MSIL/SDK async state-machine compatibility remain mandatory. This continuation backend covers **the currently verified IL profile**, not unsupported instructions (byrefs, general value types/generics, reflection, native calls, etc.). Source property accessors and runtime callbacks not compiled as continuations remain synchronous step-over regions. This document must not be interpreted as a full compatibility claim.

Format/semantic references: ECMA-335 Common Language Infrastructure; Microsoft `OpCodes.Leave`, `OpCodes.Endfinally`, and the C# specification's iterator/finally rules. The implementation additionally defines explicit debugger cancellation as described above, rather than pretending it is a CLR instruction.
