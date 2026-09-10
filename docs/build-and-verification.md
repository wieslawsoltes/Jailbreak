# Build, verification and evidence

> Audit input: [`92cfb4ddc1f3`](https://github.com/wieslawsoltes/Jailbreak/tree/92cfb4ddc1f35e1ae3fa9093d7ed04a041d75d4c); documentation reconciled 2026-09-10T11:42:51+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

## Exact repository scripts

The following is generated from the audited package.json, avoiding stale command names:

| Command | Actual package script |
| --- | --- |
| `npm run build` | `node scripts/generate-pdb-example.mjs && node scripts/build.mjs` |
| `npm run check` | `node scripts/check.mjs` |
| `npm run compile:binary` | `node scripts/compile-binary.mjs` |
| `npm run gate` | `node scripts/generate-pdb-example.mjs && node scripts/gate.mjs` |
| `npm run serve` | `node scripts/serve.mjs` |
| `npm run test` | `node --test tests/*.test.js` |
| `npm run test:clr` | `node scripts/verify-msil-clr.mjs` |
| `npm run test:exceptions-clr` | `node scripts/verify-exceptions-clr.mjs` |

Declared engines: `{"node": ">=22"}`. Read the canonical workflow for exact CI Node/.NET/Python/browser setup. Do not claim arbitrary Node or browser versions were tested.

## Local development sequence

Run the package unit test, example gate, static build and syntax-check scripts that appear above. For browser verification, use the same Playwright dependency/browser version and discovery command as [toolchain.yml](../.github/workflows/toolchain.yml). SDK/Windows reference builders execute repository-owned fixture source only; conversion of user inputs must not execute those user binaries or package tasks.

## Acceptance layers are different

| Layer | What it proves | What it does not prove |
| --- | --- | --- |
| Source/entrypoint inventory | Code is present at an exact revision | Correct or full semantics |
| Committed test file | An acceptance case has been authored | A test run passed |
| Fixture builder + CLR oracle | An original SDK/Windows binary and independent expectation exist | JavaScript conversion passed |
| Compiler/runtime tests | Their specific positive/negative profile passed | Arbitrary .NET/Avalonia compatibility |
| Browser tests | Actual tested interactions/rendering/debugging worked | Full upstream catalog or every browser/GPU |
| Canonical verify job | Its declared suite passed for its head SHA | A later or different revision passed |
| Pages deploy job | That verified artifact was deployed | Unimplemented features became compatible |

## Current audit evidence

See [current-status.md](current-status.md) and [audit/evidence.json](audit/evidence.json). Local gate receipts record command, exit status and parsed summary only when actually executed. Historical milestone test totals stay attached to their historical scope, not the current suite. Full browser/CLR verification of the final documentation revision is recorded by the canonical Actions run after publication.

## Required regression coverage

Every compiler feature needs positive and negative parsing/binding/verification/execution cases and independent semantics where applicable. Every control/layout change needs real interaction and, where relevant, rendered-image/pixel evidence. Every runtime feature needs lifecycle/error/cancellation tests. Every capability needs source-map/debugger, designer editability and reload/disposal coverage or an explicit blocking gap.

The strict whole-ControlCatalog gate must consume the complete pinned original project input manifest. Selected unchanged-page tests and source hashes remain valuable but cannot set the full-project pass flag. Test failure must never be converted into a warning or excluded page merely to improve the reported pass count.

## Documentation checks

```sh
python scripts/reconcile-documentation-20260910.py --check
```

The check validates authored Markdown local targets/anchors, stable requirement IDs, traceability evidence links and current manifest files. It preserves vendored/upstream/license documents unchanged. External URLs are references; this check does not claim to have verified their availability. See [documentation maintenance](documentation-maintenance.md).
