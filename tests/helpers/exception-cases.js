/** Same inputs as the independent C# oracle, evaluated through converted methods. */
export function exceptionCases(C){
  const cases=[
    ['divide',()=>C.SafeDivide(84,2)],['divide-zero',()=>C.SafeDivide(84,0)],
    ['catch-argument',()=>C.CatchOrder(0)],['catch-system',()=>C.CatchOrder(1)],['catch-base',()=>C.CatchOrder(2)],
    ['message',()=>C.Message()],['finally-return',()=>C.NestedFinally(2)],['finally-unhandled',()=>C.NestedFinally(0)],
    ['catch-finally-ok',()=>C.CatchFinally(2)],['catch-finally-error',()=>C.CatchFinally(0)],
    ['rethrow-identity',()=>C.RethrowIdentity()],['finally-replaces-error',()=>C.FinallyWins()],
    ['cleanup-local-catch-ok',()=>C.NestedCatchInFinally(2)],['cleanup-local-catch-unwind',()=>C.NestedCatchInFinally(0)],
    ['throw-null',()=>C.CatchNull()],['array-bounds',()=>C.CatchBounds(5)],['array-valid',()=>C.CatchBounds(1)],
    ['checked-add',()=>C.CheckedAdd(40,2)],['checked-add-overflow',()=>C.CheckedAdd(2147483647,1)],
    ['checked-sub-overflow',()=>C.CheckedSubtract(-2147483648,1)],['checked-uint',()=>C.CheckedUnsigned(2147483648,1)],
    ['checked-uint-overflow',()=>C.CheckedUnsigned(4294967295,1)],['checked-multiply',()=>C.CheckedMultiply(1000,1000)],
    ['checked-product-overflow',()=>C.CheckedMultiply(123456789,123456789)],
    ['checked-long',()=>C.CheckedLong(9007199254740993n,1n)],['checked-long-overflow',()=>C.CheckedLong(9223372036854775807n,2n)],
    ['checked-byte',()=>C.CheckedByte(255)],['checked-byte-overflow',()=>C.CheckedByte(256)],['checked-byte-negative',()=>C.CheckedByte(-1)],
    ['checked-double',()=>C.CheckedDouble(-42.75)],['checked-double-overflow',()=>C.CheckedDouble(2147483648)],
    ['checked-double-nan',()=>C.CheckedDouble(NaN)],['checked-double-infinity',()=>C.CheckedDouble(Infinity)],
    ['catch-overflow',()=>C.CatchOverflow(2147483647,1)],['inner-message',()=>C.InnerMessage()]
  ];
  return cases.map(([name,fn])=>{
    C.Reset();let value=null,exception=null;
    try{value=fn();if(typeof value==='bigint')value=String(value);}catch(error){exception=error.constructor.name;}
    return {name,value,exception,trace:C.Trace()};
  });
}
