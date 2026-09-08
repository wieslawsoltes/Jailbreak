using Avalonia.Controls;
namespace DataBinding;
public partial class MainWindow : Window
{
    public string Name { get; set; } = "Ada Lovelace";
    public double Level { get; set; } = 64;
    public bool Enabled { get; set; } = true;
    public MainWindow() { InitializeComponent(); DataContext = this; }
    private void ChangeValues(object sender, RoutedEventArgs e)
    { Name = "Grace Hopper"; Level = 85; }
}
