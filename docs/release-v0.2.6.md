# ClueVault v0.2.6 发布说明

## 推荐下载

普通用户下载并运行：

- `ClueVault-v0.2.6-setup-win-x64.exe`

## 主要变化

- 新增归档统计事件：一次成功归档计 1 次，一个文件夹中多个文件仍算 1 次。
- 每次归档成功后，同时写入本机统计文件和共享盘统计文件。
- 新增 `统计看板` 页面，可查看今日、近 7 天、近 30 天归档次数。
- 统计看板支持 30 天热力图和近 30 天专业分布。
- 共享盘统计写入失败不会影响归档主流程。

## 统计文件位置

本机统计：

```text
%LOCALAPPDATA%\ClueVaultDesktop\archive-events.jsonl
```

共享盘统计：

```text
共享目录\_ClueVaultStats\archive-events-YYYY-MM.jsonl
```

## 文件说明

- `ClueVault-v0.2.6-setup-win-x64.exe`：首次安装或覆盖安装使用。
- `ClueVault-v0.2.6-win-x64.zip`：软件内自动更新使用。
- `ClueVault-v0.2.6-win-x64.zip.sha256`：校验更新包完整性。
