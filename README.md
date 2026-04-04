# Skills Management Desktop (Electron + React)

这是一个基于 Electron + Vite + React 的本地桌面应用，用于扫描并管理磁盘上的 Claude Code Skills。

## 功能

- 扫描用户授权目录，发现 `.claude/` 与 `skill.md`
- 按层级（计算机/软件/工作目录/项目）展示技能树
- 预览 Markdown、代码、图片、PDF、音视频
- 查看文件详情并支持“系统打开/在 Finder 显示”
- 设置持久化到 macOS `Application Support` 目录

## 开发运行

1. 安装依赖：

```bash
npm install
```

2. 启动桌面应用（开发模式）：

```bash
npm run dev:desktop
```

说明：该命令会先启动 Vite，再由 Electron 加载 `http://127.0.0.1:3000`。

## 构建

```bash
npm run build:desktop
```

当前会构建前端资源到 `dist/`，生产环境可由 Electron 主进程直接加载 `dist/index.html`。
