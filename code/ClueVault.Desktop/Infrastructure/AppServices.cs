using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace ClueVault.Desktop.Infrastructure;

public static class DisciplineCatalog
{
    public static readonly IReadOnlyList<DisciplineOption> Options =
    [
        new() { Id = "architecture", Label = "建筑", FolderName = "建筑" },
        new() { Id = "structure", Label = "结构", FolderName = "结构" },
        new() { Id = "hvac", Label = "暖通", FolderName = "暖通" },
        new() { Id = "plumbing", Label = "给排水", FolderName = "给排水" },
        new() { Id = "electrical", Label = "电气", FolderName = "电气" },
        new() { Id = "other", Label = "其他", FolderName = "其他" }
    ];

    public static DisciplineOption GetById(string? id) =>
        Options.FirstOrDefault(item => item.Id == id) ?? Options[^1];
}

public static class AppPaths
{
    public static string UserDataDirectory =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ClueVaultDesktop");

    public static string ConfigPath => Path.Combine(UserDataDirectory, "config.json");
    public static string HistoryPath => Path.Combine(UserDataDirectory, "submission-history.json");
    public static string StatsPath => Path.Combine(UserDataDirectory, "submission-stats.json");
}

public static class ShortcutService
{
    public static string CreateDesktopShortcut()
    {
        var executablePath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(executablePath) || !File.Exists(executablePath))
        {
            executablePath = Path.Combine(AppContext.BaseDirectory, "ClueVault.Desktop.exe");
        }

        if (!File.Exists(executablePath))
        {
            throw new FileNotFoundException("未找到 ClueVault.Desktop.exe。");
        }

        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        var shortcutPath = Path.Combine(desktop, "ClueVault.lnk");
        var shellType = Type.GetTypeFromProgID("WScript.Shell")
            ?? throw new InvalidOperationException("当前系统不支持创建快捷方式。");
        dynamic shell = Activator.CreateInstance(shellType)
            ?? throw new InvalidOperationException("无法创建快捷方式。");
        dynamic shortcut = shell.CreateShortcut(shortcutPath);
        shortcut.TargetPath = executablePath;
        shortcut.WorkingDirectory = Path.GetDirectoryName(executablePath) ?? AppContext.BaseDirectory;
        shortcut.IconLocation = $"{executablePath},0";
        shortcut.Save();

        return shortcutPath;
    }
}

public static class ConfigService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public static async Task<AppConfig> LoadAsync()
    {
        Directory.CreateDirectory(AppPaths.UserDataDirectory);
        if (!File.Exists(AppPaths.ConfigPath))
        {
            var defaults = new AppConfig();
            await SaveAsync(defaults);
            return defaults;
        }

        var raw = await File.ReadAllTextAsync(AppPaths.ConfigPath, Encoding.UTF8);
        return JsonSerializer.Deserialize<AppConfig>(raw) ?? new AppConfig();
    }

    public static async Task SaveAsync(AppConfig config)
    {
        Directory.CreateDirectory(AppPaths.UserDataDirectory);
        var payload = JsonSerializer.Serialize(config, JsonOptions);
        await File.WriteAllTextAsync(AppPaths.ConfigPath, payload, Encoding.UTF8);
    }
}

