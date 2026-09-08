# Quality gates

Run from the repository root with Node.js 22+:

```sh
npm test
npm run gate
npm run build
npm run check
python3 -m pip install playwright==1.55.0
python3 -m playwright install chromium
python3 -m unittest discover -s tests/browser -p 'test_*.py' -v
```

Linux CI installs browser system dependencies with `playwright install --with-deps chromium`. `CHROMIUM_EXECUTABLE` can select an existing local browser. The inspector-only inline test option is not a replacement for the real workbench gates.

## Layers

The Node suite exercises compiler/runtime regressions plus preprocessing, imported/conditional project evaluation, per-project symbol isolation, original diagnostic positions and unchanged requested-fork source integrity/compilation. The example gate compiles and constructs seven trusted example workspaces and validates the existing official upstream source/license hashes. It never treats construction alone as full behavioral compatibility.

Chromium tests in `tests/browser/` cover the shared profile inspector, primary Debug/Release execution, persistence, source navigation, safe text display, standalone export, preview-origin isolation, the secondary demo/profile workflow, and requested-fork CheckBox/RadioButton behavior. Screenshots are written to `test-results/`; `npm run gate` writes `test-results/gate.json`.

`npm run check` syntax-checks authored primary JavaScript and the two offline script blocks. Secondary compiler imports are exercised by the cross-pipeline Node suite and its IDE/runtime by browser tests; that does not imply every secondary source file has a unit test.

## Verified checkpoint and publication

[Actions run 34232824105](https://github.com/wieslawsoltes/Jailbreak/actions/runs/34232824105), commit `29e721b5aca1f402d3bc1dde6a12c18749acf32b`, completed verification and Pages deployment successfully. The workflow uploads `jailbreak-test-evidence`, `jailbreak-site`, and the Pages artifact. Inspect the workflow for later commit results; documentation checkpoints are not rolling claims.

The full catalog gate is separate and deliberately fails under `--require-full`. Physical WebGPU device validation, performance benchmarks, full Avalonia screenshots and complete .NET conformance are not established by the current tests.

## Binary regression gates

`tests/msil.test.js` and `tests/nuget.test.js` add PE integrity, IL stack/control-flow semantics, exact dependencies, reference-only rejection, numeric operations and real DLL/package-to-source integration gates. Portable fixture bytes and SHA-256 provenance are in `tests/fixtures/msil/fixture.json`; owned source is in `tests/fixtures/msil-src`.

`npm run test:clr` (requires .NET 8 SDK) independently rebuilds the DLL/nupkg, executes a CLR oracle, converts both fresh inputs and compares 12 values. The canonical CI runs this step before browser checks; `test-results/msil-clr/comparison.json` records actual results. Installing the step is not itself a passing result.

`tests/browser/test_msil.py` adds eight actual browser checks: IL editing/failure, loops, real DLL/nupkg file upload, metadata selection, instance/virtual behavior, offline exports, origin isolation and C#/XAML handlers calling the converted binary. Both offline IDE script pairs are syntax-checked. The trusted-example gate now contains eleven UI workspaces. These gates supplement—not replace—the existing template/project/ControlCatalog checks.
