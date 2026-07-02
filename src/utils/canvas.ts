// Canvas 渲染核心 —— 13 种边框模板绘制
import type { ExifData, TemplateConfig } from '../types'
import {
  FONT_DISPLAY, FONT_UI, FONT_MONO, FONT_HAND,
  WATERMARK, withAlpha, formatExifLine,
} from './fonts'

export interface RenderCtx {
  image: HTMLImageElement
  exif: ExifData
  logo: HTMLImageElement | null
  config: TemplateConfig
}

/**
 * 主入口：根据 config.id 分发到对应渲染器
 * 返回一个 offscreen canvas，用于预览与导出
 *
 * 防御性处理：强制 padding ≥ 2%，避免极小值触发渲染异常
 */
export function renderFrame(ctx: RenderCtx): HTMLCanvasElement {
  const safePadding = Math.max(2, ctx.config.padding)
  const safeFontSize = Math.max(1, ctx.config.fontSize)
  const safeConfig = {
    ...ctx.config,
    padding: safePadding,
    fontSize: safeFontSize,
  }
  const safeCtx = { ...ctx, config: safeConfig }

  switch (safeConfig.id) {
    case 'minimal':  return renderMinimal(safeCtx)
    case 'polaroid': return renderPolaroid(safeCtx)
    case 'film':     return renderFilm(safeCtx)
    case 'exif':     return renderExif(safeCtx)
    case 'insta':    return renderInsta(safeCtx)
    case 'leica':    return renderLeica(safeCtx)
    case 'red-dot':  return renderRedDot(safeCtx)
    case 'dazz':     return renderDazz(safeCtx)
    case 'instax':   return renderInstax(safeCtx)
    case 'xhs':      return renderXhs(safeCtx)
    case 'vintage':  return renderVintage(safeCtx)
    case 'magazine': return renderMagazine(safeCtx)
    case 'location': return renderLocation(safeCtx)
    default:         return renderMinimal(safeCtx)
  }
}

/** 工具：字符串在 canvas 上宽度 */
function textWidth(c: CanvasRenderingContext2D, s: string) {
  return c.measureText(s).width
}

/** 工具：绘制圆角矩形路径 */
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  c.beginPath()
  c.moveTo(x + r, y)
  c.lineTo(x + w - r, y)
  c.arcTo(x + w, y, x + w, y + r, r)
  c.lineTo(x + w, y + h - r)
  c.arcTo(x + w, y + h, x + w - r, y + h, r)
  c.lineTo(x + r, y + h)
  c.arcTo(x, y + h, x, y + h - r, r)
  c.lineTo(x, y + r)
  c.arcTo(x, y, x + r, y, r)
  c.closePath()
}

/**
 * 卡片绘制辅助：根据 config.shadow 决定绘制方式
 * - shadow=true：三层渐进阴影（blur 大→小、alpha 小→大）→ 柔和高级感
 * - shadow=false：单色矩形填充
 *
 * 返回 { cardX, cardY, cardW, cardH } 表示卡片实际区域（含阴影时的内缩）
 */
function drawCard(
  c: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  config: TemplateConfig,
  long: number,
): { cardX: number; cardY: number; cardW: number; cardH: number } {
  if (config.shadow) {
    const blur = Math.round(long * 0.04)          // 4% 长边 → 更强的模糊
    const spread = Math.round(blur * 0.4)         // 阴影外扩
    c.save()
    // 第 1 层：大范围柔和（模拟环境光）
    c.shadowColor = 'rgba(28, 25, 23, 0.08)'
    c.shadowBlur = blur * 1.5
    c.shadowOffsetY = blur * 0.6
    c.fillStyle = config.bgColor
    roundRect(c, spread, spread, canvas.width - spread * 2, canvas.height - spread * 2, config.radius)
    c.fill()
    c.restore()

    c.save()
    // 第 2 层：中等模糊（过渡）
    c.shadowColor = 'rgba(28, 25, 23, 0.12)'
    c.shadowBlur = blur * 0.8
    c.shadowOffsetY = blur * 0.3
    c.fillStyle = config.bgColor
    roundRect(c, spread, spread, canvas.width - spread * 2, canvas.height - spread * 2, config.radius)
    c.fill()
    c.restore()

    c.save()
    // 第 3 层：小范围锐利（近接触阴影）
    c.shadowColor = 'rgba(28, 25, 23, 0.15)'
    c.shadowBlur = blur * 0.3
    c.shadowOffsetY = blur * 0.1
    c.fillStyle = config.bgColor
    roundRect(c, spread, spread, canvas.width - spread * 2, canvas.height - spread * 2, config.radius)
    c.fill()
    c.restore()

    // 实际卡片位置（内缩 spread）
    return {
      cardX: spread,
      cardY: spread,
      cardW: canvas.width - spread * 2,
      cardH: canvas.height - spread * 2,
    }
  }

  // 无阴影：直接填充
  c.fillStyle = config.bgColor
  roundRect(c, 0, 0, canvas.width, canvas.height, config.radius)
  c.fill()
  return { cardX: 0, cardY: 0, cardW: canvas.width, cardH: canvas.height }
}

