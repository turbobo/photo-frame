// 5 种边框模板 —— 元数据 + 默认配置
import type { TemplateConfig, TemplateId } from '../types'

export interface TemplateMeta {
  id: TemplateId
  name: string
  desc: string
  icon: string
}

export const TEMPLATES: TemplateMeta[] = [
  { id: 'minimal',  name: '极简',    desc: '白/黑边 + 底部小字', icon: '▫️' },
  { id: 'polaroid', name: '拍立得',  desc: '上下等宽白边',       icon: '🖼️' },
  { id: 'film',     name: '胶片',    desc: '黑框齿孔 + 编号',    icon: '🎞️' },
  { id: 'exif',     name: '参数栏',  desc: 'Logo + 光圈快门 ISO',icon: '📷' },
  { id: 'insta',    name: '社交',    desc: '毛玻璃卡片 + 圆角',  icon: '💬' },
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
  }
  switch (id) {
    case 'minimal':
      return { ...base, padding: 3, bgColor: '#ffffff', textColor: '#333' }
    case 'polaroid':
      return { ...base, padding: 6, bgColor: '#fefdf7', textColor: '#333', fontSize: 2.5, showLogo: false, showExif: false, customText: '' }
    case 'film':
      return { ...base, padding: 8, bgColor: '#0a0a0a', textColor: '#e5e5e5', showLogo: false, fontSize: 1.6 }
    case 'exif':
      return { ...base, padding: 0, bgColor: '#111111', textColor: '#f5f5f5', fontSize: 1.8, logoSize: 5 }
    case 'insta':
      return { ...base, padding: 5, bgColor: '#ffffff', textColor: '#111', radius: 24, shadow: true, fontSize: 2 }
  }
}
