using System.Windows;
using ClueVault.Desktop.Infrastructure;

namespace ClueVault.Desktop;

public partial class SettingsWindow : Window
{
    public AppConfig? ResultConfig { get; private set; }

    public SettingsWindow(AppConfig config)
    {
        InitializeComponent();
        DisplayNameTextBox.Text = config.DisplayName;
        StoragePathTextBox.Text = config.StoragePath;
        ThresholdTextBox.Text = Math.Max(1, config.BeeSwitchThreshold).ToString();
    }

    private void Save_Click(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(DisplayNameTextBox.Text))
        {
            System.Windows.MessageBox.Show(this, "请先填写姓名或昵称。", "提示", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        if (string.IsNullOrWhiteSpace(StoragePathTextBox.Text))
        {
            System.Windows.MessageBox.Show(this, "请先填写共享目录。", "提示", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        ResultConfig = new AppConfig
        {
            DisplayName = DisplayNameTextBox.Text.Trim(),
            StoragePath = StoragePathTextBox.Text.Trim(),
            BeeSwitchThreshold = int.TryParse(ThresholdTextBox.Text, out var threshold) ? Math.Max(1, threshold) : 1
        };

        DialogResult = true;
        Close();
    }

    private void Cancel_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

}
