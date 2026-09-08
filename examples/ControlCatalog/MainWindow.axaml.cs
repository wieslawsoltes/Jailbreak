using Avalonia.Controls;
using System.Collections.ObjectModel;
namespace Catalog;
public partial class MainWindow : Window
{
    public int Clicks { get; set; }
    public string Status { get; set; } = "Ready for your first action.";
    public string Name { get; set; } = "Jailbreak";
    public double Level { get; set; } = 62;
    public ObservableCollection<string> Libraries { get; set; } = new ObservableCollection<string>
    {
        "compiler-core", "xaml-compiler", "csharp-compiler", "dotnet-runtime",
        "avalonia-runtime", "renderer", "project-system"
    };
    public MainWindow() { InitializeComponent(); DataContext = this; }
    private void Clicked(object sender, RoutedEventArgs e)
    {
        Clicks++;
        Status = $"C# handler executed {Clicks} time(s).";
    }
}