public static class StatsService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private sealed class StatsPayload
    {
        public Dictionary<string, int> DailyCounts { get; set; } = [];
    }

    public static async Task<WidgetState> GetWidgetStateAsync(AppConfig config)
    {
        var count = await GetTodayCountAsync();
        var threshold = Math.Max(1, config.BeeSwitchThreshold);
        var angerLevel = GetAngerLevel(count, threshold);
        var avatar = GetAvatarState(angerLevel);
        return new WidgetState
        {
            CurrentAvatar = avatar.Id,
            CurrentAvatarLabel = avatar.Label,
            CurrentAvatarAsset = avatar.AssetName,
            TodayCount = count,
            Threshold = threshold,
            AngerLevel = angerLevel
        };
    }

    public static async Task<int> GetTodayCountAsync()
    {
        var payload = await LoadAsync();
        return payload.DailyCounts.GetValueOrDefault(GetTodayKey());
    }

    public static async Task RecordSubmissionAsync()
    {
        var payload = await LoadAsync();
        var key = GetTodayKey();
        payload.DailyCounts[key] = payload.DailyCounts.GetValueOrDefault(key) + 1;
        await SaveAsync(payload);
    }

    private static async Task<StatsPayload> LoadAsync()
    {
        Directory.CreateDirectory(AppPaths.UserDataDirectory);
        if (!File.Exists(AppPaths.StatsPath))
        {
            var defaults = new StatsPayload();
            await SaveAsync(defaults);
            return defaults;
        }

        var raw = await File.ReadAllTextAsync(AppPaths.StatsPath, Encoding.UTF8);
        return JsonSerializer.Deserialize<StatsPayload>(raw) ?? new StatsPayload();
    }

    private static Task SaveAsync(StatsPayload payload) =>
        File.WriteAllTextAsync(AppPaths.StatsPath, JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8);

    private static string GetTodayKey()
    {
        var now = DateTime.Now;
        return $"{now:yyyy-MM-dd}";
    }

    private static int GetAngerLevel(int count, int threshold)
    {
        if (count < threshold)
        {
            return 0;
        }

        if (count < threshold + 3)
        {
            return 1;
        }

        if (count < threshold + 6)
        {
            return 2;
        }

        return 3;
    }

    private static (string Id, string Label, string AssetName) GetAvatarState(int angerLevel) =>
        angerLevel switch
        {
            0 => ("frogdii-idle", "蛙弟", "frogdii-idle.png"),
            1 => ("ebee-stern", "蜂哥", "ebee-stern.png"),
            2 => ("ebee-angry-overload", "蜂哥怒了", "ebee-angry-overload.png"),
            _ => ("ebee-breakdown", "蜂哥崩溃", "ebee-breakdown.png")
        };
}

public static class HistoryService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public static async Task<ObservableCollection<SubmissionHistoryEntry>> LoadAsync()
    {
        Directory.CreateDirectory(AppPaths.UserDataDirectory);
        if (!File.Exists(AppPaths.HistoryPath))
        {
            await SaveAsync([]);
            return [];
        }

        var raw = await File.ReadAllTextAsync(AppPaths.HistoryPath, Encoding.UTF8);
        var entries = JsonSerializer.Deserialize<List<SubmissionHistoryEntry>>(raw) ?? [];
        return new ObservableCollection<SubmissionHistoryEntry>(entries.OrderByDescending(item => item.UpdatedAt));
    }

    public static async Task SaveAsync(IEnumerable<SubmissionHistoryEntry> entries)
    {
        Directory.CreateDirectory(AppPaths.UserDataDirectory);
        var payload = JsonSerializer.Serialize(entries.ToList(), JsonOptions);
        await File.WriteAllTextAsync(AppPaths.HistoryPath, payload, Encoding.UTF8);
    }

    public static async Task<ObservableCollection<SubmissionHistoryEntry>> AppendAsync(SubmissionHistoryEntry entry)
    {
        var entries = await LoadAsync();
        entries.Insert(0, entry);
        while (entries.Count > 120)
        {
            entries.RemoveAt(entries.Count - 1);
        }

        await SaveAsync(entries);
        return entries;
    }

    public static async Task<ObservableCollection<SubmissionHistoryEntry>> UpdateAsync(
        SubmissionHistoryEntry current,
        string projectName,
        string description)
    {
        current.ProjectName = projectName.Trim();
        current.Description = description.Trim();
        current.Title = "用户模型归档";
        current.UpdatedAt = DateTime.Now;

        await ArchiveService.WriteArchiveInfoAsync(current);

        var entries = await LoadAsync();
        var existing = entries.FirstOrDefault(item => item.Id == current.Id);
        if (existing is not null)
        {
            var index = entries.IndexOf(existing);
            entries[index] = current;
        }

        await SaveAsync(entries);
        return new ObservableCollection<SubmissionHistoryEntry>(entries.OrderByDescending(item => item.UpdatedAt));
    }
}

public static class ArchiveService
{
    private static readonly string[] ImageExtensions = [".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp"];
    private static readonly string[] ModelExtensions = [".rvt", ".rfa", ".ifc", ".skp", ".dwg", ".nwd", ".fbx", ".obj", ".3dm", ".eb", ".zip"];

    public static IReadOnlyList<AttachmentItem> ToAttachments(IEnumerable<string> filePaths) =>
        filePaths
            .Where(File.Exists)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(path => new AttachmentItem
            {
                Path = path,
                Name = Path.GetFileName(path),
                Role = InferRole(path)
            })
            .ToList();

