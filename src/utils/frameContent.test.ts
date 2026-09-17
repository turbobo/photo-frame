import { describe, expect, it } from 'vitest'
import type { ExifData, TemplateConfig } from '../types'
import { resolveFrameContent } from './frameContent'

const BASE_CONFIG: TemplateConfig = {
  id: 'minimal',
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

const FULL_EXIF: ExifData = {
  make: 'Nikon',
  model: 'Z 5',
  lens: 'NIKKOR Z 50mm f/1.8 S',
  fNumber: 1.8,
  exposureTime: '1/250',
  iso: 250,
  focalLength: 50,
  dateTaken: '2025-01-15',
}

function withConfig(patch: Partial<TemplateConfig>): TemplateConfig {
  return { ...BASE_CONFIG, ...patch }
}

describe('resolveFrameContent 开关语义', () => {
  it('默认开启时输出型号、参数行与日期', () => {
    const content = resolveFrameContent(FULL_EXIF, BASE_CONFIG, null)
    expect(content.model).toBe('Z 5')
    expect(content.lens).toBe('NIKKOR Z 50mm f/1.8 S')
    expect(content.params).toHaveLength(4)
    expect(content.date).toBe('2025-01-15')
    expect(content.hasAny).toBe(true)
    expect(content.shouldHideInfo).toBe(false)
  })

  it('showExif=false 时清空参数与日期，但保留品牌信息', () => {
    const content = resolveFrameContent(FULL_EXIF, withConfig({ showExif: false }), null)
    expect(content.model).toBe('Z 5')
    expect(content.exifLine).toBe('')
    expect(content.date).toBe('')
    expect(content.params).toEqual([])
    expect(content.hasAny).toBe(true)
  })

  it('showLogo=false 时清空型号与镜头，并隐藏 Logo 图片', () => {
    const logo = { width: 100, height: 40 } as HTMLImageElement
    const content = resolveFrameContent(FULL_EXIF, withConfig({ showLogo: false }), logo)
    expect(content.model).toBe('')
    expect(content.make).toBe('')
    expect(content.lens).toBe('')
    expect(content.logo).toBeNull()
    expect(content.params).toHaveLength(4)
  })

  it('开启 showLogo 时提供品牌名，供合成模板拼接品牌块', () => {
    const content = resolveFrameContent(FULL_EXIF, BASE_CONFIG, null)
    expect(content.make).toBe('Nikon')
    expect(content.hasBrand).toBe(true)
  })

  it('仅有品牌名时也应视为有内容', () => {
    const content = resolveFrameContent({ make: 'Sony' }, BASE_CONFIG, null)
    expect(content.hasAny).toBe(true)
    expect(content.shouldHideInfo).toBe(false)
  })

  it('自定义文字优先作为标题', () => {
    const content = resolveFrameContent(FULL_EXIF, withConfig({ customText: '我的作品' }), null)
    expect(content.title).toBe('我的作品')
    expect(content.hasCustom).toBe(true)
    expect(content.subtitle).toBe('50mm  ·  f/1.8  ·  1/250  ·  ISO250')
  })

  it('自定义文字支持变量替换', () => {
    const content = resolveFrameContent(FULL_EXIF, withConfig({ customText: '{Model} · {ISO}' }), null)
    expect(content.custom).toBe('Z 5 · ISO250')
  })

  it('无 EXIF 且无自定义文字时标记隐藏信息区', () => {
    const content = resolveFrameContent({}, BASE_CONFIG, null)
    expect(content.hasAny).toBe(false)
    expect(content.shouldHideInfo).toBe(true)
  })

  it('hideEmptyExif=false 时即使无内容也不隐藏', () => {
    const content = resolveFrameContent({}, withConfig({ hideEmptyExif: false }), null)
    expect(content.hasAny).toBe(false)
    expect(content.shouldHideInfo).toBe(false)
  })

  it('仅关闭全部开关但有自定义文字时仍有内容', () => {
    const config = withConfig({ showExif: false, showLogo: false, customText: '签名' })
    const content = resolveFrameContent(FULL_EXIF, config, null)
    expect(content.hasAny).toBe(true)
    expect(content.shouldHideInfo).toBe(false)
    expect(content.title).toBe('签名')
  })
})
