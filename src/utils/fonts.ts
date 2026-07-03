// 水印字体系统 —— 4 套字体栈 + 可选字体
// 字体已在 main.tsx 中通过 @fontsource 注入
import type { FontFamily } from '../types'

/**
 * Display — 思源宋体
 * 用于：相机型号、品牌名、大标题
 * 特点：优雅、文艺、画廊级高级感
 */
export const FONT_DISPLAY = '"Noto Serif SC", "Songti SC", "Source Han Serif SC", "STSong", serif'

/**
 * UI Sans — Inter
 * 用于：副标题、地点、标签、次要文字
 * 特点：干净、现代、可读性极佳
 */
export const FONT_UI = '"Inter", -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif'

/**
 * Mono — JetBrains Mono
 * 用于：EXIF 参数（光圈/快门/ISO）、胶片编号、日期
 * 特点：tabular nums、等宽对齐、技术感
 */
export const FONT_MONO = '"JetBrains Mono", "SF Mono", "Menlo", monospace'

/**
 * Hand — 霞鹜文楷
 * 用于：手写签名、拍立得文字、复古纸相框
 * 特点：优雅中文楷体、有温度
 */
export const FONT_HAND = '"LXGW WenKai Mono TC", "STKaiti", "Kaiti SC", "Kaiti", cursive'

// ────────────────────────────────────────────────
// 可选字体（用于 Display 位置替换）
// ────────────────────────────────────────────────

export const FONT_FAMILIES: Array<{ key: FontFamily; label: string; stack: string }> = [
  { key: 'noto-serif',  label: '宋体',  stack: FONT_DISPLAY },
  { key: 'noto-sans',   label: '黑体',  stack: '"Noto Sans SC", "PingFang SC", "Helvetica Neue", sans-serif' },
  { key: 'inter',       label: '西文',  stack: FONT_UI },
  { key: 'jetbrains',   label: '等宽',  stack: FONT_MONO },
  { key: 'wenkai',      label: '手写',  stack: FONT_HAND },
]

export function getFontStack(family?: FontFamily): string {
  if (!family) return FONT_DISPLAY
  return FONT_FAMILIES.find(f => f.key === family)?.stack ?? FONT_DISPLAY
}

// ────────────────────────────────────────────────
// 字体角色映射：按角色 + 用户选择的 fontFamily 给出合理栈
// ────────────────────────────────────────────────

export type FontRole = 'display' | 'ui' | 'mono' | 'hand' | 'accent'

/**
 * JetBrains Mono 的 CJK 友好回退栈（JetBrains Mono 仅覆盖拉丁）
 * - mono 角色：JetBrains Mono + Noto Sans Mono CJK SC（保持等宽对齐，EXIF 数字对齐）
 * - 其他角色：JetBrains Mono + Noto Sans SC（中文可读性优先）
 */
const JETBRAINS_MONO_STACK =
  '"JetBrains Mono", "Noto Sans Mono CJK SC", "SF Mono", "Menlo", monospace'
const JETBRAINS_UI_STACK =
  '"JetBrains Mono", "Noto Sans SC", "PingFang SC", "Helvetica Neue", sans-serif'

/**
 * 按角色 + 全局 fontFamily 给出实际 font stack。
 * 设计原则：用户选择影响照片上的**所有文字**（型号/EXIF/自定义文字/签名），
 * 仅在所选字体不支持 CJK 时智能回退。
 */
export function getFontForRole(role: FontRole, family?: FontFamily): string {
  const primary = getFontStack(family) // 用户选的主字体

  // JetBrains Mono 仅覆盖拉丁字符，CJK 场景需要回退栈
  if (family === 'jetbrains') {
    if (role === 'mono') return JETBRAINS_MONO_STACK
    return JETBRAINS_UI_STACK
  }

  // 其他字体都支持 CJK，所有角色（display/ui/mono/hand/accent）统一用 primary
  return primary
}

// ────────────────────────────────────────────────
// 响应式分级：按图像长边自动调整信息密度与字号倍率
// ────────────────────────────────────────────────

export type ResponsiveLevel = 'compact' | 'normal' | 'detail'

export interface ResponsiveConfig {
  level: ResponsiveLevel
  fontScale: number    // 字号总倍率
  detailLevel: number  // 0/1/2（EXIF 信息密度）
}

/**
 * 按图像长边返回响应式配置：
 * - < 800px:     compact  0.85× 少细节（手机端分享）
 * - 800-2000px:  normal   1.0×  标准
 * - > 2000px:    detail   1.05× 全部细节（桌面打印）
 */
export function getResponsive(long: number): ResponsiveConfig {
  if (long < 800) {
    return { level: 'compact', fontScale: 0.85, detailLevel: 0 }
  }
  if (long > 2000) {
    return { level: 'detail', fontScale: 1.05, detailLevel: 2 }
  }
  return { level: 'normal', fontScale: 1.0, detailLevel: 1 }
}

// ────────────────────────────────────────────────
// 排版工具
// ────────────────────────────────────────────────

/** 根据字号生成带 letter-spacing 的 CSS font shorthand */
export function fontStr(
  weight: number,
  size: number,
  family: string,
  spacing = 0,
): string {
  const ls = spacing !== 0 ? `${spacing}em` : '0'
  // Note: letter-spacing 在 canvas 里通过 ctx.letterSpacing 设置
  void ls
  return `${weight} ${size}px ${family}`
}

/** 水印排版常量 */
export const WATERMARK = {
  // 字号比例（相对于图片长边）
  SCALE: {
    title: 1.0,      // 标题基准
    sub:   0.7,      // 副标 70%
    param: 0.6,      // 参数 60%
    label: 0.45,     // 标签 45%
    signature: 1.1,  // 签名 110%（手写体偏小）
  },
  // 颜色透明度
  OPACITY: {
    primary:   1.0,   // 主色
    secondary: 0.75,  // 次色
    tertiary:  0.55,  // 参色
    label:     0.5,   // 标签
  },
  // Letter-spacing（em）
  SPACING: {
    title: 0.04,   // 标题宽字距
    sub:   0.02,   // 副标微宽
    param: 0,      // 参数对齐（tabular nums）
    label: 0.08,   // 标签大写宽字距
  },
} as const

/** 混合颜色与透明度（#RRGGBB + alpha → rgba） */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** 拼装 EXIF 参数（用 · 分隔，更优雅） */
export function formatExifLine(exif: {
  focalLength?: number
  fNumber?: number
  exposureTime?: string
  iso?: number
}): string {
  const parts: string[] = []
  if (exif.focalLength) parts.push(`${Math.round(exif.focalLength)}mm`)
  if (exif.fNumber) parts.push(`f/${exif.fNumber}`)
  if (exif.exposureTime) parts.push(exif.exposureTime)
  if (exif.iso) parts.push(`ISO${exif.iso}`)
  return parts.join('  ·  ')
}
