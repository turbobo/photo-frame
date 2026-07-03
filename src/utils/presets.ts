// 模板预设系统（参考 Copicseal TemplatePreset）
// 支持保存 / 加载 / 删除用户自定义预设，内置 5 个官方预设

import type { TemplateConfig, TemplateId } from '../types'
import { getDefaultConfig } from '../templates'

const STORAGE_KEY = 'photo-frame-presets'

export interface TemplatePreset {
  id: string
  name: string
  config: TemplateConfig
  createdAt: number
  official?: boolean  // 是否官方内置（不可删除）
}

/** 官方内置预设（8 个） */
export const OFFICIAL_PRESETS: TemplatePreset[] = [
  {
    id: 'official-minimal-light',
    name: '极简白边',
    config: {
      ...getDefaultConfig('minimal'),
      id: 'minimal' as TemplateId,
      bgColor: '#ffffff',
      textColor: '#333333',
      customText: '{Make} {Model}  {FocalLength} {FNumber} {ExposureTime} {ISO}',
      fontFamily: 'noto-serif',
    },
    createdAt: Date.now(),
    official: true,
  },
  {
    id: 'official-dark-pro',
    name: '专业深色',
    config: {
      ...getDefaultConfig('exif'),
      id: 'exif' as TemplateId,
      bgColor: '#111111',
      textColor: '#f5f5f5',
      customText: '{Model} · {Lens}',
      fontFamily: 'inter',
    },
    createdAt: Date.now(),
    official: true,
  },
  {
    id: 'official-vintage-film',
    name: '复古胶片',
    config: {
      ...getDefaultConfig('film'),
      id: 'film' as TemplateId,
      customText: '{Make} {Model}  {FocalLength} {FNumber}',
      fontFamily: 'jetbrains',
    },
    createdAt: Date.now(),
    official: true,
  },
  {
    id: 'official-social-ready',
    name: '社交分享',
    config: {
      ...getDefaultConfig('insta'),
      id: 'insta' as TemplateId,
      customText: '{Model} | {DateTime}',
      fontFamily: 'noto-sans',
    },
    createdAt: Date.now(),
    official: true,
  },
  {
    id: 'official-print-hd',
    name: '高清打印',
    config: {
      ...getDefaultConfig('white-border'),
      id: 'white-border' as TemplateId,
      customText: '{Make} {Model}  {Lens}  {FocalLength} {FNumber} {ExposureTime} {ISO}',
      fontFamily: 'noto-serif',
      borderPadding: 5,
    },
    createdAt: Date.now(),
    official: true,
  },
  {
    id: 'official-leica-classic',
    name: '徕卡经典',
    config: {
      ...getDefaultConfig('leica'),
      id: 'leica' as TemplateId,
      bgColor: '#111111',
      textColor: '#ffffff',
      customText: '{FocalLength} {FNumber} {ExposureTime} {ISO}',
      fontFamily: 'inter',
    },
    createdAt: Date.now(),
    official: true,
  },
  {
    id: 'official-handwrite-polaroid',
    name: '手写拍立得',
    config: {
      ...getDefaultConfig('instax'),
      id: 'instax' as TemplateId,
      customText: '{DateTime}',
      fontFamily: 'wenkai',
    },
    createdAt: Date.now(),
    official: true,
  },
  {
    id: 'official-text-overlay',
    name: '内嵌水印',
    config: {
      ...getDefaultConfig('text-embed'),
      id: 'text-embed' as TemplateId,
      customText: '{Model}\n{FocalLength} {FNumber} {ExposureTime} {ISO}\n{DateTime}',
      fontFamily: 'inter',
      embedLayout: 'v',
      embedPosition: 7,
      embedOpacity: 0.6,
    },
    createdAt: Date.now(),
    official: true,
  },
]

/** 生成唯一 ID */
function generateId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 加载所有预设（官方 + 用户） */
export function loadPresets(): TemplatePreset[] {
  if (typeof window === 'undefined') return [...OFFICIAL_PRESETS]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...OFFICIAL_PRESETS]
    const userPresets: TemplatePreset[] = JSON.parse(raw)
    return [...OFFICIAL_PRESETS, ...userPresets]
  } catch (e) {
    console.warn('loadPresets failed:', e)
    return [...OFFICIAL_PRESETS]
  }
}

/** 仅加载用户预设（不含官方） */
export function loadUserPresets(): TemplatePreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/** 保存当前配置为新预设 */
export function savePreset(name: string, config: TemplateConfig): TemplatePreset {
  const newPreset: TemplatePreset = {
    id: generateId(),
    name,
    config: { ...config },
    createdAt: Date.now(),
    official: false,
  }
  const userPresets = loadUserPresets()
  userPresets.push(newPreset)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets))
  } catch (e) {
    console.warn('savePreset failed:', e)
  }
  return newPreset
}

/** 删除用户预设（官方不可删除） */
export function deletePreset(id: string): boolean {
  const userPresets = loadUserPresets()
  const filtered = userPresets.filter(p => p.id !== id)
  if (filtered.length === userPresets.length) return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    return true
  } catch {
    return false
  }
}

/** 更新已有用户预设 */
export function updatePreset(id: string, name: string, config: TemplateConfig): boolean {
  const userPresets = loadUserPresets()
  const idx = userPresets.findIndex(p => p.id === id)
  if (idx === -1) return false
  userPresets[idx] = { ...userPresets[idx], name, config: { ...config } }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets))
    return true
  } catch {
    return false
  }
}
