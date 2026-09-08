using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Reflection;
using System.Text.Json;
using ExceptionExamples;

var cases = new (string Name, Func<object> Run)[] {
    ("divide", () => Recovery.SafeDivide(84, 2)),
    ("divide-zero", () => Recovery.SafeDivide(84, 0)),
    ("catch-argument", () => Recovery.CatchOrder(0)),
    ("catch-system", () => Recovery.CatchOrder(1)),
    ("catch-base", () => Recovery.CatchOrder(2)),
    ("message", () => Recovery.Message()),
    ("finally-return", () => Recovery.NestedFinally(2)),
    ("finally-unhandled", () => Recovery.NestedFinally(0)),
    ("catch-finally-ok", () => Recovery.CatchFinally(2)),
    ("catch-finally-error", () => Recovery.CatchFinally(0)),
    ("rethrow-identity", () => Recovery.RethrowIdentity()),
    ("finally-replaces-error", () => Recovery.FinallyWins()),
    ("cleanup-local-catch-ok", () => Recovery.NestedCatchInFinally(2)),
    ("cleanup-local-catch-unwind", () => Recovery.NestedCatchInFinally(0)),
    ("throw-null", () => Recovery.CatchNull()),
    ("array-bounds", () => Recovery.CatchBounds(5)),
    ("array-valid", () => Recovery.CatchBounds(1)),
    ("checked-add", () => Recovery.CheckedAdd(40, 2)),
    ("checked-add-overflow", () => Recovery.CheckedAdd(int.MaxValue, 1)),
    ("checked-sub-overflow", () => Recovery.CheckedSubtract(int.MinValue, 1)),
    ("checked-uint", () => Recovery.CheckedUnsigned(0x80000000, 1)),
    ("checked-uint-overflow", () => Recovery.CheckedUnsigned(uint.MaxValue, 1)),
    ("checked-multiply", () => Recovery.CheckedMultiply(1000, 1000)),
    ("checked-product-overflow", () => Recovery.CheckedMultiply(123456789, 123456789)),
    ("checked-long", () => Recovery.CheckedLong(9007199254740993L, 1)),
    ("checked-long-overflow", () => Recovery.CheckedLong(long.MaxValue, 2)),
    ("checked-byte", () => Recovery.CheckedByte(255)),
    ("checked-byte-overflow", () => Recovery.CheckedByte(256)),
    ("checked-byte-negative", () => Recovery.CheckedByte(-1)),
    ("checked-double", () => Recovery.CheckedDouble(-42.75)),
    ("checked-double-overflow", () => Recovery.CheckedDouble(2147483648.0)),
    ("checked-double-nan", () => Recovery.CheckedDouble(double.NaN)),
    ("checked-double-infinity", () => Recovery.CheckedDouble(double.PositiveInfinity)),
    ("catch-overflow", () => Recovery.CatchOverflow(int.MaxValue, 1)),
    ("inner-message", () => Recovery.InnerMessage())
};
var results = new List<object>();
foreach (var item in cases) {
    Recovery.Reset(); object value = null; string exception = null;
    try { value = item.Run(); if (value is long || value is ulong) value = value.ToString(); }
    catch (Exception error) { exception = error.GetType().Name; }
    results.Add(new { name = item.Name, value, exception, trace = Recovery.Trace() });
}
var dir = args[0]; Directory.CreateDirectory(dir);
File.WriteAllText(Path.Combine(dir, "oracle.json"), JsonSerializer.Serialize(results));
var regions = typeof(Recovery).GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static)
    .Where(m => m.DeclaringType == typeof(Recovery)).Select(m => new {
        method = m.Name, token = m.MetadataToken,
        clauses = m.GetMethodBody().ExceptionHandlingClauses.Select(c => new {
            kind = c.Flags == ExceptionHandlingClauseOptions.Clause ? "catch" : c.Flags.ToString().ToLowerInvariant(),
            tryOffset = c.TryOffset, tryLength = c.TryLength,
            handlerOffset = c.HandlerOffset, handlerLength = c.HandlerLength,
            catchType = c.Flags == ExceptionHandlingClauseOptions.Clause ? c.CatchType.FullName : null
        })
    });
File.WriteAllText(Path.Combine(dir, "regions.json"), JsonSerializer.Serialize(regions));
Console.WriteLine("Produced " + results.Count + " independent CLR exception/arithmetic cases.");