/** 拼装 EXIF 主要参数字符串 */
function formatExifLine(exif: ExifData): string {
  const parts: string[] = []
  if (exif.focalLength) parts.push(`${Math.round(exif.focalLength)}mm`)
  if (exif.fNumber) parts.push(`f/${exif.fNumber}`)
  if (exif.exposureTime) parts.push(exif.exposureTime)
  if (exif.iso) parts.push(`ISO${exif.iso}`)
  return parts.join(' · ')
}

// ═══════════════════════════════════════════════════════
// 模板 1：极简 Minimal —— 上下左右等宽白边 + 底部一行小字
// ═══════════════════════════════════════════════════════
function renderMinimal({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width
  const H = image.height
  const long = Math.max(W, H)
  const pad = Math.round(long * config.padding / 100)
  const bottomExtra = Math.round(long * 0.06)
  const spread = config.shadow ? Math.round(long * 0.04 * 0.4) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2 + spread * 2
  canvas.height = H + pad * 2 + bottomExtra + spread * 2
  const c = canvas.getContext('2d')!

  // 画布背景（阴影外围区域）
  c.fillStyle = '#a8a39d'
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 卡片 + 三层阴影
  const { cardX, cardY } = drawCard(c, canvas, config, long)

  c.drawImage(image, cardX + pad, cardY + pad, W, H)

  // 底部文字
  const fontPx = Math.round(long * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `500 ${fontPx}px ${FONT_UI}`
  c.textBaseline = 'middle'

  const centerY = cardY + pad + H + bottomExtra / 2
  const line = config.customText || [exif.model, formatExifLine(exif)].filter(Boolean).join('  ·  ')
  if (line) {
    c.textAlign = 'center'
    c.fillText(line, canvas.width / 2, centerY)
  }

  // 左下 Logo
  if (config.showLogo && logo) {
    const lh = Math.round(long * config.logoSize / 100)
    const lw = lh * (logo.width / logo.height)
    c.drawImage(logo, cardX + pad, centerY - lh / 2, lw, lh)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 2：拍立得 Polaroid —— 上左右窄边，下方大留白
// ═══════════════════════════════════════════════════════
function renderPolaroid({ image, config, exif }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const sidePad = Math.round(long * config.padding / 100)
  const bottomPad = Math.round(long * config.padding / 100 * 3) // 底部约 3x
  const spread = config.shadow ? Math.round(long * 0.04 * 0.4) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W + sidePad * 2 + spread * 2
  canvas.height = H + sidePad + bottomPad + spread * 2
  const c = canvas.getContext('2d')!

  c.fillStyle = '#a8a39d'
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 卡片 + 三层阴影
  const { cardX, cardY } = drawCard(c, canvas, config, long)

  // 图像内部轻微内阴影感（微暗底色）
  c.drawImage(image, cardX + sidePad, cardY + sidePad, W, H)

  // 底部签名文字
  const fontPx = Math.round(long * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `italic 500 ${fontPx}px ${FONT_HAND}`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const line = config.customText || exif.dateTaken || ''
  if (line) c.fillText(line, canvas.width / 2, cardY + sidePad + H + bottomPad / 2)

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 3：胶片 Film —— 黑色边框 + 齿孔 + 胶片编号
// ═══════════════════════════════════════════════════════
function renderFilm({ image, exif, config }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  // 强制最小边距，避免 holeGap = 0 导致死循环
  const minPad = Math.max(16, Math.round(long * 0.008))
  const pad = Math.max(minPad, Math.round(long * config.padding / 100))

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2
  canvas.height = H + pad * 2
  const c = canvas.getContext('2d')!

  c.fillStyle = config.bgColor
  c.fillRect(0, 0, canvas.width, canvas.height)

  c.drawImage(image, pad, pad, W, H)

  // 齿孔（上下各一排）
  const holeR = pad * 0.18
  const holeGap = Math.max(1, pad * 1.6)
  c.fillStyle = '#000'
  const drawHoles = (yCenter: number) => {
    const maxIter = 200 // 绝对上限防止意外
    let iter = 0
    for (let x = pad + holeGap; x < canvas.width - pad - holeGap && iter < maxIter; x += holeGap) {
      c.beginPath()
      c.arc(x, yCenter, holeR, 0, Math.PI * 2)
      c.fillStyle = 'rgba(255,255,255,0.85)'
      c.fill()
      iter++
    }
  }
  drawHoles(pad / 2)
  drawHoles(canvas.height - pad / 2)

  // 底部胶片编号 + EXIF
  const fontPx = Math.round(long * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `${fontPx}px ${FONT_MONO}`
  c.textBaseline = 'middle'

  // 左下：帧号（用 dateTaken 后 4 位或随机）
  const frame = exif.dateTaken?.replace(/\D/g, '').slice(-4) || '0001'
  c.textAlign = 'left'
  c.fillText(`▶ FRAME ${frame}`, pad + holeGap, canvas.height - pad / 2 - holeR - fontPx * 0.9)

  // 右下：EXIF
  const exifLine = config.customText || formatExifLine(exif) || (exif.model ?? '')
  if (exifLine) {
    c.textAlign = 'right'
    c.fillText(exifLine, canvas.width - pad - holeGap, canvas.height - pad / 2 - holeR - fontPx * 0.9)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 4：EXIF 参数栏 —— 底部深色信息栏
// ═══════════════════════════════════════════════════════
function renderExif({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const barH = Math.round(long * 0.12)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H + barH
  const c = canvas.getContext('2d')!

  c.drawImage(image, 0, 0, W, H)

  c.fillStyle = config.bgColor
  c.fillRect(0, H, W, barH)

  const padX = Math.round(W * 0.04)
  const centerY = H + barH / 2
  const fontPx = Math.round(long * config.fontSize / 100)

  // ── 左侧：Logo + 型号 ──
  let leftX = padX
  if (config.showLogo && logo) {
    const lh = Math.round(long * config.logoSize / 100)
    const lw = lh * (logo.width / logo.height)
    c.drawImage(logo, leftX, centerY - lh / 2, lw, lh)
    leftX += lw + padX * 0.6
  }

  c.fillStyle = config.textColor
  c.textBaseline = 'middle'
  c.textAlign = 'left'

  const modelText = exif.model || '—'
  c.font = `500 ${Math.round(fontPx * 1.25)}px ${FONT_DISPLAY}`
  c.fillText(modelText, leftX, centerY - fontPx * 0.5)

  c.fillStyle = 'rgba(255,255,255,0.55)'
  c.font = `400 ${Math.round(fontPx * 0.85)}px ${FONT_UI}`
  const lensText = exif.lens || config.customText || ''
  if (lensText) c.fillText(lensText, leftX, centerY + fontPx * 0.7)

  // ── 右侧：光圈 快门 ISO 焦距 ──
  const rightBlocks: Array<{ label: string; value: string }> = []
  if (exif.focalLength) rightBlocks.push({ label: '焦距', value: `${Math.round(exif.focalLength)}mm` })
  if (exif.fNumber) rightBlocks.push({ label: '光圈', value: `f/${exif.fNumber}` })
  if (exif.exposureTime) rightBlocks.push({ label: '快门', value: exif.exposureTime })
  if (exif.iso) rightBlocks.push({ label: 'ISO', value: `${exif.iso}` })

  if (rightBlocks.length) {
    const gap = Math.round(padX * 0.9)
    const blockFontValue = Math.round(fontPx * 1.2)
    const blockFontLabel = Math.round(fontPx * 0.7)
    let rightX = W - padX
    for (let i = rightBlocks.length - 1; i >= 0; i--) {
      const b = rightBlocks[i]
      c.textAlign = 'right'
      c.fillStyle = config.textColor
      c.font = `500 ${blockFontValue}px ${FONT_MONO}`
      c.fillText(b.value, rightX, centerY - blockFontLabel * 0.5)
      c.fillStyle = 'rgba(255,255,255,0.55)'
      c.font = `400 ${blockFontLabel}px ${FONT_UI}`
      c.fillText(b.label, rightX, centerY + blockFontValue * 0.6)
      const blockW = Math.max(c.measureText(b.value).width, c.measureText(b.label).width)
      rightX -= blockW + gap
    }
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 5：社交 Insta —— 白底毛玻璃 + 圆角 + 阴影
// ═══════════════════════════════════════════════════════
function renderInsta({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const pad = Math.round(long * config.padding / 100)
  const bottomExtra = Math.round(long * 0.09)
  const spread = config.shadow ? Math.round(long * 0.04 * 0.4) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2 + spread * 2
  canvas.height = H + pad * 2 + bottomExtra + spread * 2
  const c = canvas.getContext('2d')!

  // 全画布背景（半透明遮罩）
  c.fillStyle = '#f2f4f8'
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 卡片 + 三层阴影
  const { cardX, cardY } = drawCard(c, canvas, config, long)

  // 图像圆角剪裁
  const imgX = cardX + pad
  const imgY = cardY + pad
  c.save()
  roundRect(c, imgX, imgY, W, H, Math.max(0, config.radius - pad * 0.3))
  c.clip()
  c.drawImage(image, imgX, imgY, W, H)
  c.restore()

  // 底部信息
  const fontPx = Math.round(long * config.fontSize / 100)
  const centerY = imgY + H + bottomExtra / 2
  c.textBaseline = 'middle'

  // 左侧 Logo + 型号
  let leftX = imgX
  if (config.showLogo && logo) {
    const lh = Math.round(long * config.logoSize / 100)
    const lw = lh * (logo.width / logo.height)
    c.drawImage(logo, leftX, centerY - lh / 2, lw, lh)
    leftX += lw + long * 0.015
  }
  c.fillStyle = config.textColor
  c.textAlign = 'left'
  c.font = `500 ${Math.round(fontPx * 1.15)}px ${FONT_DISPLAY}`
  const title = config.customText || exif.model || ''
  if (title) c.fillText(title, leftX, centerY - fontPx * 0.5)
  c.fillStyle = 'rgba(0,0,0,0.55)'
  c.font = `400 ${Math.round(fontPx * 0.85)}px ${FONT_UI}`
  const sub = formatExifLine(exif) || (exif.dateTaken ?? '')
  if (sub) c.fillText(sub, leftX, centerY + fontPx * 0.6)

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 6：Leica 徕卡栏 —— 底部黑色窄栏 + 红点 + 型号/EXIF
// ═══════════════════════════════════════════════════════
function renderLeica({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const barH = Math.round(long * 0.06)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H + barH
  const c = canvas.getContext('2d')!

  c.drawImage(image, 0, 0, W, H)

  // 底部黑色栏
  c.fillStyle = config.bgColor
  c.fillRect(0, H, W, barH)

  const fontPx = Math.round(long * config.fontSize / 100)
  const centerY = H + barH / 2
  const padX = Math.round(W * 0.025)

  // 左侧红点（Leica 标志）
  const dotR = barH * 0.22
  c.fillStyle = '#e60012'
  c.beginPath()
  c.arc(padX + dotR * 1.2, centerY, dotR, 0, Math.PI * 2)
  c.fill()

  // 红点旁的 LEICA 字样
  c.fillStyle = config.textColor
  c.font = `500 ${Math.round(fontPx * 0.95)}px ${FONT_DISPLAY}`
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.fillText('Leica', padX + dotR * 2.8, centerY - fontPx * 0.5)
  c.font = `300 ${Math.round(fontPx * 0.5)}px ${FONT_UI}`
  c.fillStyle = 'rgba(255,255,255,0.55)'
  c.fillText('CAMERA · WETZLAR', padX + dotR * 2.8, centerY + fontPx * 0.55)

  // 右侧 EXIF 参数（右对齐）
  c.textAlign = 'right'
  c.fillStyle = config.textColor
  c.font = `300 ${Math.round(fontPx * 0.8)}px ${FONT_MONO}`
  const exifText = config.customText || formatExifLine(exif) || (exif.model ?? '')
  c.fillText(exifText, W - padX, centerY)

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 7：Red Dot 红点水印 —— 悬浮在图片右下角（不扩画布）
// ═══════════════════════════════════════════════════════
function renderRedDot({ image, exif, config }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!

  c.drawImage(image, 0, 0, W, H)

  const fontPx = Math.round(long * config.fontSize / 100)
  const pad = Math.round(long * 0.025)
  const dotR = Math.round(long * 0.012)

  // 半透明背景块（提升可读性）
  const exifText = config.customText || formatExifLine(exif) || (exif.model ?? '')
  const modelText = exif.model || ''
  c.font = `300 ${fontPx}px ${FONT_MONO}`
  const textW = Math.max(c.measureText(exifText).width, c.measureText(modelText).width, 60)
  const blockW = textW + dotR * 6 + pad * 1.2
  const blockH = fontPx * 2.6
  const blockX = W - blockW - pad
  const blockY = H - blockH - pad

  c.fillStyle = 'rgba(0,0,0,0.35)'
  roundRect(c, blockX, blockY, blockW, blockH, Math.round(long * 0.006))
  c.fill()

  // 红点
  c.fillStyle = '#e60012'
  c.beginPath()
  c.arc(blockX + dotR * 1.6, blockY + blockH / 2, dotR, 0, Math.PI * 2)
  c.fill()

  // 文字
  c.fillStyle = config.textColor
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.font = `500 ${fontPx}px ${FONT_DISPLAY}`
  c.fillText(modelText, blockX + dotR * 3.5, blockY + blockH / 2 - fontPx * 0.55)
  c.font = `300 ${Math.round(fontPx * 0.8)}px ${FONT_MONO}`
  c.fillStyle = 'rgba(255,255,255,0.85)'
  c.fillText(exifText, blockX + dotR * 3.5, blockY + blockH / 2 + fontPx * 0.55)

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 8：Dazz 胶卷 —— 仿 135 胶卷边框，上下齿孔 + 侧边文字 + 日期印字
// ═══════════════════════════════════════════════════════
function renderDazz({ image, exif, config }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  // 强制最小边距，避免 holeGap = 0 导致死循环
  const minPad = Math.max(20, Math.round(long * 0.01))
  const pad = Math.max(minPad, Math.round(long * config.padding / 100))

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2
  canvas.height = H + pad * 2
  const c = canvas.getContext('2d')!

  // 黑色胶卷底
  c.fillStyle = config.bgColor
  c.fillRect(0, 0, canvas.width, canvas.height)

  c.drawImage(image, pad, pad, W, H)

  // 齿孔（上下两排，矩形 + 圆角）
  const holeW = pad * 0.28
  const holeH = pad * 0.36
  const holeGap = Math.max(1, pad * 1.1)
  c.fillStyle = 'rgba(240,235,220,0.92)'
  const drawHoleRow = (yCenter: number) => {
    const maxIter = 200
    let iter = 0
    for (let x = pad + holeGap * 0.8; x < canvas.width - pad - holeGap * 0.5 && iter < maxIter; x += holeGap) {
      roundRect(c, x - holeW / 2, yCenter - holeH / 2, holeW, holeH, holeW * 0.25)
      c.fill()
      iter++
    }
  }
  drawHoleRow(pad / 2)
  drawHoleRow(canvas.height - pad / 2)

  // 侧边竖排文字（胶片编号 + 品牌）
  const fontPx = Math.round(long * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `500 ${fontPx}px ${FONT_MONO}`
  c.textBaseline = 'middle'
  c.textAlign = 'center'

  // 左侧竖排：品牌/型号
  c.save()
  c.translate(pad / 2, canvas.height / 2)
  c.rotate(-Math.PI / 2)
  const frame = exif.dateTaken?.replace(/\D/g, '').slice(-4) || '0036'
  c.fillText(`FUJI SUPERIA 400  ▶  ${frame}`, 0, 0)
  c.restore()

  // 右侧竖排：EXIF
  c.save()
  c.translate(canvas.width - pad / 2, canvas.height / 2)
  c.rotate(Math.PI / 2)
  const exifLine = formatExifLine(exif) || (exif.model ?? '35mm')
  c.fillText(`◀  ${exifLine}`, 0, 0)
  c.restore()

  // 右下角日期印字（橙色，仿旧式相机日期背印）
  if (exif.dateTaken) {
    const dateFont = Math.round(fontPx * 1.1)
    c.font = `700 ${dateFont}px ${FONT_MONO}`
    c.fillStyle = config.textColor
    c.textAlign = 'right'
    c.textBaseline = 'bottom'
    c.fillText(exif.dateTaken.replace(/-/g, '.'), W + pad - pad * 0.15, H + pad - pad * 0.15)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 9：Instax 真实拍立得 —— 顶部窄边 + 底部超宽留白 + 签名 + 日期角标
// ═══════════════════════════════════════════════════════
function renderInstax({ image, config, exif }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const sidePad = Math.round(long * config.padding / 100)
  const topPad = Math.round(sidePad * 0.8)
  const bottomPad = Math.round(sidePad * 3.5)
  const spread = config.shadow ? Math.round(long * 0.04 * 0.4) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W + sidePad * 2 + spread * 2
  canvas.height = H + topPad + bottomPad + spread * 2
  const c = canvas.getContext('2d')!

  // 米白底 + 微弱纸张纹理
  c.fillStyle = '#a8a39d'
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 卡片 + 三层阴影
  const { cardX, cardY, cardW, cardH } = drawCard(c, canvas, config, long)

  // 卡片内部纸张纹理（弱渐变）
  const grain = c.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH)
  grain.addColorStop(0, 'rgba(0,0,0,0.015)')
  grain.addColorStop(0.5, 'rgba(0,0,0,0)')
  grain.addColorStop(1, 'rgba(0,0,0,0.02)')
  c.fillStyle = grain
  c.fillRect(cardX, cardY, cardW, cardH)

  // 图像区域（轻微阴影）
  c.save()
  c.shadowColor = 'rgba(0,0,0,0.12)'
  c.shadowBlur = sidePad * 0.3
  c.shadowOffsetY = sidePad * 0.1
  c.fillStyle = '#000'
  c.fillRect(cardX + sidePad, cardY + topPad, W, H)
  c.restore()
  c.drawImage(image, cardX + sidePad, cardY + topPad, W, H)

  // 底部手写签名
  const fontPx = Math.round(long * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `italic 500 ${fontPx}px ${FONT_HAND}`
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  const signature = config.customText || ''
  if (signature) {
    c.fillText(signature, cardX + sidePad * 1.2, cardY + topPad + H + bottomPad * 0.55)
  }

  // 右下角日期小字
  if (exif.dateTaken) {
    const smallFont = Math.round(fontPx * 0.6)
    c.font = `300 ${smallFont}px ${FONT_UI}`
    c.fillStyle = 'rgba(0,0,0,0.5)'
    c.textAlign = 'right'
    c.fillText(exif.dateTaken, cardX + cardW - sidePad * 1.2, cardY + cardH - sidePad * 0.8)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 10：小红书 —— 3:4 白底卡片 + 圆角 + 标题 + 描述
// ═══════════════════════════════════════════════════════
function renderXhs({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const pad = Math.round(long * config.padding / 100)
  const topArea = Math.round(long * 0.08)
  const bottomArea = Math.round(long * 0.12)
  const spread = config.shadow ? Math.round(long * 0.04 * 0.4) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2 + spread * 2
  canvas.height = H + pad * 2 + topArea + bottomArea + spread * 2
  const c = canvas.getContext('2d')!

  // 画布背景
  c.fillStyle = '#fafafa'
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 卡片 + 三层阴影
  const { cardX, cardY, cardW, cardH } = drawCard(c, canvas, config, long)

  // 顶部小标签（"小红书 · 图文")
  const fontPx = Math.round(long * config.fontSize / 100)
  c.textBaseline = 'middle'
  c.textAlign = 'left'
  c.fillStyle = 'rgba(0,0,0,0.4)'
  c.font = `400 ${Math.round(fontPx * 0.75)}px ${FONT_UI}`
  c.fillText('📕 小红书笔记', cardX + pad * 1.2, cardY + topArea / 2)

  // 顶部右：日期
  c.textAlign = 'right'
  if (exif.dateTaken) {
    c.fillText(exif.dateTaken, cardX + cardW - pad * 1.2, cardY + topArea / 2)
  }

  // 图片（圆角剪裁）
  const imgX = cardX + pad
  const imgY = cardY + topArea
  c.save()
  roundRect(c, imgX, imgY, W, H, Math.max(0, config.radius - pad * 0.3))
  c.clip()
  c.drawImage(image, imgX, imgY, W, H)
  c.restore()

  // 底部：标题 + 描述
  const bottomY = imgY + H
  c.textAlign = 'left'
  c.fillStyle = config.textColor
  c.font = `500 ${Math.round(fontPx * 1.2)}px ${FONT_DISPLAY}`
  const title = config.customText || exif.model || '无标题'
  c.fillText(title, cardX + pad * 1.2, bottomY + bottomArea * 0.38)

  c.fillStyle = 'rgba(0,0,0,0.55)'
  c.font = `400 ${Math.round(fontPx * 0.8)}px ${FONT_UI}`
  const desc = formatExifLine(exif) || (exif.lens ?? '')
  if (desc) c.fillText(desc, cardX + pad * 1.2, bottomY + bottomArea * 0.68)

  // 右下：Logo 小标
  if (config.showLogo && logo) {
    const lh = Math.round(long * config.logoSize / 100 * 0.8)
    const lw = lh * (logo.width / logo.height)
    c.drawImage(logo, cardX + cardW - pad * 1.2 - lw, bottomY + bottomArea / 2 - lh / 2, lw, lh)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 11：Vintage 复古纸相框 —— 牛皮纸底 + 做旧边 + 手写签名
// ═══════════════════════════════════════════════════════
function renderVintage({ image, config, exif }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const pad = Math.round(long * config.padding / 100)

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2
  canvas.height = H + pad * 2 + Math.round(long * 0.06)
  const c = canvas.getContext('2d')!

  // 牛皮纸底（带渐变 + 纹理）
  c.fillStyle = config.bgColor
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 纹理噪点（用随机像素点模拟）
  c.save()
  c.globalAlpha = 0.08
  const grainSize = 3
  for (let y = 0; y < canvas.height; y += grainSize * 3) {
    for (let x = 0; x < canvas.width; x += grainSize * 3) {
      if (Math.random() > 0.6) {
        c.fillStyle = Math.random() > 0.5 ? '#000' : '#fff'
        c.fillRect(x, y, grainSize, grainSize)
      }
    }
  }
  c.restore()

  // 做旧边（内侧细线）
  c.strokeStyle = 'rgba(74,55,40,0.3)'
  c.lineWidth = 1
  c.strokeRect(pad * 0.3, pad * 0.3, canvas.width - pad * 0.6, canvas.height - pad * 0.6)

  // 图像区域带微阴影
  c.save()
  c.shadowColor = 'rgba(0,0,0,0.25)'
  c.shadowBlur = pad * 0.4
  c.shadowOffsetY = pad * 0.1
  c.fillStyle = '#000'
  c.fillRect(pad, pad, W, H)
  c.restore()

  // 图像去色 + 复古色调（sepia 滤镜）
  c.save()
  c.drawImage(image, pad, pad, W, H)
  c.globalCompositeOperation = 'multiply'
  c.fillStyle = 'rgba(220,190,150,0.2)'
  c.fillRect(pad, pad, W, H)
  c.restore()

  // 底部签名
  const fontPx = Math.round(long * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `italic 500 ${fontPx}px ${FONT_HAND}`
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  const sig = config.customText || 'Vintage'
  c.fillText(sig, pad * 1.3, pad + H + Math.round(long * 0.03))

  // 右下日期
  c.textAlign = 'right'
  c.font = `300 ${Math.round(fontPx * 0.8)}px ${FONT_UI}`
  if (exif.dateTaken) c.fillText(exif.dateTaken, canvas.width - pad * 1.3, pad + H + Math.round(long * 0.03))

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 12：Magazine 杂志封面 —— 顶部大标题 + 底部 caption + 细线分隔
// ═══════════════════════════════════════════════════════
function renderMagazine({ image, exif, config }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const topBar = Math.round(long * 0.08)
  const bottomBar = Math.round(long * 0.1)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H + topBar + bottomBar
  const c = canvas.getContext('2d')!

  c.fillStyle = config.bgColor
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 图片居中
  c.drawImage(image, 0, topBar, W, H)

  const fontPx = Math.round(long * config.fontSize / 100)
  const padX = Math.round(W * 0.04)

  // ── 顶部：杂志标题 + 期号 ──
  c.textBaseline = 'middle'
  c.textAlign = 'left'
  c.fillStyle = config.textColor
  c.font = `600 ${Math.round(fontPx * 1.8)}px ${FONT_DISPLAY}`
  c.fillText('PHOTO', padX, topBar / 2 - fontPx * 0.25)
  const photoW = c.measureText('PHOTO').width
  c.font = `300 ${Math.round(fontPx * 1.8)}px ${FONT_DISPLAY}`
  c.fillText('ZINE', padX + photoW + fontPx * 0.4, topBar / 2 - fontPx * 0.25)

  // 右上：期号 + 日期
  c.textAlign = 'right'
  c.font = `400 ${Math.round(fontPx * 0.65)}px ${FONT_MONO}`
  c.fillStyle = 'rgba(0,0,0,0.55)'
  const issue = `ISSUE ${exif.dateTaken?.replace(/\D/g, '').slice(-4) || '001'}  ·  ${exif.dateTaken || ''}`
  c.fillText(issue, W - padX, topBar / 2 - fontPx * 0.25)

  // 顶部分隔线
  c.strokeStyle = 'rgba(0,0,0,0.15)'
  c.lineWidth = 1
  c.beginPath()
  c.moveTo(padX, topBar - 1)
  c.lineTo(W - padX, topBar - 1)
  c.stroke()

  // ── 底部 caption ──
  const bottomY = topBar + H
  // 分隔线
  c.beginPath()
  c.moveTo(padX, bottomY + 1)
  c.lineTo(W - padX, bottomY + 1)
  c.stroke()

  c.textAlign = 'left'
  c.fillStyle = config.textColor
  c.font = `500 ${Math.round(fontPx * 0.95)}px ${FONT_DISPLAY}`
  const title = config.customText || exif.model || 'Untitled'
  c.fillText(title, padX, bottomY + bottomBar * 0.4)

  c.fillStyle = 'rgba(0,0,0,0.55)'
  c.font = `300 ${Math.round(fontPx * 0.7)}px ${FONT_UI}`
  const desc = formatExifLine(exif) || (exif.lens ?? '')
  if (desc) c.fillText(desc, padX, bottomY + bottomBar * 0.7)

  // 右下：页码
  c.textAlign = 'right'
  c.font = `400 ${Math.round(fontPx * 0.7)}px ${FONT_MONO}`
  c.fillStyle = 'rgba(0,0,0,0.5)'
  c.fillText('— 01 / 01 —', W - padX, bottomY + bottomBar * 0.55)

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 13：Location 地理水印 —— 底部栏：Logo + 型号 + 📍地点 + 日期
// ═══════════════════════════════════════════════════════
function renderLocation({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const barH = Math.round(long * 0.10)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H + barH
  const c = canvas.getContext('2d')!

  c.drawImage(image, 0, 0, W, H)

  c.fillStyle = config.bgColor
  c.fillRect(0, H, W, barH)

  const padX = Math.round(W * 0.035)
  const centerY = H + barH / 2
  const fontPx = Math.round(long * config.fontSize / 100)

  // ── 左侧：Logo + 型号 ──
  let leftX = padX
  if (config.showLogo && logo) {
    const lh = Math.round(long * config.logoSize / 100)
    const lw = lh * (logo.width / logo.height)
    c.drawImage(logo, leftX, centerY - lh / 2, lw, lh)
    leftX += lw + padX * 0.6
  }

  c.textBaseline = 'middle'
  c.textAlign = 'left'
  c.fillStyle = config.textColor
  c.font = `500 ${Math.round(fontPx * 1.15)}px ${FONT_DISPLAY}`
  c.fillText(exif.model || '—', leftX, centerY - fontPx * 0.45)
  c.fillStyle = 'rgba(255,255,255,0.55)'
  c.font = `400 ${Math.round(fontPx * 0.75)}px ${FONT_UI}`
  const lens = exif.lens || formatExifLine(exif) || ''
  if (lens) c.fillText(lens, leftX, centerY + fontPx * 0.55)

  // ── 右侧：地点 + 日期 ──
  c.textAlign = 'right'
  const locationName = config.locationName || config.customText || ''
  c.fillStyle = config.textColor
  c.font = `500 ${Math.round(fontPx * 1.0)}px ${FONT_DISPLAY}`
  if (locationName) {
    c.fillText(`📍 ${locationName}`, W - padX, centerY - fontPx * 0.45)
  }
  c.fillStyle = 'rgba(255,255,255,0.55)'
  c.font = `400 ${Math.round(fontPx * 0.75)}px ${FONT_MONO}`
  if (exif.dateTaken) {
    c.fillText(exif.dateTaken, W - padX, centerY + fontPx * 0.55)
  }

  return canvas
}
