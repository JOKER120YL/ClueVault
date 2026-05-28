using System.Windows;
using ClueVault.Desktop.Infrastructure;

namespace ClueVault.Desktop;

public partial class EditSubmissionWindow : Window
{
    public string ProjectNameValue => ProjectNameTextBox.Text.Trim();
    public string DescriptionValue => DescriptionTextBox.Text.Trim();

    public EditSubmissionWindow(SubmissionHistoryEntry entry)
    {
        InitializeComponent();
        TitleText.Text = entry.Title;
        ProjectNameTextBox.Text = entry.ProjectName;
        DescriptionTextBox.Text = entry.Description;
    }

    private void Save_Click(object sender, RoutedEventArgs e)
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
