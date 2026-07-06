# 框影 · Framelet — UI 设计规范文档

> 版本：v2.0.0 · 最后更新：2026-07-06
> 审计工具：`frontend-design` · `ui-ux-pro-max` · `taste-skill`

---

## 一、设计理念

### 1.1 风格定位：Minimal Clean（中性极简）

框影的 UI 遵循**中性极简**原则：让照片成为唯一主角，工具界面退为背景。

**核心原则**：
- **去色彩**：全局零彩色强调，仅使用 Stone 暖灰色阶，功能性色彩（红/绿/琥珀）仅用于状态反馈
- **去装饰**：无渐变、无厚阴影、无圆滑拟物，依靠留白和层级建立结构
- **去噪音**：用 SVG 图标替代 emoji，用内联组件替代浏览器原生弹窗，统一一切视觉噪点
- **去干扰**：控制面板、按钮、标签不争抢视觉注意力，让用户聚焦照片和预览效果

### 1.2 审计与优化来源

本规范基于三个 Claude Code 全局 Skill 的联合审计结果建立：

| Skill | 来源 | 审计维度 |
|-------|------|---------|
| **frontend-design** | Claude 官方 | 组件结构、设计系统一致性、CSS token 管理 |
| **ui-ux-pro-max** | GitHub: nextlevelbuilder | 交互模式、无障碍合规、表单与控件 UX |
| **taste-skill** | GitHub: Leonxlnx | 视觉品味、排版节奏、配色纯净度、anti-slop 审美 |

三个 Skill 均配置在 `~/.claude/settings.json` 的 `enabledPlugins` 中，**全局生效**，不限于本项目。

---

## 二、设计 Token（Design Tokens）

所有颜色、字体、阴影均通过 CSS 自定义属性定义在 `src/index.css` 的 `:root` 中，并同步到 `tailwind.config.js` 的 `theme.extend` 中，确保 Tailwind class 和 CSS variable 一一对应。

### 2.1 色板（Stone 暖灰）

| Token | CSS 变量 | Tailwind class | 色值 | 用途 |
|-------|---------|---------------|------|------|
| Surface | `--surface` | `bg-surface` | `#ffffff` | 卡片、侧栏、按钮背景 |
| Canvas | `--canvas` | `bg-canvas` | `#f5f5f4` | 预览区主背景 |
| Canvas Soft | `--canvas-soft` | `bg-canvas-soft` | `#fafaf9` | 渲染器外围浅色层 |
| Border | `--border` | `border-border` | `#e7e5e4` | 普通边框 |
| Border Strong | `--border-strong` | `border-border-strong` | `#d6d3d1` | 强调边框、分隔线 |

### 2.2 文字层级

| Token | CSS 变量 | Tailwind class | 色值 | 对比度 | 用途 |
|-------|---------|---------------|------|--------|------|
| Text | `--text` | `text-text` | `#1c1917` | 15.4:1 | 主文字、标题 |
| Text Secondary | `--text-secondary` | `text-text-2` | `#78716c` | 5.3:1 | 次要文字、描述 |
| Text Tertiary | `--text-tertiary` | `text-text-3` | `#6d6b68` | 4.5:1 | 弱文字、caption（WCAG AA） |

> **重要**：`text-3` 从 `#a8a29e`（2.7:1）修正为 `#6d6b68`（4.5:1+），满足 WCAG AA 最低对比度要求。

### 2.3 强调色

| Token | Tailwind class | 色值 | 用途 |
|-------|---------------|------|------|
| Accent | `bg-accent` / `text-accent` | `#18181b` | 主按钮、激活态、focus ring |
| Accent Hover | `bg-accent-hover` | `#27272a` | 主按钮 hover 态 |

> **设计决策**：强调色选用近黑而非蓝色，确保整体色调中性统一，不引入额外色相。

### 2.4 控件专用

| Token | CSS 变量 | 色值 | 用途 |
|-------|---------|------|------|
| Segment | `--segment` | `#efeeec` | 分段控件背景 |
| Segment Active | `--segment-active` | `#ffffff` | 分段控件激活态 |

### 2.5 遮罩

