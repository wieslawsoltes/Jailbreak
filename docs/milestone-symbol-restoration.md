# Explicit symbol and original-source restoration

Remote PDB and Source Link retrieval is now a separate, opt-in developer action.
Opening a workspace, compiling source or reading debug metadata does **not**
authorize network access. Application previews retain their existing sandbox
and network restrictions.

## Studio workflow

Open **Debug → Restore symbols and original sources**, or **View → Tool Windows
→ Symbols & Sources**. Select a DLL workspace record or open a local managed DLL.
Provide symbol-server base URLs and, separately, approved original-source
origins. **Inspect requests** only reads the local DLL and displays potential
symbol keys. It performs no network operation.

Grant the explicit download approval, then select **Restore & verify**. This
fetches a matching PDB when it is not already provided/embedded, validates it,
and retrieves missing original sources through its Source Link map. Embedded
source is reused unless **Refresh embedded source** is explicitly selected.
An optional explicit mapping supports symbol files without Source Link records;
it still requires approved origins and matching original-source checksums.

Nothing is attached merely because a download succeeded. Review the report,
then use **Attach & restart**. The candidate workspace is compiled before its
single source transaction is committed. Changed source or policy, cancellation,
failed compilation, and paused execution block attachment. The source workspace
is activated and its restart is explicit. Attached source is read-only debugger
data, not C# used to replace the downloaded DLL. Workspace JSON retains the
verified attachment for subsequent offline compilation/export. Release builds
continue to omit original source and debug hooks.

## Reusable API

`packages/symbol-restoration` contains a metadata-only planner, Source Link
resolver, bounded download session and restoration coordinator:

```js
import {planSymbolRestore, restoreSymbols} from './packages/symbol-restoration/index.js';
const input = {path: 'Library.dll', bytes: dllBytes};
const policy = {
  symbolServers: ['https://symbols.example.org/download/symbols/'],
  sourceOrigins: ['https://raw.githubusercontent.com'],
};
const plan = planSymbolRestore(input, policy); // no network
const restored = await restoreSymbols(input, {
  ...policy,
  consent: true,
  signal: abortController.signal,
  maxRequests: 64,
  maxBytes: 32 * 1024 * 1024,
  maxPdbBytes: 16 * 1024 * 1024,
  maxSourceBytes: 4 * 1024 * 1024,
  timeoutMs: 20000,
});
// restored: {path, bytes, pdb, sources, report}; caller controls attachment.
```

Optional existing `pdb` and `sources` are verified using the same path. Input
bytes are snapshotted; a failed restore does not modify them. `requireSources`
defaults to true. Explicitly setting it false returns a missing-document list,
not fabricated source. `fetch` may be injected for controlled tests or another
host while retaining policy validation.

## Identity and network rules

Symbol keys follow .NET SymbolStore's filename/GUID conventions: portable PDB
keys use the GUID's textual byte order plus `FFFFFFFF`; Windows keys use GUID
plus hexadecimal age. Each downloaded candidate re-enters `prepareDebugAssembly`
for the existing DLL identity, PDB checksum, method extent, instruction boundary,
local-slot and lexical-scope checks before any source is consumed.

Source Link exact mappings win over the longest matching wildcard prefix.
Path matching is case-insensitive; relative suffixes are encoded segment by
segment. Ambiguous case variants, invalid wildcards and relative traversal are
rejected. Every accepted original must pass its declared source checksum.
GUID/age and legacy MD5/SHA-1 document checksums are **matching information, not
publisher authentication**. Use trusted assemblies; restoration is not a
malicious-code audit, signature validation or revocation service.

HTTPS is required by default. The API's explicit `allowLocalHttp` option permits
only loopback HTTP; Studio does not turn it on. Server URLs and source origins
are approved separately. Credentials are omitted; requests use CORS, no referrer,
no store and redirect rejection. A changed final response URL, opaque response,
authentication error, timeout, byte/request overrun or cancellation fails the
operation. Only HTTP 404 advances to another configured symbol server. All
source origins are preflighted before the first original-source request.

Defaults are 64 requests, 32 MiB downloaded bytes, 16 MiB/PDB, 4 MiB/source and
20 seconds for the operation. Network streaming is bounded independently of
Content-Length. No native source-server command, disk path, NuGet task or PDB
payload is executed. Approval is not serialized into a workspace or export;
changing a policy/selection revokes it.

## Evidence and remaining boundaries

Unit tests use the existing SDK-generated Portable PDB's **real Source Link
record**, the independent Windows PDB fixture, and actual IL execution. Browser
tests intercept controlled HTTPS responses carrying those exact bytes, verify
approval and source checksums, attach them through the actual IDE and execute a
C# caller returning 45. Negative cases leave the running app and input intact.
This is not evidence of availability/CORS support for arbitrary public servers.

Authenticated symbol feeds, compressed symbol-store CAB files, server redirects,
arbitrary native source-server formats and automatic remote NuGet restore remain
unsupported. Embedded Portable PDB/source handling and local NuGet symbols keep
their existing paths. SDK-generated async-state-machine compilation, unrestricted
C# designer analysis, full framework compatibility and unchanged ControlCatalog
execution remain separate mandatory targets.

## Primary format references

- https://github.com/dotnet/designs/blob/main/accepted/2020/diagnostics/source-link.md
- https://github.com/dotnet/symstore/blob/main/src/Microsoft.SymbolStore/KeyGenerators/PortablePDBFileKeyGenerator.cs
- https://github.com/dotnet/symstore/blob/main/src/Microsoft.SymbolStore/KeyGenerators/PDBFileKeyGenerator.cs
- https://github.com/dotnet/symstore/blob/main/src/Microsoft.SymbolStore/KeyGenerators/KeyGenerator.cs
