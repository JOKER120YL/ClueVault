using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Windows.Media.Imaging;

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
    public static string UpdateStatePath => Path.Combine(UserDataDirectory, "update-state.json");
    public static string LogPath => Path.Combine(UserDataDirectory, "cluevault.log");
    public static string ClipboardAttachmentDirectory => Path.Combine(UserDataDirectory, "clipboard-attachments");
}

public static class AppLogger
{
    private static readonly object SyncRoot = new();

    public static void Info(string message) => Write("INFO", message);

    public static void Error(Exception error, string context) =>
        Write("ERROR", $"{context}{Environment.NewLine}{error}");

    private static void Write(string level, string message)
    {
        try
        {
            Directory.CreateDirectory(AppPaths.UserDataDirectory);
            var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [{level}] {message}{Environment.NewLine}";
            lock (SyncRoot)
            {
                File.AppendAllText(AppPaths.LogPath, line, Encoding.UTF8);
            }
        }
        catch
        {
            // Logging must never block the main workflow.
        }
    }
}

public static class ClipboardAttachmentService
{
    public static AttachmentItem SaveBitmapSource(BitmapSource bitmapSource)
    {
        Directory.CreateDirectory(AppPaths.ClipboardAttachmentDirectory);
        var fileName = $"聊天截图_{DateTime.Now:yyyyMMdd_HHmmss}.png";
        var path = Path.Combine(AppPaths.ClipboardAttachmentDirectory, fileName);

        using var stream = File.Create(path);
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(bitmapSource));
        encoder.Save(stream);

        AppLogger.Info($"Saved clipboard image attachment: {path}");
        return new AttachmentItem
        {
            Path = path,
            Name = fileName,
            Role = "image"
        };
    }
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

public static class UpdateService
{
    private const string LatestReleaseApiUrl = "https://api.github.com/repos/JOKER120YL/ClueVault/releases/latest";
    private const string ReleaseAssetName = "ClueVault-v";
    private static readonly HttpClient HttpClient = CreateHttpClient();

    public static async Task<UpdateCheckResult> CheckLatestAsync()
    {
        try
        {
            return await CheckLatestFromApiAsync();
        }
        catch
        {
            return await CheckLatestFromLatestRedirectAsync();
        }
    }

    private static async Task<UpdateCheckResult> CheckLatestFromApiAsync()
    {
        using var response = await HttpClient.GetAsync(LatestReleaseApiUrl);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);
        var root = document.RootElement;
        var tagName = root.GetProperty("tag_name").GetString() ?? "";
        var latestVersion = NormalizeVersion(tagName);
        var currentVersion = GetCurrentVersion();
        var asset = FindWindowsZipAsset(root);
        var hasUpdate = TryParseVersion(latestVersion, out var latest)
            && TryParseVersion(currentVersion, out var current)
            && latest.CompareTo(current) > 0;

