# Owned SDK-built binary fixtures

`fixture.json` is the version-controlled portable representation of the actual .NET SDK-built DLL, NuGet package and a reference-only DLL negative fixture. Each binary has SHA-256 verification. Source is `../msil-src`, initial build commit `2121104088536c85fca332e952cdb02f15400667`, Actions run `34249361811`. The CLR oracle was executed independently by the fixture workflow, not calculated by Jailbreak.

`npm run test:clr` rebuilds and packs that source, records fresh .NET results and verifies both newly built binaries against them. The browser build materializes downloadable example DLL/nupkg files from the manifest. Do not replace tests with an invented PE or only a source-transpiled substitute.

The fixture source is MIT-licensed project-owned test material. Reference-only bytes are never a successful executable input. No third-party application binaries are redistributed here.
