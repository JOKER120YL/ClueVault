using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;
using System.ComponentModel;
using System.Windows.Controls.Primitives;
using System.Diagnostics;
using System.Reflection;
using Microsoft.Win32;
using ClueVault.Desktop.Infrastructure;
using System.Windows.Input;

namespace ClueVault.Desktop;

public partial class MainWindow : Window
{
    private readonly ObservableCollection<AttachmentItem> _attachments = [];
    private ObservableCollection<SubmissionHistoryEntry> _historyEntries = [];
    private ObservableCollection<SubmissionHistoryEntry> _visibleHistoryEntries = [];
    private AppConfig _config = new();
    private string _selectedDisciplineId = "architecture";
    private bool _isLoadedOnce;

    public MainWindow()
    {
        InitializeComponent();
        AttachmentList.ItemsSource = _attachments;
        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
        KeyDown += MainWindow_KeyDown;
    }

    private void MainWindow_Closing(object? sender, CancelEventArgs e)
    {
        if (App.IsExiting)
        {
            return;
        }

        e.Cancel = true;
        Hide();
    }

    public async Task ReceiveWidgetFilesAsync(IEnumerable<string> filePaths)
    {
        AddAttachments(ArchiveService.ToAttachments(filePaths));
        WidgetQuickText.Text = $"已收到 {_attachments.Count} 个附件。";
        WidgetQuickPanel.Visibility = Visibility.Collapsed;
        WindowState = WindowState.Normal;
        Show();
        Activate();
        Topmost = true;
        Topmost = false;

        var dialog = new QuickArchiveWindow(_attachments.Count, _selectedDisciplineId) { Owner = this };
        if (dialog.ShowDialog() == true)
        {
            ApplySelectedDiscipline(dialog.SelectedDisciplineId);
            await SubmitCurrentAsync();
        }
    }