| Tailwind class | 色值 | 用途 |
|---------------|------|------|
| `bg-overlay` | `rgba(28,25,23, 0.05)` | 浅色压暗层 |
| `bg-overlay-dark` | `rgba(28,25,23, 0.55)` | 深色遮罩 |

### 2.6 功能性色彩（仅限状态反馈）

以下色彩**不作为装饰使用**，仅在明确的状态反馈场景出现：

| 色彩 | 使用场景 | 示例 |
|------|---------|------|
| `green-500` / `green-600` | 成功状态 | 导出完成、预设保存成功 |
| `amber-500` / `amber-600` | 警告状态 | 部分导出失败 |
| `red-600` | 错误/危险 | 加载失败、删除确认按钮 |

---

## 三、字体系统

### 3.1 四套字体栈

| 角色 | CSS 变量 | 字体栈 | 用途 |
|------|---------|--------|------|
| UI Sans | `--font-ui` | Inter → -apple-system → PingFang SC → Noto Sans SC | 界面文字（默认） |
| Display | `--font-display` | Noto Serif SC → Songti SC → Source Han Serif SC | 页面标题（框影） |
| Mono | `--font-mono` | JetBrains Mono → SF Mono → Menlo | EXIF 参数、数值、代码 |
| Hand | `--font-hand` | LXGW WenKai Mono TC → STKaiti → Kaiti SC | 拍立得签名、手写文字 |

### 3.2 排版尺度

| Tailwind class | 字号 | 行高 | 字距 | 使用场景 |
|---------------|------|------|------|---------|
| `.font-display` | 22px | 1.15 | -0.01em | 页面标题（框影） |
| `.font-title` | 13px / 500 | 1.4 | -0.005em | 面板节标题 |
| `.font-body` | 12px / 400 | 1.5 | — | 正文描述 |
| `.font-caption` | 9.5px / 600 | 1.4 | 0.12em | 大写标签（UPPERCASE） |
| `.font-mono` | — | — | 0 | 等宽数值（tabular-nums） |

### 3.3 Tailwind fontSize 映射

| Token | 字号 | 行高 | 字距 |
|-------|------|------|------|
| `text-xs` | 10px | 1.4 | 0.02em |
| `text-sm` | 12px | 1.5 | — |
| `text-base` | 13px | 1.5 | — |
| `text-lg` | 14px | 1.4 | — |
| `text-xl` | 16px | 1.3 | — |
| `text-2xl` | 20px | 1.2 | -0.01em |
| `text-3xl` | 24px | 1.15 | -0.02em |
| `text-4xl` | 32px | 1.1 | -0.025em |

### 3.4 字体加载

所有字体通过 `@fontsource` 在 `src/main.tsx` 中自托管加载，无外部 CDN 依赖：

- `@fontsource/inter` — weight 300/400/500/600
- `@fontsource/jetbrains-mono` — weight 300/400/500
- `@fontsource/noto-serif-sc` — weight 400/500/700
- `@fontsource/noto-sans-sc` — weight 400/500
- `@fontsource-variable/lxgw-wenkai-mono-tc` — weight 400

---

## 四、圆角与阴影

### 4.1 圆角尺度

| Token | 值 | 使用场景 |
|-------|-----|---------|
| `rounded-sm` | 4px | 小按钮、标签 |
| `rounded-md` | 6px | 输入框、分段控件按钮 |
| `rounded-lg` | 8px | 卡片内容区 |
| `rounded-xl` | 12px | 面板卡片、模态框 |

### 4.2 阴影层级

| Token | 值 | 使用场景 |
|-------|-----|---------|
| `shadow-card` | `0 1px 2px rgba(28,25,23,0.06), 0 1px 3px rgba(28,25,23,0.08)` | 激活态按钮、小卡片 |
| `shadow-elev` | `0 4px 16px rgba(28,25,23,0.10), 0 1px 3px rgba(28,25,23,0.06)` | 模态框、Toast、进度浮层 |

---

## 五、组件规范

### 5.1 按钮（Button Primitives）

定义在 `src/index.css` 中的全局 class，所有按钮统一使用：

