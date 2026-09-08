using Avalonia.Controls;
using Avalonia.Interactivity;
using BinaryExamples;
namespace BinaryDemo;
public partial class MainView : UserControl
{
    private Counter counter;
    public MainView()
    {
        InitializeComponent();
        counter = new Counter(39);
        Greeting.Text = Calculator.Greet("C# and MSIL together");
    }
    private void RunLibrary(object sender, RoutedEventArgs e)
    {
        Greeting.Text = Calculator.Greet(NameInput.Text);
        int result = counter.Increment(3);
        Result.Text = $"DLL counter: {result}; sum: {Calculator.SumTo(100)}";
    }
}
