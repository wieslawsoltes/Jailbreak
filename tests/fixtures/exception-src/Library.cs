using System;
namespace ExceptionExamples;

// Owned executable fixtures. No package dependencies or native code.
public static class Recovery
{
    private static int trace;
    private static Exception original;
    public static int Trace() => trace;
    public static int SafeDivide(int value, int divisor)
    {
        try { return value / divisor; }
        catch (DivideByZeroException) { return -1; }
    }
    public static int CatchOrder(int which)
    {
        try
        {
            if (which == 0) throw new ArgumentNullException("name");
            if (which == 1) throw new InvalidOperationException("invalid");
            throw new Exception("other");
        }
        catch (ArgumentException) { return 10; }
        catch (SystemException) { return 20; }
        catch (Exception) { return 30; }
    }
    public static string Message()
    {
        try { throw new InvalidOperationException("owned message"); }
        catch (Exception error) { return error.Message; }
    }
    public static int NestedFinally(int divisor)
    {
        trace = 0;
        try
        {
            try { trace = 1; return 12 / divisor; }
            finally { trace = trace * 10 + 2; }
        }
        finally { trace = trace * 10 + 3; }
    }
    public static int CatchFinally(int divisor)
    {
        trace = 0;
        try { return NestedFinally(divisor); }
        catch (ArithmeticException) { trace = trace * 10 + 4; return -4; }
        finally { trace = trace * 10 + 5; }
    }
    private static void ThrowOriginal()
    {
        try { throw original; }
        catch (Exception) { throw; }
    }
    public static bool RethrowIdentity()
    {
        original = new InvalidOperationException("identity");
        try { ThrowOriginal(); }
        catch (Exception error) { return error == original; }
    }
    public static int FinallyWins()
    {
        trace = 0;
        try
        {
            try { throw new ArgumentException("first"); }
            finally { trace = 1; throw new InvalidOperationException("second"); }
        }
        catch (InvalidOperationException) { trace = trace * 10 + 2; return trace; }
    }
    public static int NestedCatchInFinally(int divisor)
    {
        trace = 0;
        try
        {
            try { return 12 / divisor; }
            finally
            {
                try { throw new ArgumentException("cleanup"); }
                catch (ArgumentException) { trace = 7; }
                finally { trace = trace * 10 + 8; }
            }
        }
        catch (DivideByZeroException) { trace = trace * 10 + 9; return trace; }
    }
    public static int CatchNull()
    {
        try { throw null; }
        catch (NullReferenceException) { return 42; }
    }
    public static int CatchBounds(int index)
    {
        try { int[] data = new int[2]; return data[index]; }
        catch (IndexOutOfRangeException) { return -2; }
    }
    public static int CheckedAdd(int a, int b) => checked(a + b);
    public static uint CheckedUnsigned(uint a, uint b) => checked(a + b);
    public static int CheckedMultiply(int a, int b) => checked(a * b);
    public static long CheckedLong(long a, long b) => checked(a * b);
    public static byte CheckedByte(int value) => checked((byte)value);
    public static int CheckedDouble(double value) => checked((int)value);
    public static int CheckedSubtract(int a, int b) => checked(a - b);
    public static int CatchOverflow(int a, int b)
    {
        try { return checked(a + b); }
        catch (OverflowException) { return -10; }
    }
    public static string InnerMessage()
    {
        try { throw new Exception("outer", new InvalidOperationException("inner")); }
        catch (Exception error) { return error.InnerException.Message; }
    }
}
