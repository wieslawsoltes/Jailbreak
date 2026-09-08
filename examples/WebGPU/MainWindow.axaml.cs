using Avalonia.Controls;
namespace GpuDemo;
public partial class MainWindow : Window
{
    public int Count { get; set; } = 5000;
    public MainWindow() { InitializeComponent(); DataContext = this; }
    void Normal(object sender, RoutedEventArgs e) { Count = 5000; }
    void Stress(object sender, RoutedEventArgs e) { Count = 25000; }
}
