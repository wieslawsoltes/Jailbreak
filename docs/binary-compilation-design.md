# Binary compilation in Jailbreak

The source and binary routes are complementary:

```
C# source -> C# syntax/semantic frontend -> JavaScript
XAML source -> XAML IR -> JavaScript definitions
DLL/EXE -> PE/CLI metadata -> decoded CIL -> verified control-flow graph -> JavaScript
.nupkg -> bounded ZIP reader -> explicit lib/<tfm> selection -> DLL route
```

The new binary path must reuse the existing `compiler-core` diagnostics/JavaScript serialization and `dotnet-runtime` integer, string, array and exception adapters. C# syntax trees are not a suitable representation for an IL evaluation stack. The binary frontend therefore has its own verifier and basic-block emitter while sharing runtime semantics, type registration and browser execution boundaries.

## Delivery contracts

A managed assembly is read as bytes, never loaded into the operating system. Compilation is separate from invocation. Emitted methods contain JavaScript operations and basic-block branches; runtime execution does not decode opcodes. Unsupported instructions, unresolved executable references, malformed metadata, incompatible stack joins and native methods must stop conversion rather than become successful-looking empty stubs.

NuGet conversion is not NuGet restore: package tasks, installation scripts, native libraries and source generators must never be executed. `ref/` assemblies must not be mistaken for executable implementations. Package identity, dependencies, target framework, selected files and license metadata must remain visible in the conversion report. Only explicit local package inputs are in scope initially; transitive framework selection and version resolution need separate implementations.

## Testing strategy

The repository's owned `tests/fixtures/msil-src` project is built with the real .NET SDK. Its DLL and nupkg, plus CLR reference results, are the positive binary gates. Tests compare JavaScript output with the CLR oracle for arithmetic, overflow, loops, recursion, arrays, calls, instance properties and static initialization. Additional negative tests cover corrupt PE/ZIP data, unsupported IL and missing dependencies. Browser tests must load bytes through the workbench and execute converted methods inside its isolated preview.

The existing source compiler, template and ControlCatalog gates remain required. Binary conversion does not automatically make arbitrary Avalonia DLLs compatible: compiled XAML loaders, generic framework code, reflection, value-type semantics, exception filters and native APIs need their own verified implementations. The [exception milestone](milestone-exceptions.md) implements a bounded exception-region and checked-arithmetic subset in the verified route. The full ControlCatalog target remains separate.

## Source specifications

- ECMA-335, Common Language Infrastructure, partitions II and III: https://ecma-international.org/publications-and-standards/standards/ecma-335/
- PE image structure: https://learn.microsoft.com/en-us/windows/win32/debug/pe-format
- NuGet framework assets: https://learn.microsoft.com/en-us/nuget/create-packages/supporting-multiple-target-frameworks
- NuGet manifest: https://learn.microsoft.com/en-us/nuget/reference/nuspec

This document records the architectural contract. The milestone guide and current test results identify implemented behavior; this design is not a claim of complete CLI, CLR or NuGet compatibility.
