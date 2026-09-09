# Reviewed source integration

`series.json` lists readable source patches with SHA-256 checksums. The integration workflow applies each pending patch once, creates ordinary source commits, runs unit/example/build checks, pushes without force, then dispatches the full browser/CLR/Pages pipeline. An uploaded patch is not equivalent to a successful deployment.

Studio stages 010–012 connect the reusable IDE modules to the existing debugger, designer, editor and compiled application. The offline build uses `scripts/html-assets.mjs` to escape nested Binary Studio HTML as JavaScript JSON data. `tests/inline-assets.test.js` covers nested script boundaries, source line endings and literal backslashes. The checked-in source is validated again after materialization; no failing gate is skipped.
