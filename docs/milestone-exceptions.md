# Exception regions and checked arithmetic

This round extends the tested structured MSIL pipeline (`msil-compiler/verified.js`), not the preserved compact prototype. The existing source, binary, NuGet, UI and browser gates remain required.

The intended acceptance boundary is small/fat CLI exception tables, typed catches, nested finally/fault unwinding, leave, rethrow identity, checked 32/64-bit arithmetic and checked numeric conversions. Exception filters, arbitrary value types and native methods remain explicit failures. A method with unsupported exception semantics must not emit executable code.

The owned `tests/fixtures/exception-src` project is independently built by the .NET SDK. New functionality is accepted only after its JavaScript behavior and cleanup ordering match a fresh CLR oracle, including failure paths. The fixture-build commit precedes implementation; this document is not itself a passing compatibility claim.

Architecture: metadata reader -> verified region tree and control-flow edges -> ahead-of-time JavaScript blocks -> per-invocation exception continuations. The runtime does not decode IL. The exception object hierarchy and arithmetic errors should be shared with the C# runtime so typed catches do not depend on error message matching.

References: ECMA-335 partitions II.25.4.5-6 and III (`leave`, `endfinally`, `rethrow`); Microsoft Learn System.Reflection.Emit.OpCodes documentation. Full unmodified ControlCatalog remains an unfinished target.
