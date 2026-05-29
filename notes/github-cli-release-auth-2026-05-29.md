# GitHub CLI 认证与 Release 上传排障记录

## 背景

在 Windows 本地开发环境中，使用 GitHub CLI 为项目创建 Release 并上传安装包时，遇到两类问题：

- `gh auth status` 在普通命令环境中显示 token invalid。
- 已完成网页或 device code 授权后，另一个进程仍读取不到正确认证状态。
- 一次性 `gh release create` 携带多个大附件时，大文件上传可能超时，导致草稿 Release 或附件状态异常。

## 结论

如果 Codex、PowerShell、Git Bash、其他 Agent 或插件运行在不同权限/沙箱环境中，`gh` 读取 Windows keyring 的结果可能不同。

普通命令里看到：

```text
The token in default is invalid.
```

不一定代表 GitHub CLI 没授权成功，也可能是当前进程读不到 Windows 凭据管理器。

需要用固定路径和外部权限验证：

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth status
```

如果显示：

```text
Logged in to github.com account <user> (keyring)
Token scopes: 'gist', 'read:org', 'repo'
```

说明认证本身正常，可以继续使用 GitHub CLI 操作 Release。

## 推荐处理流程

1. 固定使用完整路径调用 GitHub CLI，避免 PATH 中存在多个 `gh`。

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth status
```

2. 如果当前账号 token invalid，先清掉无效记录。

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth logout -h github.com -u <user>
```

3. 优先使用 device code 或明确的网页登录流程重新授权。

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth login --hostname github.com --git-protocol https --web
```

4. 授权后立刻在同一个环境中验证。

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth status
```

5. 创建 Release 时，先创建不带附件的正式 Release。

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" release create v0.0.0 --repo owner/repo --target main --title "Project v0.0.0" --notes-file "docs\release-v0.0.0.md" --latest
```

6. 再逐个上传附件，避免大文件上传超时导致整个 Release 创建失败。

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" release upload v0.0.0 "dist\Project-v0.0.0-win-x64.zip.sha256" --repo owner/repo --clobber
& "C:\Program Files\GitHub CLI\gh.exe" release upload v0.0.0 "dist\Project-v0.0.0-win-x64.zip" --repo owner/repo --clobber
& "C:\Program Files\GitHub CLI\gh.exe" release upload v0.0.0 "dist\Project-v0.0.0-setup-win-x64.exe" --repo owner/repo --clobber
```

7. 最后核验 Release 和附件。

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" release list --repo owner/repo --limit 5
& "C:\Program Files\GitHub CLI\gh.exe" release view v0.0.0 --repo owner/repo --json tagName,name,url,isDraft,isPrerelease,assets
```

## 注意事项

- 不要在笔记、README 或日志中记录真实 token。
- 如果 `release create` 带多个大附件超时，先用 `release list` 和 `release view` 检查远端真实状态，不要盲目重试。
- 如果草稿 Release 显示 `untagged-...` URL，通常说明 Release 仍是 draft 或创建过程未完成。
- 软件自动更新依赖附件命名稳定，发布前必须确认 zip 文件名与程序里的查找规则一致。

## 本次实践中的有效做法

- 用外部权限调用固定路径的 `gh.exe`，成功读取 Windows keyring。
- 先创建 `v0.2.4` 正式 Release。
- 分三次上传 `.sha256`、`.zip`、`.exe`，避免一次性上传大文件超时。
- 最终用 `release list` 确认新版本为 Latest，用 `release view` 确认附件完整。
