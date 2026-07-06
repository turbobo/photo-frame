# Minimal Clean — Design Theme Spec

> Visual character: serene, breathable, editorial-grade clarity. Content-first with near-invisible chrome. Photo-frame 项目强调「框不抢画」—— 边框是照片的配角。

## Colors

### Brand
- Primary: `#374151` (light) / `#e5e7eb` (dark) — primary actions, links
- Secondary: `#3b82f6` — subtle accent, used sparingly
- Gradient: **none** — accent through weight and position, not color

### Backgrounds
| Role | Light | Dark |
|------|-------|------|
| Page | `#fafafa` | `#111111` |
| Container/Card | `#ffffff` | `#1a1a1a` |
| Sidebar | `#f5f5f5` | `#141414` |
| Elevated (popover) | `#ffffff` | `#222222` |
| Subtle inset (preview canvas) | `#f5f5f4` | `#161616` |

> photo-frame 专用：预览区 canvas 使用 `#f5f5f4`（Stone-50 暖灰），不抢照片风头

### Text
| Role | Light | Dark |
|------|-------|------|
| Primary | `#1c1917` | `#f3f4f6` |
| Secondary | `#78716c` | `#9ca3af` |
| Tertiary | `#a8a29e` | `#6b7280` |

### Borders
| Role | Light | Dark |
|------|-------|------|
| Default | `#e7e5e4` hairline | `rgba(255,255,255,0.08)` |
| Strong/Focus | `#d6d3d1` | `rgba(255,255,255,0.15)` |

### Interactive
- Hover bg: `#f3f4f6` light / `rgba(255,255,255,0.04)` dark
- Active bg: `#e5e7eb` light / `rgba(255,255,255,0.08)` dark

## Spacing

Base unit: **4px**. Scale: `4 / 8 / 16 / 24 / 32 / 48 / 64`.
Generous whitespace — prefer larger spacing values to create breathing room.

- Page max-width: 960px (narrower for readability), padding: 32px
- Card grid gap: 24px
- Card internal padding: 24px
- Section header margin-bottom: 32px
- Mobile page padding: 20px

## Border Radius

- Small (buttons, inputs): **4px** — crisp, almost square
- Medium (cards, dropdowns): **6px**
- Large (modals, drawers): **8px**
- Avoid overly rounded shapes; keep geometric precision

> photo-frame 模板卡使用 12px（照片边角），与 Copicseal 对齐

## Shadows

### Light Mode
Nearly invisible at rest; shadows appear only on interaction.

- SM: `0 1px 2px rgba(0,0,0,0.05)` (barely there, hover only)
- MD: `0 2px 8px rgba(0,0,0,0.08)` (card hover)
- LG: `0 4px 16px rgba(0,0,0,0.10)` (modals)

### Dark Mode
No glow effects; clean dark shadows only.

- SM: `0 1px 2px rgba(0,0,0,0.4)`
- MD: `0 4px 12px rgba(0,0,0,0.5)`
- LG: `0 8px 24px rgba(0,0,0,0.6)`

## Motion

- Base duration: **150ms** (snappy, decisive)
- Easing: `cubic-bezier(0.2, 0, 0, 1)` — smooth, no overshoot
- Hover effect: **no translate/lift** — only background-color or border-color change
- Card entrance: simple `opacity 0→1`, 300ms, no translate
- No elastic/bounce curves; movement is restrained and purposeful
- Transitions on border-color and background only

## Component Visual Rules

### Cards
- Border: 1px solid default border, no brand tint
- No gradient overlays at any state
- Hover: background stays same, border darkens slightly (light) or brightens (dark)
- No shadow at rest; subtle SM shadow on hover only
- Clean, flat, minimal chrome

### Forms
- Inputs: clean border, no background color differentiation
- Focus: thin 2px outline using primary color at 30% opacity (no fill)
- Dark mode: inputs use container-matching background, 1px white-alpha border

### Tables
- Header: medium gray, uppercase 10px tracking
- Row hover: subtle bg shift to `#f3f4f6`
- Border-bottom only, no vertical dividers

### Status Colors
- Success: `#16a34a` muted green
- Warning: `#d97706` muted amber
- Error: `#dc2626` muted red
- Info: `#2563eb` muted blue
- Neutral: `#6b7280` medium gray

## Scrollbar
- Width: **6px** (slightly thicker than reference for accessibility)
- Thumb radius: 3px
- Color: `rgba(0,0,0,0.2)` light / `rgba(255,255,255,0.15)` dark
- Track: transparent

## Font Stack

- UI: `Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Noto Sans SC', 'Helvetica Neue', sans-serif`
- Display (照片签名/标题): `Noto Serif SC, 'Songti SC', 'Source Han Serif SC', serif`
- Mono (EXIF 参数): `'JetBrains Mono', 'SF Mono', 'Menlo', monospace`
- Hand (手写签名): `'LXGW WenKai Mono TC', 'STKaiti', 'Kaiti SC', cursive`

## Photo-Frame 专属规则

> photo-frame 是「框不抢画」的照片水印工具，边框设计遵循以下额外约束：

### 照片边框处理
- 边框必须**中性**（白/黑/灰），不使用品牌色
- 边框宽度：照片长边 2-8%（默认 4%）
- 边框不应遮挡照片主体内容

### 文字排版层级
- 主文字（照片签名）：Display 字体，字号 = 照片长边 × 1.5-2%
- 次文字（EXIF 参数）：Mono 字体，字号 = 照片长边 × 1-1.5%
- 辅助文字（日期/地点）：UI 字体，字号 = 照片长边 × 0.8-1%

### 模板卡预览
- 缩略图必须**真实渲染**模板效果（不是 icon）
- 预览使用占位渐变图（紫→橙），模拟真实照片
- 选中态：2px accent border + SM shadow

### 导出按钮
- 使用 outline 按钮样式（与单张导出一致）
- 不使用渐变/强调色（保持中性）
- 文字：13px medium，与页面其他按钮一致

---

## Enforcement

**所有前端开发必须遵守本规范**：
- 所有颜色必须匹配本规范色板 — 无 ad-hoc 颜色值
- 间距、圆角、阴影必须遵循本规范的 scale
- 动效必须使用本规范的 duration 和 easing 值
- 卡片、表单、表格必须遵循本规范的视觉处理描述
- Light/Dark 双模式都必须处理
- 状态色（success/warning/error/info）必须使用本规范的语义色板

> 运行 `/theme` 可随时审查或调整主题。AI 将在所有前端开发中自动遵循本规范。