    public static async Task<SubmissionHistoryEntry> SubmitAsync(
        AppConfig config,
        string disciplineId,
        string submitter,
        string source,
        string description,
        string projectName,
        IReadOnlyList<AttachmentItem> attachments)
    {
        if (attachments.Count == 0)
        {
            throw new InvalidOperationException("请先添加至少一个附件。");
        }

        if (string.IsNullOrWhiteSpace(config.StoragePath))
        {
            throw new InvalidOperationException("请先在设置里填写共享目录。");
        }

        if (string.IsNullOrWhiteSpace(submitter))
        {
            throw new InvalidOperationException("请先在设置里填写姓名或昵称。");
        }

        var discipline = DisciplineCatalog.GetById(disciplineId);
        EnsureStorageWritable(config.StoragePath);
        var disciplineDirectory = Path.Combine(config.StoragePath, discipline.FolderName);
        Directory.CreateDirectory(disciplineDirectory);

        var createdAt = DateTime.Now;
        var title = "用户模型归档";
        var folderName = BuildFolderName(createdAt, source, submitter, projectName);
        var targetDirectory = Path.Combine(disciplineDirectory, folderName);
        Directory.CreateDirectory(targetDirectory);

        foreach (var attachment in attachments)
        {
            File.Copy(attachment.Path, Path.Combine(targetDirectory, attachment.Name), overwrite: true);
        }

        var entry = new SubmissionHistoryEntry
        {
            Title = title,
            Description = description.Trim(),
            ProjectName = projectName.Trim(),
            Source = string.IsNullOrWhiteSpace(source) ? "微信群" : source.Trim(),
            Submitter = submitter.Trim(),
            DisciplineId = discipline.Id,
            DisciplineLabel = discipline.Label,
            FolderName = folderName,
            TargetDirectory = targetDirectory,
            Attachments = attachments.ToList(),
            CreatedAt = createdAt,
            UpdatedAt = createdAt
        };

        await WriteArchiveInfoAsync(entry);
        await StatsService.RecordSubmissionAsync();
        return entry;
    }

    public static async Task WriteArchiveInfoAsync(SubmissionHistoryEntry entry)
    {
        var markdown = RenderArchiveInfoMarkdown(entry);
        await File.WriteAllTextAsync(Path.Combine(entry.TargetDirectory, "归档信息.md"), markdown, Encoding.UTF8);
    }

    public static string RenderArchiveInfoMarkdown(SubmissionHistoryEntry entry)
    {
        var attachmentLines = entry.Attachments.Count == 0
            ? "- 无"
            : string.Join(Environment.NewLine, entry.Attachments.Select(item => $"- {item.Name} ({item.Role})"));

        return string.Join(
            Environment.NewLine,
            new string?[]
            {
                "# 用户模型归档",
                "",
                $"- 归档时间: {entry.CreatedAt:yyyy-MM-dd HH:mm:ss}",
                $"- 归档人: {entry.Submitter}",
                $"- 来源: {entry.Source}",
                $"- 专业: {entry.DisciplineLabel}",
                string.IsNullOrWhiteSpace(entry.ProjectName) ? null : $"- 项目名: {entry.ProjectName}",
                string.IsNullOrWhiteSpace(entry.Description) ? null : $"- 备注: {entry.Description}",
                "",
                "## 附件清单",
                attachmentLines,
                ""
            }.Where(line => line is not null));
    }

    private static string BuildFolderName(DateTime createdAt, string source, string submitter, string projectName)
    {
        var safeSource = NormalizeFileName(source);
        var safeSubmitter = NormalizeFileName(submitter);
        var safeProject = NormalizeFileName(projectName);
        var prefix = string.IsNullOrWhiteSpace(safeProject)
            ? $"{createdAt:yyyy-MM-dd}_{safeSource}_{safeSubmitter}"
            : $"{createdAt:yyyy-MM-dd}_{safeSource}_{safeSubmitter}_{safeProject}";

        return $"{prefix}_{createdAt:HHmmss}";
    }

    private static string NormalizeFileName(string input)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var cleaned = new string(input.Select(ch => invalid.Contains(ch) ? ' ' : ch).ToArray());
        cleaned = string.Join(" ", cleaned.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return string.IsNullOrWhiteSpace(cleaned) ? "" : cleaned[..Math.Min(cleaned.Length, 60)];
    }

    private static string InferRole(string filePath)
    {
        var extension = Path.GetExtension(filePath).ToLowerInvariant();
        if (ImageExtensions.Contains(extension))
        {
            return "image";
        }

        return ModelExtensions.Contains(extension) ? "model" : "other";
    }

    private static void EnsureStorageWritable(string storagePath)
    {
        Directory.CreateDirectory(storagePath);
        var testDirectory = Path.Combine(storagePath, $".cluevault-write-test-{Guid.NewGuid():N}");
        Directory.CreateDirectory(testDirectory);
        Directory.Delete(testDirectory);
    }
}