    public async Task RefreshWidgetBadgeAsync()
    {
        _config = await ConfigService.LoadAsync();
        var widgetState = await StatsService.GetWidgetStateAsync(_config);
        WidgetStateBadge.Background = widgetState.AngerLevel > 0
            ? new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xF4, 0xE2, 0xB9))
            : new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xE8, 0xF1, 0xEC));
        WidgetStateText.Text = $"今日已归档 {widgetState.TodayCount} 个";
        WidgetAvatarText.Text = $"当前形象：{widgetState.CurrentAvatarLabel}";
        RefreshConfigSummary();
    }

    public async Task RefreshAfterExternalArchiveAsync()
    {
        _historyEntries = await HistoryService.LoadAsync();
        ApplyHistoryFilter();
        await RefreshWidgetBadgeAsync();
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        if (_isLoadedOnce)
        {
            return;
        }

        _isLoadedOnce = true;
        await InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        _config = await ConfigService.LoadAsync();
        _historyEntries = await HistoryService.LoadAsync();
        ApplyHistoryFilter();
        BuildDisciplineButtons(DisciplinePanel, SelectDiscipline);
        BuildDisciplineButtons(QuickDisciplinePanel, SelectDiscipline);
        ApplySelectedDiscipline(_selectedDisciplineId);
        await RefreshWidgetBadgeAsync();
        await LoadUpdateBadgeAsync();
        _ = BeginDailyUpdateCheckAsync();

        if (string.IsNullOrWhiteSpace(_config.DisplayName) || string.IsNullOrWhiteSpace(_config.StoragePath))
        {
            await OpenSettingsAsync();
        }
    }

    private void BuildDisciplineButtons(System.Windows.Controls.WrapPanel panel, RoutedEventHandler handler)
    {
        panel.Children.Clear();
        foreach (var option in DisciplineCatalog.Options)
        {
            var button = new ToggleButton
            {
                Content = option.Label,
                Tag = option.Id,
                Style = (Style)FindResource("ChipButtonStyle")
            };
            button.Checked += handler;
            panel.Children.Add(button);
        }
    }

    private void SelectDiscipline(object sender, RoutedEventArgs e)
    {
        if (sender is ToggleButton button && button.Tag is string disciplineId)
        {
            ApplySelectedDiscipline(disciplineId);
        }
    }

    private void Nav_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement { Tag: string viewName })
        {
            ShowView(viewName);
        }
    }

    private void ShowView(string viewName)
    {
        ArchiveView.Visibility = viewName == "Archive" ? Visibility.Visible : Visibility.Collapsed;
        RecordsView.Visibility = viewName == "Records" ? Visibility.Visible : Visibility.Collapsed;
        KnowledgeView.Visibility = viewName == "Knowledge" ? Visibility.Visible : Visibility.Collapsed;
        ConfigView.Visibility = viewName == "Config" ? Visibility.Visible : Visibility.Collapsed;
        AboutView.Visibility = viewName == "About" ? Visibility.Visible : Visibility.Collapsed;

        ArchiveNavButton.Background = viewName == "Archive"
            ? new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xE8, 0xF1, 0xEC))
            : System.Windows.Media.Brushes.Transparent;
        RecordsNavButton.Background = viewName == "Records"
            ? new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xE8, 0xF1, 0xEC))
            : System.Windows.Media.Brushes.Transparent;
        KnowledgeNavButton.Background = viewName == "Knowledge"
            ? new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xE8, 0xF1, 0xEC))
            : System.Windows.Media.Brushes.Transparent;
        ConfigNavButton.Background = viewName == "Config"
            ? new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xE8, 0xF1, 0xEC))
            : System.Windows.Media.Brushes.Transparent;
        AboutNavButton.Background = viewName == "About"
            ? new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xE8, 0xF1, 0xEC))
            : System.Windows.Media.Brushes.Transparent;

        (ViewTitleText.Text, ViewDescriptionText.Text) = viewName switch
        {
            "Records" => ("今日记录", "查看今天归档了哪些模型，必要时补备注。"),
            "Knowledge" => ("经验库", "管理可复用的用户问答和处理经验。"),
            "Config" => ("配置中心", "管理共享盘和悬浮窗设置。"),
            "About" => ("关于", "版本信息、项目链接和更新日志。"),
            _ => ("快速归档", "将模型文件归档到共享盘专业目录。")
        };
    }

    private void ApplySelectedDiscipline(string disciplineId)
    {
        _selectedDisciplineId = disciplineId;
        UpdateChipGroup(DisciplinePanel, disciplineId);
        UpdateChipGroup(QuickDisciplinePanel, disciplineId);
    }

    private static void UpdateChipGroup(System.Windows.Controls.WrapPanel panel, string disciplineId)
    {
        foreach (var child in panel.Children.OfType<ToggleButton>())
        {
            child.IsChecked = string.Equals(child.Tag as string, disciplineId, StringComparison.Ordinal);
        }
    }

    private void AddAttachments(IEnumerable<AttachmentItem> attachments)
    {
        var existing = new HashSet<string>(_attachments.Select(item => item.Path), StringComparer.OrdinalIgnoreCase);
        foreach (var attachment in attachments)
        {
            if (existing.Add(attachment.Path))
            {
                _attachments.Add(attachment);
            }
        }

        UpdateBugStatus("");
    }

    private void ApplyHistoryFilter()
    {
        var showAll = AllRecordsToggle?.IsChecked == true;
        _visibleHistoryEntries = new ObservableCollection<SubmissionHistoryEntry>(
            showAll
                ? _historyEntries
                : _historyEntries.Where(item => item.CreatedAt.Date == DateTime.Today));
        HistoryList.ItemsSource = _visibleHistoryEntries;
    }

    private async Task<bool> SubmitCurrentAsync()
    {
        try
        {
            var entry = await ArchiveService.SubmitAsync(
                _config,
                _selectedDisciplineId,
                _config.DisplayName,
                "微信群",
                DescriptionTextBox.Text,
                ProjectNameTextBox.Text,
                _attachments.ToList());

            _historyEntries = await HistoryService.AppendAsync(entry);
            ApplyHistoryFilter();
            _attachments.Clear();
            DescriptionTextBox.Clear();
            ProjectNameTextBox.Clear();
            WidgetQuickPanel.Visibility = Visibility.Collapsed;
            UpdateBugStatus($"提交成功，已写入 {entry.TargetDirectory}");
            await RefreshWidgetBadgeAsync();
            return true;
        }
        catch (Exception error)
        {
            AppLogger.Error(error, "Main archive failed");
            UpdateBugStatus(error.Message);
            return false;
        }
    }

    private void UpdateBugStatus(string text)
    {
        BugStatusText.Text = text;
    }

    private void ChooseFiles_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new Microsoft.Win32.OpenFileDialog
        {
            Multiselect = true,
            Filter = "All files|*.*"
        };
        if (dialog.ShowDialog() == true)
        {
            AddAttachments(ArchiveService.ToAttachments(dialog.FileNames));
        }
    }

    private void PasteClipboardImage_Click(object sender, RoutedEventArgs e)
    {
        PasteClipboardImage();
    }

    private void PasteClipboardImage()
    {
        try
        {
            if (!System.Windows.Clipboard.ContainsImage())
            {
                UpdateBugStatus("剪贴板里没有图片。请先截图，再点击粘贴截图。");
                return;
            }

            var image = System.Windows.Clipboard.GetImage();
            if (image is null)
            {
                UpdateBugStatus("读取剪贴板图片失败，请重新截图后再试。");
                return;
            }

            AddAttachments([ClipboardAttachmentService.SaveBitmapSource(image)]);
            UpdateBugStatus("已从剪贴板添加截图。");
        }
        catch (Exception error)
        {
            AppLogger.Error(error, "Paste clipboard image failed");
            UpdateBugStatus(error.Message);
        }
    }

    private void MainWindow_KeyDown(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (Keyboard.Modifiers == ModifierKeys.Control && e.Key == Key.V && ArchiveView.Visibility == Visibility.Visible)
        {
            PasteClipboardImage();
            e.Handled = true;
        }
    }

    private void DropZone_DragEnter(object sender, System.Windows.DragEventArgs e)
    {
        e.Handled = true;
        DropZone.BorderBrush = System.Windows.Media.Brushes.SeaGreen;
    }

    private void DropZone_DragLeave(object sender, System.Windows.DragEventArgs e)
    {
        e.Handled = true;
        DropZone.BorderBrush = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xCF, 0xE0, 0xD7));
    }

    private void DropZone_DragOver(object sender, System.Windows.DragEventArgs e)
    {
        e.Effects = System.Windows.DragDropEffects.Copy;
        e.Handled = true;
    }

    private void DropZone_Drop(object sender, System.Windows.DragEventArgs e)
    {
        DropZone.BorderBrush = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xCF, 0xE0, 0xD7));
        if (e.Data.GetData(System.Windows.DataFormats.FileDrop) is string[] files && files.Length > 0)
        {
            AddAttachments(ArchiveService.ToAttachments(files));
        }
    }

    private void RemoveAttachment_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement { Tag: AttachmentItem attachment })
        {
            _attachments.Remove(attachment);
            if (_attachments.Count == 0)
            {
                WidgetQuickPanel.Visibility = Visibility.Collapsed;
                UpdateBugStatus("");
            }
        }
    }

    private async void Submit_Click(object sender, RoutedEventArgs e)
    {
        await SubmitCurrentAsync();
    }

    private async void QuickSubmit_Click(object sender, RoutedEventArgs e)
    {
        await SubmitCurrentAsync();
    }

    private void DismissQuickPanel_Click(object sender, RoutedEventArgs e)
    {
        WidgetQuickPanel.Visibility = Visibility.Collapsed;
    }

    private async void Settings_Click(object sender, RoutedEventArgs e)
    {
        await OpenSettingsAsync();
    }

    private void CreateShortcut_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var shortcutPath = ShortcutService.CreateDesktopShortcut();
            System.Windows.MessageBox.Show(this, $"已创建桌面快捷方式：\n{shortcutPath}", "创建成功", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception error)
        {
            System.Windows.MessageBox.Show(this, error.Message, "创建失败", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private async Task OpenSettingsAsync()
    {
        var dialog = new SettingsWindow(_config) { Owner = this };
        if (dialog.ShowDialog() == true)
        {
            _config = dialog.ResultConfig!;
            await ConfigService.SaveAsync(_config);
            await RefreshWidgetBadgeAsync();
        }
    }

    private void RefreshConfigSummary()
    {
        ConfigNameText.Text = string.IsNullOrWhiteSpace(_config.DisplayName) ? "未配置" : _config.DisplayName;
        ConfigStorageText.Text = string.IsNullOrWhiteSpace(_config.StoragePath) ? "未配置" : _config.StoragePath;
        ConfigThresholdText.Text = $"阈值 {Math.Max(1, _config.BeeSwitchThreshold)} 次";
        AboutVersionText.Text = $"v{GetCurrentVersion()}";
    }

    private async Task LoadUpdateBadgeAsync()
    {
        var state = await UpdateStateService.LoadAsync();
        var hasUpdate = state.HasUpdate && IsNewerVersion(state.LatestVersion);
        SetUpdateBadge(hasUpdate);
        if (hasUpdate && !string.IsNullOrWhiteSpace(state.LatestVersion))
        {
            UpdateStatusText.Text = $"发现新版本 v{state.LatestVersion}，可点击检查更新。";
        }
        else if (state.HasUpdate)
        {
            state.HasUpdate = false;
            await UpdateStateService.SaveAsync(state);
        }
    }

    private async Task BeginDailyUpdateCheckAsync()
    {
        try
        {
            var state = await UpdateStateService.LoadAsync();
            if (!UpdateStateService.ShouldCheckToday(state))
            {
                return;
            }

            var update = await UpdateService.CheckLatestAsync();
            var latestState = UpdateStateService.FromCheckResult(update);
            await UpdateStateService.SaveAsync(latestState);

            await Dispatcher.InvokeAsync(() =>
            {
                SetUpdateBadge(latestState.HasUpdate);
                if (latestState.HasUpdate)
                {
                    UpdateStatusText.Text = $"发现新版本 v{latestState.LatestVersion}，可点击检查更新。";
                }
                else if (AboutView.Visibility == Visibility.Visible)
                {
                    UpdateStatusText.Text = $"当前已是最新版本 v{update.CurrentVersion}。";
                }
            });
        }
        catch (Exception error)
        {
            AppLogger.Error(error, "Daily update check failed");
        }
    }

    private void SetUpdateBadge(bool hasUpdate)
    {
        var visibility = hasUpdate ? Visibility.Visible : Visibility.Collapsed;
        AboutNewBadge.Visibility = visibility;
        UpdateNewBadge.Visibility = visibility;
    }

    private static bool IsNewerVersion(string latestVersion) =>
        Version.TryParse(latestVersion.Trim().TrimStart('v', 'V'), out var latest)
        && Version.TryParse(GetCurrentVersion(), out var current)
        && latest.CompareTo(current) > 0;

    private void OpenProject_Click(object sender, RoutedEventArgs e)
    {
        OpenUrl("https://github.com/JOKER120YL/ClueVault");
    }

    private async void CheckUpdate_Click(object sender, RoutedEventArgs e)
    {
        CheckUpdateButton.IsEnabled = false;
        UpdateStatusText.Text = "正在检查 GitHub Releases...";

        try
        {
            var update = await UpdateService.CheckLatestAsync();
            await UpdateStateService.SaveAsync(UpdateStateService.FromCheckResult(update));
            SetUpdateBadge(update.HasUpdate);

            if (!update.HasUpdate)
            {
                UpdateStatusText.Text = $"当前已是最新版本 v{update.CurrentVersion}。";
                return;
            }

            if (string.IsNullOrWhiteSpace(update.DownloadUrl))
            {
                UpdateStatusText.Text = $"发现新版本 v{update.LatestVersion}，但没有找到 Windows x64 zip 发布包。";
                OpenUrl(update.ReleaseUrl);
                return;
            }

            var confirm = System.Windows.MessageBox.Show(
                this,
                $"发现新版本 v{update.LatestVersion}。\n\n是否现在下载并更新？程序会自动退出、覆盖文件并重启。",
                "发现更新",
                MessageBoxButton.YesNo,
                MessageBoxImage.Information);

            if (confirm != MessageBoxResult.Yes)
            {
                UpdateStatusText.Text = $"已取消更新。可稍后进入关于页面重新检查。";
                return;
            }

            var progress = new Progress<string>(message => UpdateStatusText.Text = message);
            var zipPath = await UpdateService.DownloadUpdateAsync(update, progress);
            UpdateStatusText.Text = "下载完成，正在启动更新器...";
            UpdateService.StartUpdaterAndExit(zipPath);

            if (System.Windows.Application.Current is App app)
            {
                app.ExitApplication();
            }
        }
        catch (Exception error)
        {
            UpdateStatusText.Text = "检查或更新失败。";
            var open = System.Windows.MessageBox.Show(
                this,
                $"{error.Message}\n\n是否打开 GitHub Releases 手动下载？",
                "更新失败",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);
            if (open == MessageBoxResult.Yes)
            {
                OpenUrl("https://github.com/JOKER120YL/ClueVault/releases");
            }
        }
        finally
        {
            CheckUpdateButton.IsEnabled = true;
        }
    }

    private static void OpenUrl(string url)
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = url,
            UseShellExecute = true
        });
    }

    private static string GetCurrentVersion() =>
        Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.0.0";

    private async void EditHistory_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not FrameworkElement { Tag: SubmissionHistoryEntry entry })
        {
            return;
        }

        var dialog = new EditSubmissionWindow(entry) { Owner = this };
        if (dialog.ShowDialog() == true)
        {
            _historyEntries = await HistoryService.UpdateAsync(entry, dialog.ProjectNameValue, dialog.DescriptionValue);
            ApplyHistoryFilter();
        }
    }

    private void RecordsFilter_Checked(object sender, RoutedEventArgs e)
    {
        if (sender == TodayRecordsToggle && TodayRecordsToggle.IsChecked == true)
        {
            AllRecordsToggle.IsChecked = false;
        }
        else if (sender == AllRecordsToggle && AllRecordsToggle.IsChecked == true)
        {
            TodayRecordsToggle.IsChecked = false;
        }

        if (TodayRecordsToggle.IsChecked != true && AllRecordsToggle.IsChecked != true)
        {
            TodayRecordsToggle.IsChecked = true;
        }

        ApplyHistoryFilter();
    }
}