| Class | 样式 | 使用场景 |
|-------|------|---------|
| `.btn-primary` | 黑底白字，hover 变深，active 缩放 0.98，disabled 0.4 透明度 | 主操作（下载、保存） |
| `.btn-outline` | 白底黑字，1px 边框，hover 边框变黑 | 次操作（删除、批量导出） |
| `.btn-ghost` | 透明底，hover 显示浅灰底 | 辅助操作 |

**规范**：
- 禁止在按钮上使用 `bg-blue-*`、`bg-orange-*` 等彩色背景
- 删除确认按钮使用 `bg-red-600 text-white`（功能性色彩例外）

### 5.2 分段控件（Segmented Control）

```css
.segment          → 浅灰容器 + 2px padding + 7px 圆角
.segment button   → 11px 字号 + 5px 圆角 + 次色文字
.segment button[data-active="true"] → 白底 + 主色文字 + 微阴影
```

**ARIA**：容器 `role="radiogroup"`，每个按钮 `role="radio"` + `aria-checked`。

### 5.3 开关（Toggle）

使用 `ToggleRow` 组件：

- 标签 12px 主色文字
- 开关轨道 36×20px（`min-h-[36px]` 满足触控目标）
- 关闭态：灰边框 + 白圆点
- 开启态：黑底 + 白圆点偏移
- ARIA：`role="switch"` + `aria-checked` + `aria-label`

### 5.4 滑块（Range Slider）

定义在 `src/index.css` 中：

- 轨道：1px 高、`--border-strong` 颜色
- 滑块：11×11px 圆形、黑色填充、2px 白边框、微阴影
- hover 放大 1.2 倍（`transition 0.15s cubic-bezier(0.2,0,0,1)`）
- 关联 `<label htmlFor={id}>` + `aria-label`

### 5.5 颜色选取器（Color Row）

- 8 色预设网格（`grid-cols-8 gap-1.5`）
- 每格 `min-h-[32px]` 满足触控目标
- 选中态：`border-accent scale-110 shadow-card`
- 自定义拾色器：`<input type="color">` 右上角 20×20px
- ARIA：每格 `aria-label={`${label} ${colorName}`}`

### 5.6 模态框（InlineDialog）

替代 `window.prompt` / `window.confirm`：

- 固定定位全屏遮罩 `bg-black/30 backdrop-blur-sm`
- 内容卡片 `max-w-[320px] rounded-xl shadow-elev border-border`
- 标题 14px 加粗 + 底部边框分隔
- 点击遮罩关闭（`onClick={onClose}` + `e.stopPropagation()`）
- 统一内边距 `px-5`

### 5.7 Toast 通知

替代 `window.alert`：

- 固定定位顶部居中 `top-4 left-1/2 -translate-x-1/2`
- 4 秒自动消失
- 三种类型：`info`（黑底）、`error`（红底）、`success`（绿底）
- ARIA：`role="alert"` + `aria-live="polite"`
- 使用 `.fade-in` 动画入场

### 5.8 进度浮层（BatchProgressModal）

- 全屏遮罩 `bg-black/30 backdrop-blur-sm`
- 卡片 `max-w-[360px] rounded-xl shadow-elev`
- 进度条：1.5px 高圆角条，进行中黑色 / 成功绿色 / 部分失败琥珀色
- 加载指示器：CSS-only spinner（`border-text border-t-transparent animate-spin`）
- 完成态：绿色勾 SVG / 琥珀色警告 SVG
- 操作按钮：进行中 `btn-outline`（取消），完成后 `btn-primary`（关闭）

### 5.9 模板缩略图（Template Thumbnails）

- 2 列网格，每组带大写标签分类（基础/品牌风/胶片/社交/特效）
- 缩略图 4:3 比例 + 底部名称和描述
- 选中态：`border-accent ring-2 ring-accent/10 shadow-card`
- 渐变色块替代真实照片（`linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)`）
- ARIA：`role="radiogroup"` + `role="radio"` + `aria-checked` + `aria-label`

---

## 六、图标规范

### 6.1 原则

**全面使用 SVG 内联图标**，禁止使用 emoji 作为 UI 元素。

