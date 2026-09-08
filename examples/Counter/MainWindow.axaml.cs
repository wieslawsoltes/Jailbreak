using Avalonia.Controls;
using Avalonia.Interactivity;
namespace Counter;
public partial class MainWindow : Window
{
    public int Count { get; set; }
    public string Message { get; set; } = "Ready. Try the buttons.";
    public MainWindow() { InitializeComponent(); DataContext = this; }
    private void Increment(object sender, RoutedEventArgs e)
    {
        Count++;
        Message = $"C# event handler ran. Count = {Count}.";
    }
    private void Decrement(object sender, RoutedEventArgs e) { Count--; }
    private void Reset(object sender, RoutedEventArgs e) { Count = 0; Message = "Reset from C#."; }
}
