.assembly IL.Loops {}
.class public Demo.Calculator extends [System.Runtime]System.Object
{
  .method public static int32 SumTo(int32 count) cil managed
  {
    .maxstack 2
    .locals init ([0] int32 total, [1] int32 index)
    ldc.i4.0
    stloc.0
    ldc.i4.1
    stloc.1
    br.s check
  body:
    ldloc.0
    ldloc.1
    add
    stloc.0
    ldloc.1
    ldc.i4.1
    add
    stloc.1
  check:
    ldloc.1
    ldarg.0
    ble.s body
    ldloc.0
    ret
  }
}
