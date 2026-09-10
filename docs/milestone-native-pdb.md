# Managed Windows PDB integration

<!-- jailbreak-current-documentation:begin -->
> **Historical milestone; current applicability audited 2026-09-10.** The implementation details and test totals below record this milestone, not the complete present-day product. Its old remaining/unsupported lists and UI instructions may have been superseded. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

Jailbreak accepts Windows MSF7/C13 **managed** PDBs alongside Portable PDBs. This
is a browser-native symbol reader, not a native-code debugger. The independent
Windows fixture was already retained in the repository; this milestone wires the
reader into ordinary source, DLL/NuGet conversion, Studio and offline runners.

## Libraries and validation

`packages/native-pdb/msf.js` snapshots input bytes, validates the MSF superblock,
stream directory, named-stream hash tables, size budgets and page ownership.
Reserved/shared pages and out-of-file extents are errors. Stream reads are
independent copies, including when the input is a Node Buffer.

`packages/native-pdb/index.js` decodes DBI modules, C13 managed procedure tokens,
lexical blocks, local IL slots, line/column spans and original-source checksums.
The PE reader now distinguishes Portable PDB identities from Windows GUID/age
pairs. `prepareDebugAssembly` checks identity, method extent, instruction bounds,
local slots and scope nesting before attaching its identity-protected metadata.
Both formats then share the MSIL AOT emitter and cooperative debugger.

Checksummed explicit source can use a full original path or a basename unique on
both the supplied-source and PDB-document sides. Ambiguity fails. A legacy MD5
implementation supports old Framework source checksums in opaque/offline browser
origins. **MD5, CRC and PDB identities are matching data, not authentication.**
Neither a PDB path nor a native source-server record authorizes file/network I/O.

DLL workspace records support optional `symbols: {pdb: base64, sources: {path:
text}}`. `encodeBinaryFile(name, bytes, {pdb, sources})` and `decodeBinaryRecord`
validate bounded attachments. Attached source remains read-only debugger data,
not an extra C# compilation unit. The Native Symbols sample uses this path.

## Acceptance evidence

The real `tests/fixtures/msil/native-pdb.json` was produced by Windows Framework
`csc /debug:full` and checked by the CLR's own source-symbol reader. Tests compare
method tokens, `Sum(10) == 45`, `Twice(21) == 42`, and exception line 22. They also
verify actual scoped locals, local mutation during a suspended DLL invocation,
release stripping, input immutability, malformed pages/records and checksum or
identity failures. Browser tests exercise uploads, original-source breakpoints,
offline export and the same DLL inside Studio's source application.

## Remaining native profile boundaries (at this milestone)

MSF2/C11, C++ machine-code/register locations, native Edit-and-Continue relocation,
legacy native embedded-source encodings, and arbitrary compiler-specific records
are not accepted. Native async metadata is not fabricated. Embedded **Portable**
PDB/source decompression remains a separate supported path. Full native format
coverage and SDK state-machine IL compatibility remain mandatory future gates.

## Primary format references

- https://llvm.org/docs/PDB/MsfFile.html
- https://llvm.org/docs/PDB/PdbStream.html
- https://llvm.org/docs/PDB/DbiStream.html
- https://github.com/microsoft/microsoft-pdb/blob/master/include/cvinfo.h
- https://www.rfc-editor.org/rfc/rfc1321.html
