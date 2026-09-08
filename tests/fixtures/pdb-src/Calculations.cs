namespace PdbExamples;
public static class Calculations
{
    public static int Cleanup;
    public static int Sum(int count)
    {
        int total = 0;
        for (int i = 0; i < count; i++)
        {
            total += i;
        }
        return total;
    }
    public static int Twice(int value)
    {
        return value * 2;
    }
    public static int Guarded(int value)
    {
        try
        {
            return checked(value * 2);
        }
        catch (System.OverflowException)
        {
            return -1;
        }
        finally
        {
            Cleanup++;
        }
    }
}
