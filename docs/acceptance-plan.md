# Final acceptance plan and required evidence

> Audit input: [`9b73d1167983`](https://github.com/wieslawsoltes/Jailbreak/tree/9b73d1167983076687cf078a3992144e4a18794a); documentation reconciled 2026-09-10T11:23:03+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

## Gate definitions

| Gate | Required inputs | Required result/artifact | Failure must not be hidden by |
| --- | --- | --- | --- |
| Full source/project | Versioned original solutions/projects, all source/resources/dependencies | Evaluated input manifest and successful diagnostics-free supported compilation/link report | Excluded failing files, substituted projects, stubbed APIs |
| Managed semantics | Independently built source/Debug DLL/Release DLL/NuGet fixtures and CLR oracle | Values, errors, state and cleanup agree in every claimed release/native/cooperative mode | Fixture generation alone or source rewriting |
| Full unchanged ControlCatalog | Entire pinned requested upstream application | All required page construction/navigation/interaction/rendering and source hashes | A curated catalog, isolated page or host adapter alone |
| Designer | Real source-created/XAML-created runtime tree and original source | Correct edit target, minimal source diff, reference/name/ownership integrity and atomic undo | Editing a screenshot, guessed aliases or protected bindings |
| Debugger | Actual source/IL/PDB locations and suspended compiled invocations | Pause/step/cancel, actual frame/local mutation and correct resumed behavior | Synthetic pause notifications, invented source or unrelated native traces |
| Hot reload | Working stateful app and supported/incompatible/invalid edits | Compatible identity/state retained; incompatible/failed edit rejected or rolled back | Reconstructing everything without disclosure or partial state mutation |
| Rendering/platform | Versioned browser/backend/layout/input reference profile | Pixel/interaction/accessibility/performance/lifecycle evidence with explicit tolerance | Counting elements/API names as rendering parity |
| Symbols/restoration | Exact DLL/PDB/source identities and explicit endpoint consent | Bounded verified attachments; no unapproved I/O, stale writes or source substitutes | Identity matching treated as publisher trust |
| IDE/offline | Generated hosted and offline build from same committed source | Operational menus/windows/commands/session isolation, usable layout and offline execution | Decorative panels or silent external runtime requirements |
| Publication | Exact final source SHA and canonical workflow | Successful verify and deploy jobs with artifact/source provenance | Prior ancestor success, queued workflow or an unverified push |

## Evidence package

Record input revision/manifests/hashes, runtime/compiler versions, browser/OS/GPU profile, command lines, exit statuses, original output expectations, actual output, negative cases, source maps/locations, screenshots or pixel assertions, lifecycle/cancellation checks and artifact identities. Store fixture provenance separately from conversion results. Retain meaningful failures and blocker lists rather than silently weakening a gate.

## Completion decision

A requirement closes only when its complete declared criterion is covered, its canonical implementation is committed and its exact acceptance evidence is available. A group cannot close because a narrower requirement passed. Full solution acceptance requires all mandatory groups plus unchanged whole-ControlCatalog success. Until then publish versioned profiles and honest remaining work.
