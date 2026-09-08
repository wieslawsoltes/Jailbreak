using Avalonia.Controls;
namespace DeveloperTools;

public partial class MainView : UserControl
{
    public int count = 0;
    public MainView()
    {
        InitializeComponent();
        var codeButton = new Button { Name = "CodeButton", Content = "Built in C#", Width = 180 };
        codeButton.Click += Increment;
        Panel.Children.Add(codeButton);
    }
    private void Increment(object sender, RoutedEventArgs e)
    {
        count += 1;
        CounterLabel.Text = $"Count: {count}";
    }
}
