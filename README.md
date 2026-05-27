# ClueVault

一个基于 `Electron + React` 的 Windows 桌面工具，用于把模型、截图、文字说明等问题材料整理成标准化反馈文件夹，并写入共享目录，供研发或测试团队排查。

产品需求文档见 [PRD.md](F:/Code%20space/EasyBIM%20helper/bug反馈助手/PRD.md)。

## 当前能力

- 首次启动要求填写姓名/昵称，并保存到本地
- 支持配置共享目录、模型供应商、`base URL`、模型名、`API Key`
- 支持选择模型文件、图片和其他附件
- 支持调用 OpenAI 兼容接口生成 bug 草稿
- 如果 AI 不可用，会降级生成本地草稿
- 提交后自动创建 bug 文件夹并写入 `说明.md`
- 支持悬浮窗拖入文件，快速唤起主窗口
- 支持根据当日提交次数在蛙弟 / 蜂哥之间切换悬浮形象
- 打包配置已包含 `electron-builder`

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

当前仓库已验证：

- `npm test`
- `npm run build:renderer`

完整安装包构建在当前环境中触发了超时，但 `electron-builder` 流程已经启动，后续建议在真实 Windows 机器上继续验证 `nsis` 产物。

## 配置说明

- 默认共享目录占位值是 `\\\\server\\share\\bug-collect`
- 建议改成你们真实可访问的 `UNC` 网络路径
- `DeepSeek` 已内置默认 `base URL`
- 每位运营的 API Key 只保存在自己的本地配置中
