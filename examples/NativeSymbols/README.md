# Windows managed symbols in Studio

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
