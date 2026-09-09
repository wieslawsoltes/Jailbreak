using Avalonia.Controls;
namespace NativeLibrary;
public partial class MainView : UserControl
{
    public MainView() { InitializeComponent(); }
    private void Calculate(object sender, RoutedEventArgs e)
    {
        int result = NativeSymbols.Calculations.Sum(10);
        Result.Text = $"Windows library sum: {result}";
    }
}
