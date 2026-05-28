using System.Windows;
using System.Windows.Controls.Primitives;
using System.Linq;
using ClueVault.Desktop.Infrastructure;

namespace ClueVault.Desktop;

public partial class QuickArchiveWindow : Window
{
    public string SelectedDisciplineId { get; private set; }
    public string ProjectNameValue => ProjectNameTextBox.Text.Trim();
    public string SourceValue => string.IsNullOrWhiteSpace(SourceTextBox.Text) ? "微信群" : SourceTextBox.Text.Trim();
    public string RemarkValue => RemarkTextBox.Text.Trim();

    public QuickArchiveWindow(IReadOnlyList<AttachmentItem> attachments, string selectedDisciplineId)
    {
        InitializeComponent();
        SelectedDisciplineId = selectedDisciplineId;
        AttachmentList.ItemsSource = attachments;
        SummaryText.Text = $"已收到 {attachments.Count} 个文件。选专业后即可归档，项目名、来源和备注都可以不填。";
        BuildDisciplineButtons();
    }

    public QuickArchiveWindow(int attachmentCount, string selectedDisciplineId)
        : this([], selectedDisciplineId)
    {
        SummaryText.Text = $"已收到 {attachmentCount} 个文件。选专业后即可归档，项目名、来源和备注都可以不填。";
    }

    private void BuildDisciplineButtons()
    {
        DisciplinePanel.Children.Clear();
        foreach (var option in DisciplineCatalog.Options)
        {
            var button = new ToggleButton
            {
                Content = option.Label,
                Tag = option.Id,
                Margin = new Thickness(0, 0, 8, 8),
                Padding = new Thickness(12, 7, 12, 7),
                MinWidth = 68
            };

            button.Checked += (_, _) =>
            {
                SelectedDisciplineId = (string)button.Tag;
                foreach (var sibling in DisciplinePanel.Children.OfType<ToggleButton>())
                {
                    sibling.IsChecked = ReferenceEquals(sibling, button);
                    sibling.Background = sibling.IsChecked == true ? new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0x1C, 0x6C, 0x59)) : new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xFF, 0xF9, 0xF1));
                    sibling.Foreground = sibling.IsChecked == true ? System.Windows.Media.Brushes.White : new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0x21, 0x47, 0x3D));
                    sibling.BorderBrush = sibling.IsChecked == true ? sibling.Background : new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xD8, 0xC9, 0xB7));
                }
            };

            button.Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xFF, 0xF9, 0xF1));
            button.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0x21, 0x47, 0x3D));
            button.BorderBrush = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xD8, 0xC9, 0xB7));
            button.BorderThickness = new Thickness(1);

            DisciplinePanel.Children.Add(button);
            if (option.Id == SelectedDisciplineId)
            {
                button.IsChecked = true;
            }
        }
    }

    private void Submit_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = true;
        Close();
    }

    private void Cancel_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }
}
