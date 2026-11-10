# 图片大小预设 (Image Size Presets)

一次点击，给**一篇笔记**、**一个文件夹**或**整个库**设定图片显示大小。不用写 CSS，也不用一张张拖动角点。

![Obsidian](https://img.shields.io/badge/Obsidian-1.5.1%2B-6C5CE7) ![license](https://img.shields.io/badge/license-MIT-blue)

## 它解决什么问题

Obsidian 默认按图片原始分辨率显示，一张 2940px 宽的截图会占满整个编辑区。每贴一张都拖右下角缩一次，时间久了很烦。

这个插件把这件事变成两次点击。

## 怎么用

点左侧边栏的图片图标（或命令面板执行 **图片大小：打开图片大小面板**）：

- **作用范围**：本笔记 / 本文件夹 / 全部笔记
- **大小**：极小 160 · 小 240 · 中 400 · 大 640 · 特大 900 · 不限
- **状态行**：告诉你当前实际生效的是哪个值、来自哪一层

选一个，面板自动关，立刻生效。

## 优先级

从高到低：

1. **本笔记** —— 写进笔记属性 `image-width: 400`。你可以在「属性」面板里像改别的属性一样手改，填 `none` 表示不限制。
2. **本文件夹** —— 存在插件设置里。子文件夹取最精确的那条（`AI learning/sub` 优先于 `AI learning`）。
3. **全局默认** —— 560px，在插件设置页用滑块调。

两个关键设计：

- **只封顶，不放大。** 本身比上限小的图片保持原尺寸，图标和小图不会被拉糊；超宽的截图才会缩。
- **已有的 `![[图片|553]]` 照旧生效。** 只有当它超过上限时才会再压一层，你之前手调过的宽度不会突然跳变。

另外有一个**最大高度**上限（默认 900px，可调），用来管竖长的手机截图。

## 安装

### BRAT（推荐，官方目录上架前）

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat)。
2. **BRAT → Add beta plugin** → 填 `alikhantonyfrancescoery1984-sys/image-size-presets`。
3. 在 **设置 → 第三方插件** 里启用「图片大小预设」。

### 手动安装

从 [最新 Release](https://github.com/alikhantonyfrancescoery1984-sys/image-size-presets/releases) 下载 `main.js`、`manifest.json`、`styles.css`，放进 `你的库/.obsidian/plugins/image-size-presets/`，然后重载 Obsidian。

需要 Obsidian **1.5.1** 及以上。

## 它管不到的地方

- **Canvas 和 Excalidraw** 里的图片 —— 它们不是 Markdown 视图里的 `<img>`。
- **Pandoc / PDF / Word 导出** —— 导出读的是 Markdown 里写的宽度，不是屏幕上显示的效果。

## 设置页

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| 默认最大宽度 | 560 | 没单独设置过的笔记用它。`0` = 不限制 |
| 默认最大高度 | 900 | 管竖长截图。`0` = 不限制 |
| 文件夹规则 | 空 | 选「本文件夹」时自动添加，可删除 |

## 实现方式

核心就是 `styles.css` 里一条规则：

```css
.markdown-preview-view img,
.markdown-reading-view img,
.markdown-rendered img,
.markdown-source-view.is-live-preview img {
	max-width: min(100%, var(--isp-width, 100%));
	max-height: var(--isp-height, none);
}
```

每次打开文件、布局变化、元数据变化时，插件为每个 Markdown 窗格算出宽度，把 `--isp-width` / `--isp-height` 写到该窗格的容器元素上。不往别的窗口里注入运行时样式，所以弹出窗口（pop-out）表现一致。

解析逻辑集中在 `src/resolve.ts`，是没有任何运行时依赖的纯函数，单测直接测它。

## 开发

```bash
npm install
npm run dev    # esbuild 监听
npm run build  # tsc 类型检查 + 生产打包
npm test       # node:test
npm run lint   # eslint + eslint-plugin-obsidianmd
```

`main.js` 是构建产物，不入库；由 Release 附带。

## 已知限制

- 设置项暂未接入 Obsidian 1.13+ 的设置搜索（还没采用声明式 `getSettingDefinitions()` API）。
- 文件夹规则按路径前缀匹配，不支持 glob。

## 许可证

MIT
