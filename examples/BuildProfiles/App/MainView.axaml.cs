using Avalonia.Controls;
using SampleLibrary;
namespace BuildProfiles;

public partial class MainView : UserControl
{
    private int count = 0;
    public MainView()
    {
        InitializeComponent();
#if !BROWSER || !APP
#error Browser and app symbols must come from project evaluation
#endif
#if DEBUG
        ProfileName.Text = "Debug profile: +1 per click";
#else
        ProfileName.Text = "Release profile: +10 per click";
#endif
        LibraryLabel.Text = LibraryInfo.Label;
    }
    private void Increment(object sender, RoutedEventArgs e)
    {
#if DEBUG
        count += 1;
#else
        count += 10;
#endif
        CountLabel.Text = $"Count: {count}";
    }
}
