using System;
namespace BinaryExamples;

public static class Calculator
{
    public static int Add(int a, int b) => a + b;
    public static int Multiply(int a, int b) => a * b;
    public static int Divide(int a, int b) => a / b;
    public static int SumTo(int n) { int sum = 0; for (int i = 1; i <= n; i++) sum += i; return sum; }
    public static int Factorial(int n) => n <= 1 ? 1 : n * Factorial(n - 1);
    public static int Choose(int n) { switch (n) { case 0: return 7; case 1: return 11; case 2: return 13; case 3: return 17; default: return -1; } }
    public static int SumArray(int[] values) { int sum = 0; for (int i = 0; i < values.Length; i++) sum += values[i]; return sum; }
    public static int[] Sequence(int n) { int[] result = new int[n]; for (int i = 0; i < n; i++) result[i] = i * 2; return result; }
    public static double Scale(double value, double factor) => value * factor + 0.5;
    public static string Greet(string name) => string.Concat("Hello, ", name);
    public static int Absolute(int value) => Math.Abs(value);
    public static int UseCounter(int start) { var counter = new Counter(start); counter.Increment(3); return counter.Value; }
}

public class Counter
{
    private int value;
    public Counter(int initial) { value = initial; }
    public int Value { get { return value; } set { this.value = value; } }
    public int Increment(int amount) { value += amount; return value; }
    public virtual string Describe() => "counter";
}

public sealed class NamedCounter : Counter
{
    public NamedCounter(int initial) : base(initial) { }
    public override string Describe() => "named counter";
}

public static class State
{
    private static int count = 5;
    public static int Next() => ++count;
}
