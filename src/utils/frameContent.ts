// 边框内容解析层 —— 所有渲染器共享的文案与开关决策
//
// 设计目标：把「显示什么内容」从「怎么排版」中剥离出来，
// 让 21 个渲染器对 showExif / showLogo / hideEmptyExif 保持完全一致的语义。
//
// 语义约定：
// - showExif    控制拍摄参数（焦距/光圈/快门/ISO）与日期
// - showLogo    控制品牌 Logo 图片与品牌标识区（品牌名/型号/镜头）
// - customText  非空时始终优先展示，并替换默认文案
// - hideEmptyExif 为 true 且无任何可展示内容时，渲染器应回退为纯图片输出

import type { ExifData, TemplateConfig } from '../types'
import { cleanupText, formatExifLine, replaceTextVars } from './fonts'

/** 解析自定义文本：非空时做变量替换 + 清理，否则返回 fallback */
export function resolveCustomText(
  customText: string | undefined,
  fallback: string,
  exif: ExifData,
  config: TemplateConfig,
): string {
  if (!customText) return fallback
  return cleanupText(replaceTextVars(customText, exif, {
    locationName: config.locationName,
    copyright: config.copyright,
  }))
}

export interface FrameContent {
  /** 品牌名（受 showLogo 控制） */
  make: string
  /** 品牌型号（受 showLogo 控制） */
  model: string
  /** 镜头信息（受 showLogo 控制） */
  lens: string
  /** 拍摄参数单行文本（受 showExif 控制） */
  exifLine: string
  /** 拍摄日期（受 showExif 控制） */
  date: string
  /** 参数键值对（受 showExif 控制，用于分栏布局） */
  params: Array<{ label: string; value: string }>
  /** 用户自定义文字（已做变量替换，未配置时为空） */
  custom: string
  /** 是否配置了自定义文字 */
  hasCustom: boolean
  /** 主标题：自定义文字优先，其次型号 */
  title: string
  /** 副标题：自定义文字优先，其次 EXIF 行，再次日期 */
  subtitle: string
  /** 品牌标识区（型号或镜头）是否有内容 */
  hasBrand: boolean
  /** 是否存在任何可展示文案 */
  hasAny: boolean
  /** 是否应隐藏整个信息区（hideEmptyExif 生效且无内容） */
  shouldHideInfo: boolean
  /** 品牌 Logo 图片（showLogo 关闭或无 Logo 时为 null） */
  logo: HTMLImageElement | null
}

/**
 * 统一解析边框内容。
 * 所有渲染器都应通过本函数获取文案，避免各自判断开关导致行为不一致。
 */
export function resolveFrameContent(
  exif: ExifData,
  config: TemplateConfig,
  logo: HTMLImageElement | null,
): FrameContent {
  const showLogo = config.showLogo !== false
  const showExif = config.showExif !== false
  const hideEmpty = config.hideEmptyExif !== false

  const custom = config.customText
    ? cleanupText(replaceTextVars(config.customText, exif, {
        locationName: config.locationName,
        copyright: config.copyright,
      }))
    : ''

  const model = showLogo ? (exif.model ?? '') : ''
  const make = showLogo ? (exif.make ?? '') : ''
  const lens = showLogo ? (exif.lens ?? '') : ''
  const exifLine = showExif ? formatExifLine(exif) : ''
  const date = showExif ? (exif.dateTaken ?? '') : ''

  const params: Array<{ label: string; value: string }> = []
  if (showExif) {
    if (exif.focalLength) params.push({ label: '焦距', value: `${Math.round(exif.focalLength)}mm` })
    if (exif.fNumber) params.push({ label: '光圈', value: `f/${exif.fNumber}` })
    if (exif.exposureTime) params.push({ label: '快门', value: exif.exposureTime })
    if (exif.iso) params.push({ label: 'ISO', value: `${exif.iso}` })
  }

  const hasBrand = !!(make || model || lens)
  const hasAny = !!(custom || make || model || lens || exifLine || date || params.length > 0)

  return {
    make,
    model,
    lens,
    exifLine,
    date,
    params,
    custom,
    hasCustom: !!custom,
    title: custom || model,
    subtitle: exifLine || date,
    hasBrand,
    hasAny,
    shouldHideInfo: hideEmpty && !hasAny,
    logo: showLogo ? logo : null,
  }
}

/** 绘制纯图片画布（hideEmptyExif 生效时的统一回退输出） */
export function renderPlainImage(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const c = canvas.getContext('2d')!
  c.drawImage(image, 0, 0, image.width, image.height)
  return canvas
}
