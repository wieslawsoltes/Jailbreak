using Avalonia.Controls;
namespace GridDesigner;
public partial class MainView : UserControl
{
    public int count = 0;
    public MainView() { InitializeComponent(); }
    private void Increment(object sender, RoutedEventArgs e)
    {
        count += 1;
        CounterLabel.Text = $"Count: {count}";
    }
}
