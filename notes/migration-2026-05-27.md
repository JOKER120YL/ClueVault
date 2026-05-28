# 目录迁移说明

日期：2026-05-27

## 迁移目标

- 按工作区分类规则，把文档、素材、笔记和代码从根目录拆开
- 明确 `WPF` 为当前主线实现
- 保留旧版 `Electron` 原型，方便对照已有逻辑和资源

## 本次调整

- `PRD.md` 迁移到 `docs/prd-v1.md`
- 悬浮窗概念稿迁移到 `assets/design/floating-mascot-concepts.png`
- `ClueVault.Desktop` 迁移到 `code/ClueVault.Desktop`
- 旧版 `Electron + React` 工程迁移到 `code/electron-prototype`

## 当前建议

- 新功能优先继续落在 `code/ClueVault.Desktop`
- 旧版 `Electron` 目录仅保留作参考，不再作为主实现继续堆功能
- 如果后续新增知识整理、AI 配置等模块，也继续挂在 `code/ClueVault.Desktop`