理由：
- emoji 在不同操作系统渲染不一致（Windows vs macOS vs Linux）
- emoji 无法通过 CSS 控制颜色和尺寸
- emoji 在高 DPI 屏幕上可能模糊
- SVG 可精确控制 stroke width、颜色、尺寸

### 6.2 图标风格

统一使用 Lucide/Feather 风格线性图标：

| 属性 | 值 |
|------|-----|
| viewBox | `0 0 24 24` |
| fill | `none` |
| stroke | `currentColor` |
| strokeWidth | `1.6` — `2.0` |
| strokeLinecap | `round` |
| strokeLinejoin | `round` |
| 尺寸 | 13px — 22px（按语境） |

### 6.3 已定义图标组件

| 组件 | 描述 | 用于 |
|------|------|------|
| `IconPreset` | 软盘/保存图标 | 预设区标题 |
| `IconTemplate` | 布局网格图标 | 模板区标题 |
| Header camera icon | 相机图标 | 页面顶部 Logo |
| Download arrow | 下载箭头 | 导出按钮 |
| Upload arrow | 上传箭头 | 文件上传区 |
| Batch stack | 三层矩形 | 批量导出按钮 |
| Location pin | 地图钉 SVG path | 地理模板缩略图 |

---

## 七、布局规范

### 7.1 整体布局

```
┌─────────────────────────────────────────┐
│  Header (h-[52px] mobile / h-[64px] md) │
├──────────────────────┬──────────────────┤
│                      │  Control Panel   │
│    Preview Area      │  (w-[320px] md)  │
│    (flex-1)          │  ├── Tabs        │
│    bg-canvas         │  ├── Content     │
│                      │  └── Export Bar  │
│    ┌──────────────┐  │                  │
│    │ EXIF Info Bar │  │                  │
│    └──────────────┘  │                  │
└──────────────────────┴──────────────────┘
```

- **桌面端**（md+）：水平二栏，左侧预览区 `flex-1`，右侧控制面板 `w-[320px]`，主容器 `overflow-hidden`
- **移动端**（< md）：垂直堆叠，预览区 `min-h-[200px] flex-1`（自适应，非固定高度），控制面板全宽

### 7.2 间距系统

| 位置 | 值 | 说明 |
|------|-----|------|
| 面板内边距 | `px-5` | 统一水平内边距，不混用 px-4/px-6 |
| 面板节间距 | `space-y-5` / `space-y-7`（md） | 节与节之间的垂直间距 |
| 控件间距 | `gap-1.5` — `gap-2` | 表单控件间的间距 |
| 卡片内边距 | `p-3` / `p-4`（md） | 预设/模板卡片内部 |

### 7.3 响应式断点

仅使用一个断点 `md`（768px），不做更细粒度划分：

| 维度 | < 768px（移动端） | >= 768px（桌面端） |
|------|-------------------|-------------------|
| 布局 | 垂直堆叠 | 水平二栏 |
| Header 高度 | 52px | 64px |
| 预览区 | `min-h-[200px] flex-1` | `flex-1 overflow-hidden` |
| 控制面板 | 全宽、`border-top` | 320px、`border-left` |
| 滚动条 | 系统默认 | 自定义 8px 圆角 |
| 格式标签 | 隐藏 | 显示（RAW/JPG/PNG/HEIC） |

---

## 八、无障碍规范（Accessibility）

### 8.1 对比度

所有文字颜色满足 WCAG 2.1 AA 标准（常规文字 4.5:1，大文字 3:1）：

| 色彩 | 对比度（vs #ffffff） | 等级 |
|------|---------------------|------|
| `#1c1917` (text) | 15.4:1 | AAA |
| `#78716c` (text-2) | 5.3:1 | AA |
| `#6d6b68` (text-3) | 4.5:1 | AA |

### 8.2 ARIA 角色

