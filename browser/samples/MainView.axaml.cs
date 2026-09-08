using Avalonia.Controls;
namespace Jailbreak.Demo;
public partial class MainView : UserControl
{
    private int count = 0;
    public MainView() { InitializeComponent(); }
    private void Increment(object sender, RoutedEventArgs e)
    {
        count++;
        CounterLabel.Text = $"Count: {count}";
    }
}
