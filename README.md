# ClueVault

ClueVault 是一个 Windows 桌面模型归档助手，用于把微信群收到的用户模型、压缩包和截图快速归档到共享盘对应专业目录，方便测试组后续取用和验证。

当前版本优先解决“少填字段、快速归档、可追溯”这件事，不要求提交人先写完整问题描述。

## 适用场景

- 运营或客服在微信群收到用户发来的模型文件。
- 需要把模型材料快速交给测试组。
- 用户问题还没解决，暂时不适合整理成完整经验或正式问题单。
- 需要查看当天归档记录，并在必要时补充备注。

## 下载与安装

请到 GitHub Releases 下载最新版本：

[Releases](https://github.com/JOKER120YL/ClueVault/releases)

推荐下载：

- `ClueVault-v版本号-setup-win-x64.exe`

安装包会安装到当前用户目录，不需要管理员权限，并可创建桌面快捷方式和开始菜单入口。

## 基本用法

1. 首次启动后配置姓名和共享盘目录。
2. 将用户发来的模型文件拖到桌面悬浮窗。
3. 在快速归档面板选择专业：建筑、结构、暖通、给排水、电气或其他。
4. 点击归档到共享盘。
5. 在主窗口的今日记录中查看归档结果。

归档后会在共享盘专业目录下生成一个归档文件夹，并写入 `归档信息.md`。

示例：

```text
共享盘目录/
  建筑/
    2026-05-28_微信群_张三_153012/
      用户模型.rvt
      归档信息.md
```

## 更新机制

从 `v0.2.1` 开始，ClueVault 支持在软件内检查更新：

1. 打开主窗口。
2. 进入关于页面。
3. 点击检查更新。
4. 发现新版本后，软件会下载 Release 中的 zip 更新包。
5. 程序退出后由独立更新脚本覆盖安装目录并重启。

从 `v0.2.3` 开始，软件启动后每天最多静默检查一次更新；如果 GitHub Release 中有新版本，会在关于入口显示 `NEW` 提醒，用户仍可自行决定是否更新。

从 `v0.2.4` 开始，更新器会写入 `update.log`。如果更新失败，会保留更新窗口，方便截图或提交日志排查。

注意：`v0.2.0` 本身没有自动更新逻辑，已使用 `v0.2.0` 的用户需要手动安装 `v0.2.1` 一次。之后再发布新版本，就可以通过软件内更新。

每次发布 Release 时建议同时上传：

```text
ClueVault-v版本号-setup-win-x64.exe
ClueVault-v版本号-win-x64.zip
ClueVault-v版本号-win-x64.zip.sha256
```

其中 `.exe` 给用户首次安装使用，`.zip` 给软件内自动更新使用。

## 当前边界

- 当前版本不接入真实 AI。
- 当前版本不强制填写问题描述。
- 当前版本主要用于共享盘归档，不替代完整测试管理系统。
- 经验库、截图自动总结、经验导入导出等能力仍在后续规划中。

## 下一阶段计划

后续会继续围绕“减少运营整理成本”扩展功能：

- 截图随模型一起归档：拖入模型后，可选择顺手截取微信聊天记录或用户反馈截图，并一起放入归档目录。
- 大模型配置：支持配置大模型 API，用于后续自动整理用户问题、回复内容和可复用经验。
- 经验库 / 知识库：把有价值的用户问法、处理方式、回复话术沉淀下来，方便团队复用。
- 截图自动总结：粘贴聊天截图后，由大模型自动提取“用户怎么问、我们怎么回、适用场景是什么”。
- 经验导入导出：支持导入别人的经验库，也支持导出自己的经验库，方便团队共享。
- 归档后修正：进一步优化备注、专业、目录调整等归档后的补充编辑能力。

## 技术栈

- .NET 8
- WPF
- Windows Forms NotifyIcon
- Inno Setup

## 项目结构

```text
code/
  ClueVault.Desktop/   Windows 桌面端主程序
  installer/           Inno Setup 安装包脚本
  flow-demo/           早期流程验证 Demo
docs/                  PRD、发布说明和技术决策
assets/                设计素材、图标、参考资料
notes/                 开发笔记和排查记录
```

## 本地构建

构建桌面端：

```powershell
dotnet build code\ClueVault.Desktop\ClueVault.Desktop.csproj
```

发布 Windows x64 自包含目录：

```powershell
dotnet publish code\ClueVault.Desktop\ClueVault.Desktop.csproj -c Release -r win-x64 --self-contained true -o dist\ClueVault-v0.2.1-win-x64
```

生成安装包需要安装 Inno Setup，然后运行：

```powershell
& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" "code\installer\ClueVault.iss"
```