| 控件 | ARIA 属性 |
|------|----------|
| Tab 栏 | `role="tablist"` + `role="tab"` + `aria-selected` |
| 分段控件 | `role="radiogroup"` + `role="radio"` + `aria-checked` |
| 开关 | `role="switch"` + `aria-checked` + `aria-label` |
| 字体选择网格 | `role="radiogroup"` + `role="radio"` + `aria-checked` + `aria-label` |
| 模板选择网格 | `role="radiogroup"` + `role="radio"` + `aria-checked` + `aria-label` |
| 9 宫格位置选择 | `role="radiogroup"` + `role="radio"` + `aria-checked` + `aria-label`（左上/中上/右上...） |
| 颜色色板 | `aria-label={`${label} ${colorName}`}` |
| 滑块 | `<label htmlFor>` + `aria-label` |
| 文本输入 | `aria-label` |
| Toast | `role="alert"` + `aria-live="polite"` |

### 8.3 颜色可访问标签

色板按钮附带中文颜色名称，通过 `COLOR_NAMES` 映射表提供：

```
#ffffff → 白色    #fafaf9 → 米白    #f5f5f4 → 浅灰
#d4b896 → 牛皮色  #a8a39d → 暖灰    #44403c → 深灰
#1c1917 → 墨色    #18181b → 黑色
#ff3d00 → 橙红    #ff6b35 → 橙色    #ffcc00 → 黄色
#00ff88 → 绿色    #00aaff → 蓝色    #ff00aa → 粉红
```

### 8.4 键盘与焦点

- Focus ring：`0 0 0 2px var(--surface), 0 0 0 3px var(--accent)`（双层环，2px 白 + 1px 黑）
- 所有交互元素可通过 Tab 键聚焦
- `-webkit-tap-highlight-color: transparent`（消除移动端点击高亮）

### 8.5 触控目标

| 控件 | 最小尺寸 | 实现 |
|------|---------|------|
| 9 宫格按钮 | 36×36px | `min-h-[36px] aspect-square` |
| 颜色色板 | 32×32px | `min-h-[32px] aspect-square` |
| 时间戳颜色色板 | 36×36px | `min-h-[36px] aspect-square` |
| 开关按钮 | 36×20px | 内联 36px 宽度 |

