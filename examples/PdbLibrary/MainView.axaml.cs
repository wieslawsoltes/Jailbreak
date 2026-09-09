using Avalonia.Controls;
namespace PdbLibrary;
public partial class MainView : UserControl
{
    public MainView() { InitializeComponent(); }
    private void Calculate(object sender, RoutedEventArgs e)
    {
        int result = PdbExamples.Calculations.Sum(10);
        Result.Text = $"Library sum: {result}";
    }
}