        return new UpdateCheckResult
        {
            HasUpdate = hasUpdate,
            CurrentVersion = currentVersion,
            LatestVersion = latestVersion,
            ReleaseUrl = root.GetProperty("html_url").GetString() ?? "",
            ReleaseNotes = root.TryGetProperty("body", out var body) ? body.GetString() ?? "" : "",
            DownloadUrl = asset.DownloadUrl,
            AssetName = asset.Name
        };
    }

    private static async Task<UpdateCheckResult> CheckLatestFromLatestRedirectAsync()
    {
        using var response = await HttpClient.GetAsync("https://github.com/JOKER120YL/ClueVault/releases/latest");
        response.EnsureSuccessStatusCode();

        var latestUri = response.RequestMessage?.RequestUri?.ToString() ?? "";
        var marker = "/releases/tag/";
        var markerIndex = latestUri.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (markerIndex < 0)
        {
            throw new InvalidOperationException("无法识别 GitHub 最新版本地址。");
        }

        var tagName = Uri.UnescapeDataString(latestUri[(markerIndex + marker.Length)..]).Trim('/');
        var latestVersion = NormalizeVersion(tagName);
        var currentVersion = GetCurrentVersion();
        var assetName = $"ClueVault-v{latestVersion}-win-x64.zip";
        var downloadUrl = $"https://github.com/JOKER120YL/ClueVault/releases/download/{tagName}/{assetName}";
        var hasUpdate = TryParseVersion(latestVersion, out var latest)
            && TryParseVersion(currentVersion, out var current)
            && latest.CompareTo(current) > 0;

        return new UpdateCheckResult
        {
            HasUpdate = hasUpdate,
            CurrentVersion = currentVersion,
            LatestVersion = latestVersion,
            ReleaseUrl = latestUri,
            ReleaseNotes = "",
            DownloadUrl = downloadUrl,
            AssetName = assetName
        };
    }

    public static async Task<string> DownloadUpdateAsync(UpdateCheckResult update, IProgress<string>? progress = null)
    {
        if (string.IsNullOrWhiteSpace(update.DownloadUrl))
        {
            throw new InvalidOperationException("最新 Release 中没有找到 Windows x64 zip 发布包。");
        }

        var updateDirectory = Path.Combine(AppPaths.UserDataDirectory, "updates", update.LatestVersion);
        Directory.CreateDirectory(updateDirectory);
        var zipPath = Path.Combine(updateDirectory, update.AssetName);

        progress?.Report("正在下载更新包...");
        using var response = await HttpClient.GetAsync(update.DownloadUrl, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        await using var source = await response.Content.ReadAsStreamAsync();
        await using var target = File.Create(zipPath);
        await source.CopyToAsync(target);

        return zipPath;
    }

    public static void StartUpdaterAndExit(string zipPath)
    {
        var appDirectory = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var executablePath = Environment.ProcessPath ?? Path.Combine(appDirectory, "ClueVault.Desktop.exe");
        var scriptPath = Path.Combine(AppPaths.UserDataDirectory, "updates", "apply-update.ps1");
        var processId = Environment.ProcessId;
        Directory.CreateDirectory(Path.GetDirectoryName(scriptPath)!);

        var script = RenderUpdateScript(zipPath, appDirectory, executablePath, processId);
        File.WriteAllText(scriptPath, script, Encoding.UTF8);

        Process.Start(new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{scriptPath}\"",
            UseShellExecute = true,
            WorkingDirectory = appDirectory,
            WindowStyle = ProcessWindowStyle.Normal
        });
    }

    private static HttpClient CreateHttpClient()
    {
        var client = new HttpClient();
        client.DefaultRequestHeaders.UserAgent.ParseAdd($"ClueVaultDesktop/{GetCurrentVersion()}");
        client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
        return client;
    }

    private static (string Name, string DownloadUrl) FindWindowsZipAsset(JsonElement releaseRoot)
    {
        if (!releaseRoot.TryGetProperty("assets", out var assets) || assets.ValueKind != JsonValueKind.Array)
        {
            return ("", "");
        }

        foreach (var asset in assets.EnumerateArray())
        {
            var name = asset.GetProperty("name").GetString() ?? "";
            if (name.StartsWith(ReleaseAssetName, StringComparison.OrdinalIgnoreCase)
                && name.EndsWith("-win-x64.zip", StringComparison.OrdinalIgnoreCase))
            {
                return (name, asset.GetProperty("browser_download_url").GetString() ?? "");
            }
        }

        return ("", "");
    }

    private static string GetCurrentVersion() =>
        Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.0.0";

    private static string NormalizeVersion(string tagName) =>
        tagName.Trim().TrimStart('v', 'V');

    private static bool TryParseVersion(string value, out Version version) =>
        Version.TryParse(NormalizeVersion(value), out version!);

    private static string RenderUpdateScript(string zipPath, string appDirectory, string executablePath, int processId)
    {
        var extractDirectory = Path.Combine(AppPaths.UserDataDirectory, "updates", "extract");
        var logPath = Path.Combine(AppPaths.UserDataDirectory, "updates", "update.log");
        var script = """
$ErrorActionPreference = 'Stop'
$zipPath = '__ZIP_PATH__'
$appDirectory = '__APP_DIRECTORY__'
$executablePath = '__EXE_PATH__'
$extractDirectory = '__EXTRACT_DIRECTORY__'
$logPath = '__LOG_PATH__'
$targetProcessId = __PROCESS_ID__

function Write-UpdateLog([string]$message) {
    $line = "[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $message
    Write-Host $message
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
}

try {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logPath) | Out-Null
    Write-UpdateLog "ClueVault updater started."
    Write-UpdateLog "Zip: $zipPath"
    Write-UpdateLog "AppDir: $appDirectory"

    if (Get-Process -Id $targetProcessId -ErrorAction SilentlyContinue) {
        Write-UpdateLog "Waiting for ClueVault process $targetProcessId to exit..."
        Wait-Process -Id $targetProcessId -Timeout 60 -ErrorAction SilentlyContinue
    }

    if (Test-Path -LiteralPath $extractDirectory) {
        Remove-Item -LiteralPath $extractDirectory -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $extractDirectory | Out-Null

    Write-UpdateLog "Extracting update package..."
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDirectory -Force

    $sourceExe = Get-ChildItem -LiteralPath $extractDirectory -Filter 'ClueVault.Desktop.exe' -Recurse -File | Select-Object -First 1
    if ($null -eq $sourceExe) {
        throw "ClueVault.Desktop.exe was not found in the update package."
    }

    $sourceDirectory = $sourceExe.DirectoryName
    Write-UpdateLog "Copying files from $sourceDirectory..."
    Get-ChildItem -LiteralPath $sourceDirectory -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $appDirectory -Recurse -Force
    }

    Write-UpdateLog "Restarting ClueVault..."
    Start-Process -FilePath $executablePath -WorkingDirectory $appDirectory
    Write-UpdateLog "Update completed."
    exit 0
}
catch {
    Write-UpdateLog "Update failed: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "更新失败。日志位置：$logPath"
    Write-Host "请把这个窗口截图或把 update.log 发给负责人。"
    Read-Host "按 Enter 关闭"
    exit 1
}
""";
        return script
            .Replace("__ZIP_PATH__", EscapePowerShellSingleQuotedString(zipPath), StringComparison.Ordinal)
            .Replace("__APP_DIRECTORY__", EscapePowerShellSingleQuotedString(appDirectory), StringComparison.Ordinal)
            .Replace("__EXE_PATH__", EscapePowerShellSingleQuotedString(executablePath), StringComparison.Ordinal)
            .Replace("__EXTRACT_DIRECTORY__", EscapePowerShellSingleQuotedString(extractDirectory), StringComparison.Ordinal)
            .Replace("__LOG_PATH__", EscapePowerShellSingleQuotedString(logPath), StringComparison.Ordinal)
            .Replace("__PROCESS_ID__", processId.ToString(), StringComparison.Ordinal);
    }

    private static string EscapePowerShellSingleQuotedString(string value) =>
        value.Replace("'", "''", StringComparison.Ordinal);
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

