using Avalonia.Controls;
namespace Templates;
public partial class MainView : UserControl
{
    private int count = 0;
    public MainView() { InitializeComponent(); }
    private void Increment(object sender, RoutedEventArgs e) { count++; FirstCard.Content = $"First card: {count}"; }
    private void ReplaceTemplate(object sender, RoutedEventArgs e) { FirstCard.Template = Resources["CompactTemplate"]; }
    private void RestoreTemplate(object sender, RoutedEventArgs e) { FirstCard.ClearValue("Template"); }
    private void ChangeAccent(object sender, RoutedEventArgs e) { Resources["Accent"] = "Green"; }
}
