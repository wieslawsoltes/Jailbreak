# Security, trust and execution boundaries

> Audit input: [`92cfb4ddc1f3`](https://github.com/wieslawsoltes/Jailbreak/tree/92cfb4ddc1f35e1ae3fa9093d7ed04a041d75d4c); documentation reconciled 2026-09-10T11:42:51+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

## Imported code and browser isolation

Application source, IL, managed binaries and package contents are untrusted inputs. They must not run in the IDE origin. The runtime preview uses its explicit sandbox, CSP and message validation code; an opaque origin alone does **not** block network access. Verify the actual policy and sender-window/per-session-channel checks when changing previews or keyboard/command relays. This documentation is not a complete adversarial-security audit or production certification.

## Symbols and source restoration

Parsing a PDB, CodeView path, Source Link map or source-server record never grants filesystem/network permission. The restoration path requires consent, approved symbol endpoints and separately approved source origins, credentials omitted, no redirect-following, streaming size/request/timeout budgets and cancellation. Browser CORS/authentication/server behavior may still make an approved endpoint unavailable. Do not execute native source-server scripts or arbitrary package/build tasks.

PDB identities, CRC and legacy MD5 document checksums match data; they do not authenticate a publisher or establish that code is safe to execute. Validate the DLL/PDB pair, metadata/method/local ranges and exact original-source byte checksum before exposing source. Attach only if the selected workspace DLL record remains unchanged.

## Source disclosure and release output

Development source maps, PDB embedded sources, symbol attachments, saved workspaces and debug exports can contain original code. Release compilation must omit emitted debug hooks/continuations and original-source maps according to its profile. That claim is separate from whether dormant development helper modules remain in the runtime bundle. Never describe all bundle tooling bytes as stripped without checking the actual artifact.

## Data mutation and cancellation

Designer/refactor operations use preimages and bounded transactions. Hot reload owns a limited set of property stores, method descriptors, names, children and subscriptions; it cannot magically reverse arbitrary external side effects of user callbacks. Construction cancellation must dispose partial trees and unwind generators. Debugger cancellation must preserve finally/fault/type-initialization semantics for the supported profile without corrupting competing tasks.

## User work and repository publication

Do not overwrite dirty local work or newer remote source when recovering a stage. A saved blob or patch is evidence to reconcile, not proof it belongs on the current branch. Use ordinary commits, explicit source checks and non-forced publication. Never print credentials, upload runtime font files or execute imported binary code merely to inspect it.

## Verification still required

Keep malformed-input, memory/expansion, path traversal, message-origin, source-checksum, archive, cancellation, session isolation and release-disclosure tests in the canonical pipeline. A bounded reader or a passing happy-path test is not unrestricted hostile-input safety.
