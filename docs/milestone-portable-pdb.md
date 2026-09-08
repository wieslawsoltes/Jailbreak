# Portable PDB source debugging

Jailbreak's converted-DLL path now has a reusable Portable PDB reader, source integrity verification, optional emitted sequence hooks, scoped-local capture and shared Source Map v3 composition. Binary Studio accepts matching DLL/PDB/source inputs and symbol-bearing NuGet packages. The primary IDE separates verified binary source into read-only symbol tabs rather than compiling it a second time as source.

This extends the existing MSIL compiler and managed runtime. It is not a CLR, an IL interpreter, or a claim of complete .NET compatibility. The [mandatory development-tools contract](core-development-tools.md) applies to this path as it does to C#/XAML compilation.

## Workbench usage

In Binary Studio, choose **Portable PDB library** or **NuGet with symbols** and enable **Source debug**. The source selector shows available document locations; the original-source view contains text only when its checksum matched. The breakpoint line and native-break option configure the sandboxed runner. Snapshot reporting works without pausing; browser DevTools supplies real native pause, stepping and native call frames for converted DLL JavaScript.

In the primary IDE, choose **Pdb Library**, open **Develop**, and enable the debugger/designer option. Verified library documents appear as read-only **[symbol]** entries. Set a source-line breakpoint in Probe.Sum and invoke **Run DLL sum**. The example calls an actual SDK-built managed library converted by the MSIL compiler. Its NuGet package includes the matching symbols and original source. No handwritten substitute implements the library methods.

`scripts/generate-pdb-example.mjs` derives `examples/PdbLibrary/library.binary.json` from the checked fixture package only after conversion verifies that source symbols are present. This keeps the runnable example tied to the actual DLL/PDB pair. `scripts/build-pdb-fixture.mjs` rebuilds the SDK fixture and independent .NET metadata oracle.

The upload picker accepts `.dll`, `.pdb` and `.cs` files together. Package-local implementation DLL/PDB pairs and supplied package source are supported. Symbol servers, automatic package restore, remote Source Link and host filesystem reads inferred from PDB paths are not performed.

## Reusable APIs and responsibilities

`packages/portable-pdb/reader.js` reads bounded metadata containers and Portable PDB table streams. `symbols.js` decodes documents, sequence points, lexical scopes and local-variable slots. `hash.js` provides SHA-1/SHA-256 without depending on a secure browser context. `index.js` verifies DLL/PDB identity, attaches symbols to decoded methods and verifies supplied source bytes.

`packages/binary-project` pairs input symbols with assemblies, discovers package-local symbols and keeps verified source documents separate from compilation inputs. `packages/msil-compiler` emits development hooks into the compiled JavaScript only when requested. `packages/msil-runtime` forwards breakpoint events into the existing developer session. `packages/development/source-map.js` composes namespaced binary markers with C# source markers after wrapper/linker composition.

```js
import { compileBinaryProject } from './packages/binary-project/index.js';

const build = await compileBinaryProject([
  { name: 'Probe.dll', bytes: dllBytes },
  { name: 'Probe.pdb', bytes: pdbBytes },
  { name: 'Probe.cs', text: originalSource }
], { debug: true });

if (!build.success) {
  console.error(build.diagnostics);
} else {
  console.log(build.debug.sites);
  console.log(build.debug.sources); // Verified original text only.
}
```

CLI development conversion accepts `--pdb`, repeatable `--source`, and `--debug`. The `--source` values are explicit local paths supplied to the CLI, not paths implicitly read from symbol metadata. Release conversion omits source hooks and original-source maps. A PDB without all original documents can still provide locations, but unavailable source text must remain visibly unavailable.

## Integrity and isolation

A PDB is checked against the DLL's PE CodeView identity. A same-named but unrelated symbol file is an error. Method row counts, sequence-point instruction boundaries, local slots and scope bounds are validated before symbol hooks are emitted. Hidden sequence points do not create user breakpoint sites; hidden compiler-generated locals are not presented as ordinary user locals.

Supplied source must match its PDB document's SHA-1/SHA-256 bytes before it is exposed as original source. File-name matching never bypasses checksum verification. Source paths are labels for symbol lookup and display, not authority to read files outside the explicitly supplied workspace.

Checksums establish consistency, not code safety or publisher authenticity. Run trusted applications. The preview remains script-only and opaque-origin; package build tasks and native binaries are not executed on the host. Development exports intentionally disclose original source. Disable development mode and rebuild before release distribution.

## Relationship to the other boundary extensions

The round also extends [content-host and retained-control ownership reload](milestone-ownership-reload.md), [binding/resource/style/template reload](milestone-binding-environment-reload.md), [source-preserving designer round-tripping](milestone-designer-roundtrip.md), and [in-IDE C# continuation stepping](milestone-in-ide-debugger.md). Those guides specify their supported edit/control-flow subsets and rollback behavior.

C# continuation stepping is not automatically MSIL continuation stepping. Converted binaries currently use native browser debugging plus source-linked snapshots and locals. XAML construction breakpoints and visual-source inspection are not resumable XAML construction. No guide should label the full original ControlCatalog as passing merely because the developer examples or selected original pages pass.

## Verification

The SDK fixture includes an independent .NET metadata reader; its metadata/output evidence is separate from Jailbreak's parser. The existing compiler, runtime, designer, native-debugger, continuation, source/binary and browser suites remain gates. `tests/portable-pdb-delivery.test.js` adds symbol/source integrity, malformed input, hidden-point, release stripping, NuGet, combined-map and static-method-name regressions.

```sh
node scripts/build-pdb-fixture.mjs # Requires .NET 8 SDK.
node scripts/generate-pdb-example.mjs
npm test
npm run gate
npm run build
npm run check
python -m unittest discover -s tests/browser -p 'test_*.py' -v
```

CI results belong to the exact tested commit; staging a patch or adding a parser module alone is not proof of successful integration or deployment.

## Remaining limits

Windows/native PDB, compressed embedded Portable PDB, embedded-source decompression, remote Source Link, symbol-package restore, general async state-machine reconstruction, portable local constants/import-expression evaluation, byref/value-type local reconstruction and cross-MSIL continuation stepping remain additional work. Reading metadata rows needed to size a table is not execution support for the corresponding .NET feature.

General imperative C# visual round-tripping, unrestricted transactional UI/environment reload, resumable XAML construction, full language/framework coverage and the complete unmodified ControlCatalog remain mandatory acceptance targets. Unsupported IL continues to fail compilation instead of producing executable stubs.

## References

- .NET Portable PDB specification: https://github.com/dotnet/runtime/blob/main/docs/design/specs/PortablePdb-Metadata.md
- .NET PE debug-directory conventions: https://github.com/dotnet/runtime/blob/main/docs/design/specs/PE-COFF.md
- Source Map specification: https://tc39.es/ecma426/