public static class UpdateStateService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public static async Task<UpdateState> LoadAsync()
    {
        Directory.CreateDirectory(AppPaths.UserDataDirectory);
        if (!File.Exists(AppPaths.UpdateStatePath))
        {
            return new UpdateState();
        }

        try
        {
            var raw = await File.ReadAllTextAsync(AppPaths.UpdateStatePath, Encoding.UTF8);
            return JsonSerializer.Deserialize<UpdateState>(raw) ?? new UpdateState();
        }
        catch (Exception error)
        {
            AppLogger.Error(error, "Load update state failed");
            return new UpdateState();
        }
    }

    public static async Task SaveAsync(UpdateState state)
    {
        Directory.CreateDirectory(AppPaths.UserDataDirectory);
        var payload = JsonSerializer.Serialize(state, JsonOptions);
        await File.WriteAllTextAsync(AppPaths.UpdateStatePath, payload, Encoding.UTF8);
    }

    public static bool ShouldCheckToday(UpdateState state) =>
        state.LastCheckedAt.Date != DateTime.Today;

    public static UpdateState FromCheckResult(UpdateCheckResult result) =>
        new()
        {
            LastCheckedAt = DateTime.Now,
            HasUpdate = result.HasUpdate,
            LatestVersion = result.LatestVersion,
            ReleaseUrl = result.ReleaseUrl
        };
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

    public static async Task<ObservableCollection<SubmissionHistoryEntry>> LoadTodayAsync()
    {
        var entries = await LoadAsync();
        var today = DateTime.Today;
        return new ObservableCollection<SubmissionHistoryEntry>(
            entries.Where(item => item.CreatedAt.Date == today));
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
