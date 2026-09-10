# Documentation maintenance and audit procedure

> Audit input: [`9b73d1167983`](https://github.com/wieslawsoltes/Jailbreak/tree/9b73d1167983076687cf078a3992144e4a18794a); documentation reconciled 2026-09-10T11:23:03+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

## Sources of truth

The user-approved requirements are recorded in [the requirements contract](requirements.md) and its [machine-readable source](audit/requirements-contract-20260910.json). Current implementation means ordinary source on a verified revision. Tests and CI establish only their actual scope. Chat summaries, uploaded blobs and historical milestone prose are not substitutes for a fresh source/CI audit.

## Document roles

Canonical current guides are indexed in [README.md](README.md). Specialized notes retain detail and link to current guides. Milestone documents preserve historical design decisions/evidence and are explicitly marked historical; their old Remaining/Unsupported lists and test counts are not current global status. Vendored/upstream/license documents remain byte-identical. [documentation-index.json](audit/documentation-index.json) records every Markdown file reviewed and its role.

## Reconciliation command

```sh
python scripts/reconcile-documentation-20260910.py
python scripts/reconcile-documentation-20260910.py --check
```

Run in a clean checkout of the intended main revision. The auditor records exact implementation hashes, current module/export/script inventory, requirements, source/test paths and available hosted CI evidence; it rewrites canonical guides and adds current-applicability notices to authored historical/specialized notes. It does not implement missing code or mark full targets complete. Review semantic changes in code/tests and adjust the contract/profile descriptions before treating a generated audit as sufficient.

## Granular publication

`--commit` creates focused documentation commits after source/contract/link checks, using only the enumerated documentation paths. The audit script and requirement source should already be committed. The workflow preserves evidence, pushes without force and invokes canonical CI for the final documentation head. Concurrent source changes stop publication rather than being overwritten. The final run receipt is an Actions artifact; no document invents its own future successful deployment.

## Required updates with implementation changes

Update the relevant stable requirement mapping, present capability/limit, canonical API/architecture or UI guide, remaining task and acceptance tests. Keep historical results clearly dated and add supersession notes when a later stage closes an old limitation. Verify local Markdown paths/anchors and source fingerprints, and report any explicit documentation exclusions. Never copy all old test totals into a current status table.
