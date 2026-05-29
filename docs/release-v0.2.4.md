# ClueVault v0.2.4 发布说明

## 推荐下载

新用户或从 `v0.2.2` 升级失败的用户，建议直接下载安装包：

- `ClueVault-v0.2.4-setup-win-x64.exe`

## 主要变化

- 修复从旧版本点击软件内更新后，下载完成、软件关闭但更新器没有明显反馈的问题。
- 更新器改为 PowerShell 脚本执行，启动方式更明确。
- 更新过程写入 `update.log`，失败时保留窗口，方便截图或发日志排查。
- 保留 `v0.2.3` 的每日一次后台检查更新和 `NEW` 提醒。

## 更新日志位置

```text
%LOCALAPPDATA%\ClueVaultDesktop\updates\update.log
```

## 发布附件

发布 GitHub Release 时请同时上传：

```text
ClueVault-v0.2.4-setup-win-x64.exe
ClueVault-v0.2.4-win-x64.zip
ClueVault-v0.2.4-win-x64.zip.sha256
```

## 注意

如果用户已经停在 `v0.2.2 -> v0.2.3` 自动更新失败后的状态，建议手动运行 `v0.2.4` 安装包升级一次。之后再更新，才会使用修复后的更新器。
