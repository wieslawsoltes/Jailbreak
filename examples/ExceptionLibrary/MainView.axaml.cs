using System;
using Avalonia.Controls;
using Avalonia.Interactivity;
using ExceptionExamples;
namespace RecoveryDemo;
public partial class MainView : UserControl
{
    public MainView() { InitializeComponent(); }
    private void Recover(object sender, RoutedEventArgs e)
    {
        Result.Text = $"DLL recovery result: {Recovery.SafeDivide(84, 0)}";
        Cleanup.Text = "DivideByZeroException handled in the DLL";
    }
    private void CatchOverflow(object sender, RoutedEventArgs e)
    {
        try
        {
            int result = Recovery.CheckedAdd(2147483647, 1);
            Result.Text = $"Unexpected result: {result}";
        }
        catch (OverflowException error)
        {
            Result.Text = "Caught DLL OverflowException in C#";
        }
        finally
        {
            Cleanup.Text = "C# finally completed";
        }
    }
    private void NestedCleanup(object sender, RoutedEventArgs e)
    {
        int result = Recovery.CatchFinally(0);
        Result.Text = $"Nested result: {result}; cleanup order: {Recovery.Trace()}";
        Cleanup.Text = "Both DLL finally blocks, catch, and outer finally completed";
    }
}
