using System;
namespace NativeSymbols
{
    public static class Calculations
    {
        public static int Sum(int n)
        {
            int total = 0;
            for (int i = 0; i < n; i++)
            {
                total += i;
            }
            return total;
        }
        public static int Twice(int value)
        {
            int answer = value * 2;
            return answer;
        }
        public static void Fail()
        {
            throw new InvalidOperationException("native symbol fixture");
        }
    }
}
