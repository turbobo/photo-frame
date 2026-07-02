// 14 种边框模板 —— 元数据 + 默认配置
// 5 个原有：minimal / polaroid / film / exif / insta
// 8 个新增：leica / red-dot / dazz / instax / xhs / vintage / magazine / location
// 1 个参考：light-shadow（参考「光影边框」App 风格）
import type { TemplateConfig, TemplateId } from '../types'

export interface TemplateMeta {
  id: TemplateId
  name: string
  desc: string
  icon: string
  group: 'basic' | 'brand' | 'film' | 'social'
}

export const TEMPLATES: TemplateMeta[] = [
  // ── 基础 ──
  { id: 'minimal',      group: 'basic',  name: '极简',      desc: '白/黑边 + 底部小字',             icon: '▫️' },
  { id: 'polaroid',     group: 'basic',  name: '拍立得',    desc: '经典上下等宽白边',               icon: '🖼️' },
  { id: 'light-shadow', group: 'basic',  name: '光影',      desc: '底部纯黑薄条 + 单行 EXIF',       icon: '🌓' },
  // ── 品牌风 ──
  { id: 'leica',     group: 'brand',  name: '徕卡栏',    desc: '底部黑栏 + 红点 + 型号',         icon: '🔴' },
  { id: 'red-dot',   group: 'brand',  name: '红点水印',  desc: '右下角悬浮红点 + 参数',          icon: '⚪' },
  { id: 'exif',      group: 'brand',  name: '参数栏',    desc: 'Logo + 光圈快门 ISO',             icon: '📷' },
  // ── 胶片 ──
  { id: 'film',      group: 'film',   name: '胶片',      desc: '黑框齿孔 + 编号',                icon: '🎞️' },
  { id: 'dazz',      group: 'film',   name: 'Dazz 胶卷', desc: '135 胶卷边框 + 日期印字',        icon: '📼' },
  { id: 'instax',    group: 'film',   name: 'Instax',    desc: '真实拍立得比例 + 大留白',         icon: '📸' },
  { id: 'vintage',   group: 'film',   name: '复古纸相框', desc: '牛皮纸纹理 + 做旧边',           icon: '📜' },
  // ── 社交 ──
  { id: 'insta',     group: 'social', name: '社交卡片',  desc: '毛玻璃 + 圆角 + 阴影',           icon: '💬' },
  { id: 'xhs',       group: 'social', name: '小红书',    desc: '3:4 白底卡片 + 标题描述',         icon: '📕' },
  { id: 'magazine',  group: 'social', name: '杂志封面',  desc: '顶部大标题 + 底部 caption',       icon: '📰' },
  { id: 'location',  group: 'social', name: '地理水印',  desc: 'Logo + 型号 + 📍地名 + 日期',     icon: '📍' },
]

export const TEMPLATE_GROUPS: Array<{ id: TemplateMeta['group']; name: string }> = [
  { id: 'basic',  name: '基础' },
  { id: 'brand',  name: '品牌风' },
  { id: 'film',   name: '胶片' },
  { id: 'social', name: '社交' },
]

export function getDefaultConfig(id: TemplateId): TemplateConfig {
  const base: TemplateConfig = {
    id,
    padding: 5,
    bgColor: '#ffffff',
    textColor: '#111111',
    showLogo: true,
    showExif: true,
    customText: '',
    fontSize: 2,
    logoSize: 4,
    radius: 0,
    shadow: false,
    fontFamily: 'noto-serif',
  }
  switch (id) {
    case 'minimal':
      return { ...base, padding: 3, bgColor: '#ffffff', textColor: '#333', shadow: true }
    case 'polaroid':
      return { ...base, padding: 6, bgColor: '#fefdf7', textColor: '#333', fontSize: 2.5, showLogo: false, showExif: false, shadow: true }
    case 'light-shadow':
      return {
        ...base,
        padding: 0,
        bgColor: '#000000',
        textColor: '#ffffff',
        fontSize: 1.2,
        showLogo: false,
        showExif: true,
        shadow: false,
      }
    case 'film':
      return { ...base, padding: 8, bgColor: '#0a0a0a', textColor: '#e5e5e5', showLogo: false, fontSize: 1.6 }
    case 'exif':
      return { ...base, padding: 0, bgColor: '#111111', textColor: '#f5f5f5', fontSize: 1.8, logoSize: 5 }
    case 'insta':
      return { ...base, padding: 5, bgColor: '#ffffff', textColor: '#111', radius: 24, shadow: true, fontSize: 2 }
    case 'leica':
      return { ...base, padding: 0, bgColor: '#111111', textColor: '#ffffff', fontSize: 1.6, logoSize: 3 }
    case 'red-dot':
      return { ...base, padding: 0, bgColor: 'transparent', textColor: '#ffffff', showLogo: false, fontSize: 1.6 }
    case 'dazz':
      return { ...base, padding: 10, bgColor: '#0a0a0a', textColor: '#ffcc33', showLogo: false, fontSize: 1.6 }
    case 'instax':
      return { ...base, padding: 6, bgColor: '#fefdf7', textColor: '#333', fontSize: 2.8, showLogo: false, showExif: false, shadow: true }
    case 'xhs':
      return { ...base, padding: 4, bgColor: '#ffffff', textColor: '#1a1a1a', radius: 12, shadow: true, fontSize: 2.2 }
    case 'vintage':
      return { ...base, padding: 8, bgColor: '#d4b896', textColor: '#4a3728', fontSize: 2.2, showLogo: false, showExif: false }
    case 'magazine':
      return { ...base, padding: 0, bgColor: '#ffffff', textColor: '#111', fontSize: 2.5, showLogo: false }
    case 'location':
      return { ...base, padding: 0, bgColor: '#111111', textColor: '#ffffff', fontSize: 1.6, logoSize: 4 }
  }
}
