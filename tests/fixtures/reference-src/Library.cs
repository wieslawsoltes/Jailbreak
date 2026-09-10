using System;
namespace ReferenceExamples
{
    // These methods are compiled by the actual SDK, not replaced with IL text.
    public sealed class Box
    {
        public int Value;
        public static int Shared;
        public Box(int value) { Value = value; }
    }
    public static class Calculations
    {
        public static void Add(ref int target, int delta) { target += delta; }
        public static void Swap(ref int left, ref int right)
        {
            int temporary = left;
            left = right;
            right = temporary;
        }
        public static void Answer(out int value) { value = 42; }
        public static void Overwrite(ref string value) { value = "updated"; }
        public static void Wide(ref long value) { value += 7; }
        public static void Real(ref double value) { value *= 2; }
        public static void Small(ref byte value) { value = unchecked((byte)(value + 3)); }
        public static int Locals() { int a = 7, b = 11; Swap(ref a, ref b); Add(ref a, 5); return a * 100 + b; }
        public static int Aliases() { int a = 9; Swap(ref a, ref a); Add(ref a, a); return a; }
        public static int OutValue() { int result; Answer(out result); return result; }
        public static int Field() { var box = new Box(10); Add(ref box.Value, 32); return box.Value; }
        public static int StaticField() { Box.Shared = 5; Add(ref Box.Shared, 8); return Box.Shared; }
        public static int Array() { int[] data = new int[2]; data[0] = 6; data[1] = 8; Swap(ref data[0], ref data[1]); return data[0] * 10 + data[1]; }
        public static string Reference() { string text = "original"; Overwrite(ref text); return text; }
        public static long Large() { long value = 9007199254740993L; Wide(ref value); return value; }
        public static double Floating() { double value = 2.25; Real(ref value); return value; }
        public static int Narrow() { byte value = 254; Small(ref value); return value; }
        public static int Argument(int value) { Add(ref value, 5); return value; }
        public static int Finally()
        {
            int value = 2;
            try { Add(ref value, 3); throw new InvalidOperationException("reference fixture"); }
            catch (InvalidOperationException) { Add(ref value, 7); }
            finally { Add(ref value, 11); }
            return value;
        }
        public static int NullField()
        {
            Box value = null;
            try { Add(ref value.Value, 1); return 0; }
            catch (NullReferenceException) { return 17; }
        }
        public static int ArrayBounds()
        {
            int[] values = new int[1];
            try { Add(ref values[2], 1); return 0; }
            catch (IndexOutOfRangeException) { return 19; }
        }
    }
}
