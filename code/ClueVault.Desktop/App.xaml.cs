using System.Windows;
using ClueVault.Desktop.Infrastructure;
using Forms = System.Windows.Forms;
using System.IO;

namespace ClueVault.Desktop;

public partial class App : System.Windows.Application
{
    public static bool IsExiting { get; private set; }

    private MainWindow? _mainWindow;
    private FloatingWidgetWindow? _floatingWidgetWindow;
    private Forms.NotifyIcon? _trayIcon;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        ShutdownMode = ShutdownMode.OnExplicitShutdown;

        var config = await ConfigService.LoadAsync();
        _mainWindow = new MainWindow();
        InitializeTrayIcon();
        if (string.IsNullOrWhiteSpace(config.DisplayName) || string.IsNullOrWhiteSpace(config.StoragePath))
        {
            _mainWindow.Show();
        }

        if (config.FloatingWidgetEnabled)
        {
            _floatingWidgetWindow = new FloatingWidgetWindow();
            _floatingWidgetWindow.WidgetClicked += FloatingWidgetWindow_WidgetClicked;
            _floatingWidgetWindow.ExitRequested += (_, _) => ExitApplication();
            _floatingWidgetWindow.FilesDropped += FloatingWidgetWindow_FilesDropped;
            _floatingWidgetWindow.Show();
            await RefreshFloatingWidgetAsync();
        }
    }

    public async Task RefreshFloatingWidgetAsync()
    {
        if (_floatingWidgetWindow is null)
        {
            return;
        }

        var config = await ConfigService.LoadAsync();
        var state = await StatsService.GetWidgetStateAsync(config);
        _floatingWidgetWindow.ApplyWidgetState(state);
    }

    private void FloatingWidgetWindow_WidgetClicked(object? sender, EventArgs e)
    {
        ShowMainWindow();
    }

    private async void FloatingWidgetWindow_FilesDropped(object? sender, IReadOnlyList<string> e)
    {
        var attachments = ArchiveService.ToAttachments(e);
        if (attachments.Count == 0)
        {
            return;
        }

        var config = await ConfigService.LoadAsync();
        var dialog = new QuickArchiveWindow(attachments, "architecture");
        PlaceQuickArchiveWindow(dialog);
        if (dialog.ShowDialog() != true)
        {
            return;
        }

        try
        {
            var entry = await ArchiveService.SubmitAsync(
                config,
                dialog.SelectedDisciplineId,
                config.DisplayName,
                dialog.SourceValue,
                dialog.RemarkValue,
                dialog.ProjectNameValue,
                attachments);

            await HistoryService.AppendAsync(entry);
            await RefreshFloatingWidgetAsync();

            if (_mainWindow is not null)
            {
                await _mainWindow.RefreshAfterExternalArchiveAsync();
            }
        }
        catch (Exception error)
        {
            System.Windows.MessageBox.Show(error.Message, "归档失败", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void PlaceQuickArchiveWindow(Window dialog)
    {
        if (_floatingWidgetWindow is null)
        {
            dialog.WindowStartupLocation = WindowStartupLocation.CenterScreen;
            return;
        }

        dialog.Owner = _floatingWidgetWindow;
        dialog.Topmost = true;
        dialog.WindowStartupLocation = WindowStartupLocation.Manual;

        var workArea = SystemParameters.WorkArea;
        var left = _floatingWidgetWindow.Left + (_floatingWidgetWindow.Width - dialog.Width) / 2;
        var top = _floatingWidgetWindow.Top - dialog.Height - 12;

        if (top < workArea.Top + 12)
        {
            top = _floatingWidgetWindow.Top + _floatingWidgetWindow.Height + 12;
        }

        dialog.Left = Math.Min(Math.Max(left, workArea.Left + 12), workArea.Right - dialog.Width - 12);
        dialog.Top = Math.Min(Math.Max(top, workArea.Top + 12), workArea.Bottom - dialog.Height - 12);
    }

    private void InitializeTrayIcon()
    {
        _trayIcon = new Forms.NotifyIcon
        {
            Icon = new System.Drawing.Icon(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Assets", "app-icon.ico")),
            Text = "ClueVault 极速归档",
            Visible = true,
            ContextMenuStrip = new Forms.ContextMenuStrip()
        };

        _trayIcon.ContextMenuStrip.Items.Add("打开主窗口", null, (_, _) => Dispatcher.Invoke(ShowMainWindow));
        _trayIcon.ContextMenuStrip.Items.Add("隐藏主窗口", null, (_, _) => Dispatcher.Invoke(() => _mainWindow?.Hide()));
        _trayIcon.ContextMenuStrip.Items.Add(new Forms.ToolStripSeparator());
        _trayIcon.ContextMenuStrip.Items.Add("退出", null, (_, _) => Dispatcher.Invoke(ExitApplication));
        _trayIcon.DoubleClick += (_, _) => Dispatcher.Invoke(ShowMainWindow);
    }

    private void ShowMainWindow()
    {
        if (_mainWindow is null)
        {
            _mainWindow = new MainWindow();
        }

        _mainWindow.Show();
        if (_mainWindow.WindowState == WindowState.Minimized)
        {
            _mainWindow.WindowState = WindowState.Normal;
        }

        _mainWindow.Activate();
    }

    public void ExitApplication()
    {
        IsExiting = true;
        _trayIcon?.Dispose();
        _floatingWidgetWindow?.Close();
        _mainWindow?.Close();
        Shutdown();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _trayIcon?.Dispose();
        base.OnExit(e);
    }
}
