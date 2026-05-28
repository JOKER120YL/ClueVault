using System.Collections.ObjectModel;

namespace ClueVault.Desktop.Infrastructure;

public sealed class AppConfig
{
    public string DisplayName { get; set; } = "";
    public string StoragePath { get; set; } = @"W:\2-测试组\#测试文件\01-运营收集";
    public int BeeSwitchThreshold { get; set; } = 1;
    public bool FloatingWidgetEnabled { get; set; } = true;
}

public sealed class DisciplineOption
{
    public required string Id { get; init; }
    public required string Label { get; init; }
    public required string FolderName { get; init; }
}

public sealed class AttachmentItem
{
    public required string Path { get; init; }
    public required string Name { get; init; }
    public required string Role { get; init; }
}

public sealed class SubmissionHistoryEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Title { get; set; } = "用户模型归档";
    public string Description { get; set; } = "";
    public string ProjectName { get; set; } = "";
    public string Source { get; set; } = "微信群";
    public string Submitter { get; set; } = "";
    public string DisciplineId { get; set; } = "other";
    public string DisciplineLabel { get; set; } = "其他";
    public string FolderName { get; set; } = "";
    public string TargetDirectory { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
    public List<AttachmentItem> Attachments { get; set; } = [];
}

public sealed class SubmissionHistoryStore
{
    public ObservableCollection<SubmissionHistoryEntry> Entries { get; set; } = [];
}

public sealed class WidgetState
{
    public string CurrentAvatar { get; init; } = "frogdii-idle";
    public string CurrentAvatarLabel { get; init; } = "蛙弟";
    public string CurrentAvatarAsset { get; init; } = "frogdii-idle.png";
    public int TodayCount { get; init; }
    public int Threshold { get; init; } = 1;
    public int AngerLevel { get; init; }
}

public sealed class UpdateCheckResult
{
    public bool HasUpdate { get; init; }
    public string CurrentVersion { get; init; } = "";
    public string LatestVersion { get; init; } = "";
    public string ReleaseUrl { get; init; } = "";
    public string ReleaseNotes { get; init; } = "";
    public string DownloadUrl { get; init; } = "";
    public string AssetName { get; init; } = "";
}