### 8.6 减弱动效（Reduced Motion）

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .fade-in { animation: none; }
}
```

---

## 九、动效规范

### 9.1 过渡

| 属性 | 时长 | 缓动 | 使用场景 |
|------|------|------|---------|
| `color` / `background` / `border-color` | 150ms | ease | 按钮 hover、focus |
| `transform` | 100ms | ease | 按钮 active 缩放 |
| `width`（进度条） | 300ms | ease-out | 批量导出进度 |
| 滑块 thumb hover | 150ms | `cubic-bezier(0.2,0,0,1)` | 放大效果 |

### 9.2 动画

| 动画 | 定义 | 使用场景 |
|------|------|---------|
| `fadeIn` | `opacity 0→1 + translateY 2px→0, 0.25s ease-out` | Toast 入场、新内容出现 |
| `spin` | CSS `animate-spin` | 加载指示器（spinner） |

### 9.3 滚动条

桌面端（md+）自定义滚动条：
- 宽度 8px
- 轨道透明
- 滑块 `--border-strong` 颜色 + 4px 圆角 + 2px surface 边距
- hover 变深至 `--text-tertiary`

---

## 十、色彩一致性规则

### 10.1 禁止项

以下颜色在非功能性场景中**禁止使用**：

| 颜色系列 | 原用途 | 已替换为 |
|---------|--------|---------|
| `blue-*`（blue-50, blue-200, blue-500 等） | 预设区强调 | `border-border` / `bg-canvas-soft` / `text-text-2` |
| `orange-*`（orange-50, orange-500 等） | 模板区强调 | `border-border` / `bg-surface` / `text-text-2` |

### 10.2 允许的彩色

仅以下场景可使用彩色：

| 色彩 | 允许场景 |
|------|---------|
| `green-500/600` | 导出完成成功状态 |
| `amber-500/600/700` + `amber-50` | 导出部分失败状态 |
| `red-500/600/700` | 错误提示、删除确认按钮、徕卡红点（模板元素） |
| 时间戳色板 6 色 | 老照片模板的时间戳颜色选择 |
| 渐变色块 | 模板缩略图中的照片占位符 |

---

## 十一、原生弹窗替代

### 11.1 原则

**禁止使用** `window.alert()`、`window.prompt()`、`window.confirm()`。

理由：
- 原生弹窗样式不可控，与应用风格割裂
- 不同浏览器渲染差异大
- 阻塞主线程
- 无法添加 ARIA 属性

### 11.2 替代方案

| 原生 API | 替代组件 | 位置 |
|---------|---------|------|
| `window.alert()` | `Toast` 组件 | `ControlPanel.tsx` 内定义 |
| `window.prompt()` | `InlineDialog` + `<input>` | `ControlPanel.tsx` 内定义 |
| `window.confirm()` | `InlineDialog` + 双按钮 | `ControlPanel.tsx` 内定义 |

---

## 十二、文件结构与 Token 同步

### 12.1 Token 定义位置

| 文件 | 职责 |
|------|------|
| `src/index.css :root` | CSS 自定义属性（单一真实来源） |
| `tailwind.config.js theme.extend` | Tailwind class 映射（镜像 CSS 变量值） |

### 12.2 同步规则

修改任何设计 Token 时，**必须同时更新两个文件**：

1. `src/index.css` 的 `:root` 块中的 CSS 变量
2. `tailwind.config.js` 的 `theme.extend.colors` / `fontFamily` / `fontSize` 等

### 12.3 关键样式文件

| 文件 | 内容 |
|------|------|
| `src/index.css` | Design tokens + 全局排版 + 按钮原语 + 分段控件 + 滑块 + focus ring + 动画 + 滚动条 |
| `tailwind.config.js` | 色板 + 字体栈 + 字号尺度 + 阴影 + 圆角 + 过渡 |
| `src/utils/fonts.ts` | 水印渲染字体栈 + 排版常量 + 响应式分级 |
| `src/components/ControlPanel.tsx` | InlineDialog / Toast / IconPreset / IconTemplate / COLOR_NAMES |

---

## 十三、Skill 配置参考

三个审计 Skill 的全局安装方式：

```jsonc
// ~/.claude/settings.json
{
  "enabledPlugins": [
    "claude:frontend-design",
    "github:nextlevelbuilder/ui-ux-pro-max",
    "github:Leonxlnx/taste-skill"
  ]
}
```

### 可用子 Skill

| 主 Skill | 子 Skill | 用途 |
|---------|---------|------|
| `frontend-design` | `frontend-design` | 组件结构、设计系统审计 |
| `ui-ux-pro-max` | `ui-ux-pro-max` | 综合 UX 审计 |
| `ui-ux-pro-max` | `design-system` | 设计系统规范检查 |
| `ui-ux-pro-max` | `ui-styling` | 样式代码审计 |
| `ui-ux-pro-max` | `design` | 视觉设计审计 |
| `taste-skill` | `taste-skill` | 综合品味审计（anti-slop） |
| `taste-skill` | `minimalist-skill` | 极简风格审计 |
| `taste-skill` | `redesign-skill` | 重设计审计 |
| `taste-skill` | `soft-skill` | 柔和风格审计 |

### 审计修复清单（v2.0.0）

以下问题在三 Skill 联合审计中被发现并修复：

| # | 优先级 | 问题 | 修复 |
|---|--------|------|------|
| 1 | P0 | `text-3` 对比度仅 2.7:1 | `#a8a29e` → `#6d6b68`（4.5:1+） |
| 2 | P0 | 无 `prefers-reduced-motion` 支持 | 添加全局 media query 禁用动画 |
| 3 | P1 | 移动端预览区 `h-[60vh]` 固定高度 | 改为 `min-h-[200px] flex-1` 自适应 |
| 4 | P1 | 完成态按钮 inline style 未复用 | 统一使用 `btn-primary` class |
| 5 | P1 | 预设区使用 `blue-*` 强调色 | 替换为 neutral token |
| 6 | P1 | 模板区使用 `orange-*` 强调色 | 替换为 neutral token |
| 7 | P1 | 无 ARIA role 标注 | 全面添加 tablist/radio/switch 等 |
| 8 | P2 | emoji 用作 UI 图标 | 替换为 SVG 内联图标 |
| 9 | P2 | 颜色色板无可访问标签 | 添加 `aria-label` + COLOR_NAMES 映射 |
| 10 | P2 | 使用 `window.prompt/alert/confirm` | InlineDialog + Toast 组件替代 |
