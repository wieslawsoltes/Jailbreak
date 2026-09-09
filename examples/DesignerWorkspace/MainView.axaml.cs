using Avalonia.Controls;
namespace DesignerWorkspace;

public partial class MainView : UserControl
{
    private int count = 0;
    public MainView()
    {
        InitializeComponent();
        var code = new Button { Name = "CodeAction", Content = "Initializer value" };
        var action = code;
        action.Content = "Created in C#";
        action.Width = 180;
        action.Height = 40;
        code.Click += Activate;
        CodeHost.Children.Add(code);
    }
    private void Activate(object sender, RoutedEventArgs e)
    {
        count += 1;
        Activity.Text = $"{count} actions completed";
    }
}
