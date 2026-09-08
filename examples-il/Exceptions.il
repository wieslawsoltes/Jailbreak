.assembly Jailbreak.Exceptions {}
.class public Recovery extends [System.Runtime]System.Object {
  .method public static int32 SafeDivide(int32 value, int32 divisor) cil managed {
    .maxstack 2
    .locals init ([0] int32 result)
    .try {
      ldarg.0
      ldarg.1
      div
      stloc.0
      leave done
    }
    catch [System.Runtime]System.DivideByZeroException {
      pop
      ldc.i4.m1
      stloc.0
      leave done
    }
    done: ldloc.0
    ret
  }
  .method public static int32 CleanupOrder() cil managed {
    .maxstack 2
    .locals init ([0] int32 trace)
    .try {
      .try {
        ldc.i4.1
        stloc.0
        leave done
      }
      finally {
        ldloc.0
        ldc.i4 10
        mul
        ldc.i4.2
        add
        stloc.0
        endfinally
      }
    }
    finally {
      ldloc.0
      ldc.i4 10
      mul
      ldc.i4.3
      add
      stloc.0
      endfinally
    }
    done: ldloc.0
    ret
  }
  .method public static int32 CheckedSum(int32 a, int32 b) cil managed {
    .maxstack 2
    ldarg.0
    ldarg.1
    add.ovf
    ret
  }
}
