# Windows managed symbols in Studio

<!-- jailbreak-current-documentation:begin -->
> **Specialized guide / example; current applicability audited 2026-09-10.** This document is a specialized profile/example, not a full-solution completion claim. Use [current source and CI status](../../docs/current-status.md), [full requirements](../../docs/requirements.md), and [remaining acceptance work](../../docs/remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](../../docs/ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

Select **Debug · In-IDE**, open **[symbol] Library.cs**, and set a breakpoint on
`total += i` (line 11). Click **Call native-symbol library**. Studio pauses in the
actual converted DLL with the caller below it. Change the visible `total` local,
clear the breakpoint and continue; the library result changes accordingly.

`library.binary.json` contains exactly the DLL/PDB bytes and CRLF C# source in
`tests/fixtures/msil/native-pdb.json`. The Windows Framework compiler produced the
MSF7 PDB; a separate CLR execution recorded the results and exception line.
The source attachment is debugger data, not a substitute compilation unit.

The host project TFM describes this source workspace; it does not retarget the
legacy DLL or imply arbitrary .NET Framework compatibility. Only the existing
verified MSIL/API profile executes. Native machine code is not executed.
