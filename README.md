# bug反馈助手

这是 `bug反馈助手` 的开发工作区，用于集中管理产品文档、设计素材、报错截图、参考资料、开发笔记和代码实现。

## 目录说明

- `docs/`：产品文档区，存放 `PRD`、需求迭代记录、关键决策、流程说明等
- `assets/design/`：设计素材，存放效果图、界面稿、UI 参考
- `assets/bug/`：测试报错截图，存放异常截图、复现证据、问题录屏等
- `assets/reference/`：参考图与灵感收集，存放竞品截图、视觉参考、交互灵感
- `notes/`：学习笔记，存放开发踩坑记录、技术方案、调研结论
- `code/`：独立代码区，后续新增代码统一放在这里

## 当前代码分区

- [code/ClueVault.Desktop](F:\Code space\EasyBIM helper\bug反馈助手\code\ClueVault.Desktop)：当前主线 `WPF` 桌面版本
- [code/electron-prototype](F:\Code space\EasyBIM helper\bug反馈助手\code\electron-prototype)：旧版 `Electron + React` 原型，保留作参考
- [code/flow-demo](F:\Code space\EasyBIM helper\bug反馈助手\code\flow-demo)：`v2` 流程验证静态 Demo，不作为正式技术架构

## 当前文档与素材

- [docs/prd-v2.md](F:\Code space\EasyBIM helper\bug反馈助手\docs\prd-v2.md)：当前主需求文档，包含 Markdown 线稿与 Demo 验收标准
- [docs/architecture-decision-v2.md](F:\Code space\EasyBIM helper\bug反馈助手\docs\architecture-decision-v2.md)：`v2` 技术架构决策，正式 MVP 走 `WPF / .NET 8` 主线
- [docs/mvp-implementation-plan-v2.md](F:\Code space\EasyBIM helper\bug反馈助手\docs\mvp-implementation-plan-v2.md)：正式 MVP 分阶段实施计划
- [docs/prd-v1.md](F:\Code space\EasyBIM helper\bug反馈助手\docs\prd-v1.md)：历史产品需求文档
- [assets/design/floating-mascot-concepts.png](F:\Code space\EasyBIM helper\bug反馈助手\assets\design\floating-mascot-concepts.png)：悬浮窗形象概念稿
- [notes/migration-2026-05-27.md](F:\Code space\EasyBIM helper\bug反馈助手\notes\migration-2026-05-27.md)：本次目录迁移与选型说明

## 使用约定

- 所有产品、需求、过程文档统一放入 `docs/`
- 所有图片类资料统一放入 `assets/` 下对应子目录
- 开发过程中的经验总结、问题复盘统一记录到 `notes/`
- 后续新增业务代码、脚本、组件和配置优先放入 `code/`
- 根目录尽量只保留总览文件，例如 `README.md`、`AGENTS.md`

更多开发规范请见 [AGENTS.md](F:/Code%20space/EasyBIM%20helper/bug反馈助手/AGENTS.md)。
