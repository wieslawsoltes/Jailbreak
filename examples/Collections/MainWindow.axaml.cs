using System.Collections.ObjectModel;
using System.Linq;
using Avalonia.Controls;
namespace Collections;
public class Component
{
    public string Name { get; set; }
    public string Category { get; set; }
}
public partial class MainWindow : Window
{
    public ObservableCollection<Component> Items { get; set; } = new ObservableCollection<Component>
    {
        new Component { Name = "XAML compiler", Category = "Compiler" },
        new Component { Name = "C# compiler", Category = "Compiler" },
        new Component { Name = "Binding engine", Category = "Runtime" }
    };
    public Component Selected { get; set; }
    public string NewName { get; set; } = "A new library";
    public string Summary { get; set; } = "3 components, 2 compilers";
    public MainWindow() { InitializeComponent(); DataContext = this; }
    private void AddItem(object sender, RoutedEventArgs e)
    {
        Items.Add(new Component { Name = NewName, Category = "Library" });
        Summary = $"{Items.Count} components, {Items.Where(x => x.Category == "Compiler").Count()} compilers";
    }
    private void RemoveItem(object sender, RoutedEventArgs e)
    {
        if (Selected != null) Items.Remove(Selected);
        Summary = $"{Items.Count} components";
    }
}
