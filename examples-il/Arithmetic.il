.assembly IL.Arithmetic {}
.class public Demo.Calculator extends [System.Runtime]System.Object
{
  .method public static int32 Add(int32 left, int32 right) cil managed
  {
    .maxstack 2
    ldarg.0
    ldarg.1
    add
    ret
  }
  .method public static int64 LargeInteger() cil managed
  {
    .maxstack 2
    ldc.i8 9223372036854775807
    ldc.i8 1
    add
    ret
  }
}
