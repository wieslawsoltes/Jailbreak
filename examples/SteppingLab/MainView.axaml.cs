namespace SteppingLab;
public partial class MainView : UserControl
{
    public int total = 0;
    public MainView() { InitializeComponent(); }
    private void RunNested(object sender, RoutedEventArgs e)
    {
        int result = Double(3);
        total += result;
        Status.Text = $"Total: {total}";
    }
    private int Double(int value)
    {
        int doubled = value * 2;
        return doubled;
    }
    private async void RunAsync(object sender, RoutedEventArgs e)
    {
        int result = await Delayed(4);
        total += result;
        Status.Text = $"Total: {total}";
    }
    private async Task<int> Delayed(int value)
    {
        await Task.Delay(1);
        return value + 5;
    }
    private void RunException(object sender, RoutedEventArgs e)
    {
        try
        {
            throw new InvalidOperationException("Inspect this before it is caught");
        }
        catch (InvalidOperationException error)
        {
            Status.Text = error.Message;
        }
    }
}
