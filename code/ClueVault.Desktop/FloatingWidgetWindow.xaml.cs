using System.IO;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using ClueVault.Desktop.Infrastructure;

namespace ClueVault.Desktop;

public partial class FloatingWidgetWindow : Window
{
    public event EventHandler? WidgetClicked;
    public event EventHandler? ExitRequested;
    public event EventHandler<IReadOnlyList<string>>? FilesDropped;

    public FloatingWidgetWindow()
    {
        InitializeComponent();
    }

    public void ApplyWidgetState(WidgetState state)
    {
        AvatarImage.Source = new BitmapImage(new Uri(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Assets", state.CurrentAvatarAsset)));
        AvatarImage.ToolTip = $"{state.CurrentAvatarLabel}：今日已归档 {state.TodayCount}，切换阈值 {state.Threshold}";
    }

    private void Window_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount >= 2)
        {
            WidgetClicked?.Invoke(this, EventArgs.Empty);
            return;
        }

        try
        {
            DragMove();
        }
        catch
        {
            // Ignore drag failures when user clicks quickly.
        }
    }

    private void Window_DragOver(object sender, System.Windows.DragEventArgs e)
    {
        e.Effects = System.Windows.DragDropEffects.Copy;
        e.Handled = true;
    }

    private void Window_Drop(object sender, System.Windows.DragEventArgs e)
    {
        if (e.Data.GetData(System.Windows.DataFormats.FileDrop) is string[] files && files.Length > 0)
        {
            FilesDropped?.Invoke(this, files);
        }
    }

    private void OpenMain_Click(object sender, RoutedEventArgs e)
    {
        WidgetClicked?.Invoke(this, EventArgs.Empty);
    }

    private void Exit_Click(object sender, RoutedEventArgs e)
    {
        ExitRequested?.Invoke(this, EventArgs.Empty);
    }
}
