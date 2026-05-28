# AGENTS.md

本文件提供给后续参与本项目的开发 AI 使用，目标是让工作区结构稳定、资料可追溯、代码边界清晰。

## 当前项目状态

- 产品名称：`ClueVault`
- 当前主线：`WPF / .NET 8` Windows 桌面端
- 主程序目录：`code/ClueVault.Desktop`
- 安装包脚本：`code/installer/ClueVault.iss`
- 当前定位：模型归档助手，优先解决微信群收到用户模型后快速归档到共享盘专业目录的问题
- 非当前重点：完整测试管理系统、完整问题单流转、真实 AI 总结、经验库导入导出

## README 分工

- `README.md`：面向 GitHub 仓库首页，写给用户和同事看，包含项目介绍、下载、安装、使用和更新说明。
- `README.local.md`：面向本地开发工作区，说明目录结构、文档位置、素材位置和协作约定。
- `AGENTS.md`：面向后续开发 AI，说明项目边界、工作方式、发布规则和注意事项。

## 工作区结构

### `docs/`

用途：
- 存放 `PRD`
- 存放需求迭代记录
- 存放关键决策、会议结论、流程说明

规则：
- 所有正式文档统一放在 `docs/`
- 不要把需求说明散落到根目录、代码目录或素材目录
- 新建文档时优先使用可读性强的文件名，例如 `prd-v2.md`、`bug-flow-decision.md`
- Release 说明放在 `docs/release-v版本号.md`

### `assets/design/`

用途：
- 存放设计稿
- 存放效果图
- 存放 UI 参考素材

规则：
- 仅放设计相关素材
- 文件名尽量包含日期或主题，方便追溯版本

### `assets/bug/`

用途：
- 存放测试报错截图
- 存放复现过程截图
- 存放问题录屏或其他异常证据

规则：
- 每个素材尽量对应具体问题
- 文件名建议带问题关键词和日期

### `assets/reference/`

用途：
- 存放参考图
- 存放竞品截图
- 存放灵感收集素材

规则：
- 参考资料统一沉淀在这里
- 不要和正式设计稿混放

### `notes/`

用途：
- 存放开发踩坑记录
- 存放学习笔记
- 存放技术方案对比和调研结论

规则：
- 遇到重要问题、排查过程、关键方案时及时记录
- 优先记录结论、原因、解决方式和后续注意事项

### `code/`

用途：
- 作为后续统一的独立代码区
- 存放新增业务代码、脚本、模块、配置和说明文件

规则：
- 后续新增代码优先放在 `code/`
- `code/` 内的实现不要依赖 `docs/`、`notes/`、`assets/` 中的外部文件作为运行输入
- 文档资料不要混放到代码目录
- 若必须引用静态资源，应在代码区内部维护可直接使用的副本或明确的资源目录

### `dist/`

用途：
- 存放本地构建出的发布包、安装包和校验文件

规则：
- `dist/` 是构建产物目录，通常不作为源码提交
- 发布 GitHub Release 时从这里取附件上传
- 每次发布建议同时保留安装包、自动更新 zip 和 sha256 校验文件

## 全局协作规则

- 根目录只保留少量总览文件，避免继续堆放零散内容
- 所有文档放 `docs/`，所有素材放 `assets/`，所有笔记放 `notes/`
- 如果新增目录，先确认现有目录无法承载，再补充说明用途
- 修改代码前先阅读相关上下文，避免误改现有实现
- 不要随意移动或删除已有文件，除非任务明确要求
- 命名尽量清晰、稳定、可搜索，避免使用 `新建文件`、`temp`、`test1` 这类名称
- 修改发布流程、安装包脚本、自动更新逻辑时，同步更新 `README.md`、`README.local.md` 或 `docs/release-v*.md` 中对应说明
- 不要把本机绝对路径写入 `README.md`，GitHub 首页不能出现本地路径
- 不要把 GitHub 首页项目介绍改回本地工作区说明，本地说明放在 `README.local.md`

## 发布与更新规则

- 当前推荐分发方式：GitHub Release 上传 Windows 安装包
- 新用户优先下载：`ClueVault-v版本号-setup-win-x64.exe`
- 软件内自动更新使用：`ClueVault-v版本号-win-x64.zip`
- 校验文件：`ClueVault-v版本号-win-x64.zip.sha256`
- Release tag 使用：`v版本号`，例如 `v0.2.1`
- 发布新版本时，需要同步修改 `code/ClueVault.Desktop/ClueVault.Desktop.csproj` 中的 `Version`、`AssemblyVersion`、`FileVersion`
- 如果安装包版本变化，需要同步修改 `code/installer/ClueVault.iss` 中的 `MyAppVersion`
- 软件内更新依赖 GitHub Release 中的 zip 命名规则：`ClueVault-v版本号-win-x64.zip`
- `v0.2.0` 没有自动更新逻辑，用户需要手动升级到 `v0.2.1` 或更高版本一次；之后才可通过软件内更新

## 构建命令

构建桌面端：

```powershell
dotnet build code\ClueVault.Desktop\ClueVault.Desktop.csproj
```

发布 Windows x64 自包含目录：

```powershell
dotnet publish code\ClueVault.Desktop\ClueVault.Desktop.csproj -c Release -r win-x64 --self-contained true -o dist\ClueVault-v版本号-win-x64
```

生成安装包：

```powershell
& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" "code\installer\ClueVault.iss"
```

生成更新 zip 和 sha256：

```powershell
Compress-Archive -Path "dist\ClueVault-v版本号-win-x64\*" -DestinationPath "dist\ClueVault-v版本号-win-x64.zip" -Force
Get-FileHash "dist\ClueVault-v版本号-win-x64.zip" -Algorithm SHA256
```

## 建议工作方式

- 开始开发前，先查看 `README.md`、`README.local.md`、`docs/` 中现有文档
- 设计参考优先查看 `assets/design/` 与 `assets/reference/`
- 排查问题时，把关键截图放到 `assets/bug/`
- 遇到值得复用的经验或坑点，及时写入 `notes/`
- 新增实现默认从 `code/` 开始组织，保持结构整洁
- 开始改 WPF 前，优先阅读 `code/ClueVault.Desktop/MainWindow.xaml`、`MainWindow.xaml.cs`、`Infrastructure/AppServices.cs`、`Infrastructure/AppModels.cs`
