# Desktop composition and explicit symbol restoration

This milestone materializes the previously preserved IDE implementation rather
than discarding it and rebuilding a disconnected mockup. The source-publication
workflow and its recorded results distinguish saved source, committed source,
passing tests and a deployed site. A successful workflow submission alone is not
a deployment result.

## One IDE, independent tool windows

The old Getting Started and Compatibility Gates sidebar surfaces are removed.
Compatibility requirements remain in documentation and compiler diagnostics.
The document group owns the existing source editor and application preview.
Solution Explorer, Document Outline, Properties, Layout, Toolbox, Error List,
Output, Call Stack, Locals, Watch, Breakpoints, Tasks, Debug Console, Debug Settings,
Find Results and Symbols & Sources have individual tool-window identities.

`packages/workbench/dock-model.js` validates the serialized model. `docking.js`
composes the registered, controller-owned DOM nodes into five docking groups.
Moving a view does not clone its controls. Drag headers to dock targets or float;
drag tabs to reorder; use the title menu to dock, float, auto-hide or close.
View > Tool Windows reopens a closed view. Splitters support pointer and keyboard
resizing. Window includes code/design/debug/binary layouts and named-layout
storage. Source buffers are never stored as part of a layout. Storage failures
retain session-local preferences and produce an explicit notice.

`menus.js` implements actual pointer/keyboard menus over the same live command
registry as the command palette. Commands expose availability and shortcuts;
missing runtime operations do not produce fake success. Documentation is reachable
under Help without occupying a permanent workspace panel.

## Shared debugger, separate execution contexts

`debug-context.js` routes the common debugger windows to either the source
application or Binary Studio. Tasks, local edits and breakpoints never merge
between the two contexts. `binary-client.js` passes commands through the existing
script-only isolated binary workspace. Switching perspectives preserves the
source preview and binary input/result state. Embedded binary presentation omits
its redundant top-level header, promotional copy and nested debugger panel.

The main execution controls route Start, Continue, stepping, Restart, Stop and
Break to the active context. Source and binary frames are real runtime snapshots.
Native DevTools debugging remains a distinct source-session mode; binary workspace
cooperative stepping does not claim to remotely control DevTools.

Preview shortcut relay forwards a fixed command enumeration only, requires an
actual trusted browser keyboard gesture, and retains frame-source and per-session
channel checks. It does not relay arbitrary synthetic events or grant the
application access to the IDE origin.

## Symbols & Sources

Open Debug > Restore symbols and original sources or View > Tool Windows >
Symbols & Sources. Select a loose DLL workspace attachment, enter approved symbol
server bases and source origins, and preview the request plan. Preview is pure
metadata inspection and makes no requests. Checking consent permits Restore &
attach for that operation only. There are no automatically enabled public
servers or source hosts.

`packages/symbol-restoration` uses the existing PE, Portable PDB, managed Windows
PDB and original-source validators. Symbol-store keys follow the GUID byte order
and portable/native suffix formats used by the .NET symbol-store implementation.
A downloaded PDB must match the DLL identity, checksum when available, metadata,
instruction boundaries and scopes before original source is used. Source Link
uses exact then most-specific path mappings; every source document must pass its
recorded byte checksum. Embedded source is retained unless explicit refresh is
selected. Unsupported native source-server command scripts are not executed.

Network requests omit credentials and referrers, reject redirects and opaque
responses, enforce stream-based byte/request budgets and support cancellation and
timeouts. HTTP is available only for explicitly allowed loopback testing.
Source origins are preflighted before issuing any source downloads. Only 404
permits trying another approved symbol server; identity/checksum/authorization
failures stop the operation.

The verified result replaces the selected binary record through a preimage-checked
workspace attachment transaction. A changed library or oversized workspace rejects
the entire attachment before files change. Original sources remain debugger data,
not substitute C# compilation inputs. A rebuild exposes the read-only symbol
source documents in development modes. Release conversion does not gain debug
hooks or embedded original-source maps from restoration.

This operation is not general NuGet dependency restoration, authentication to
private symbol servers, native executable loading or a guarantee that every
restored DLL fits the compiler's instruction/framework profile.

## Verification and publication

`scripts/finalize-desktop-source.py` recovers the three immutable, previously
uploaded source-delta blobs. It verifies both the original and result hashes for
every file, preflights all stages and creates ordinary source commits. Unrecognized
concurrent source changes stop recovery. The workflow runs all unit tests, sample
construction, build and syntax checks, independent CLR comparisons and the focused
real-desktop browser suite before a non-forced push. It then invokes the canonical
Toolchain verification and Pages workflow, which still owns the complete browser
regression and deployment decision.

The focused browser file is `tests/browser/test_desktop_commit.py`. It covers
real menus, floating/redocking and auto-hide, retained view identity, layout
persistence, source debugger execution, source-backed designer edits preserving
live state, binary execution through the main toolbar, symbol download/attachment
and narrow layouts. Symbol restoration unit tests include malformed maps, wrong
identities/checksums, unapproved origins, redirects, budgets, cancellation and
actual converted-library results. Tests must not be replaced by presence-only
schema checks or skipped to mask a retired-selector migration.

A fresh workflow artifact contains the exact source commit, tree, archive and
verification logs. Consult those results and the canonical Pages run; do not
infer a deployed build from this document or an uploaded source blob.

## Mandatory targets remain separate

The complete unchanged upstream ControlCatalog, unrestricted imperative C# visual
round-tripping, SDK-generated async-state-machine IL, complete language/framework
compatibility and full desktop IDE parity remain mandatory. Existing resumable
source/XAML construction and supported managed IL continuations are not proof of
unrestricted compatibility. Native MSF2/C11, machine-code/register symbols and
legacy embedded-native-source formats remain outside the current symbol reader.
Explicit restoration advances the restoration target without changing those
remaining boundaries.

## Primary format references

- https://github.com/dotnet/symstore/blob/main/src/Microsoft.SymbolStore/KeyGenerators/PortablePDBFileKeyGenerator.cs
- https://github.com/dotnet/symstore/blob/main/src/Microsoft.SymbolStore/KeyGenerators/PDBFileKeyGenerator.cs
- https://github.com/dotnet/designs/blob/main/accepted/2020/diagnostics/source-link.md
