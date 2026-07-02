// Canvas 渲染核心 —— 5 种边框模板绘制
import type { ExifData, TemplateConfig } from '../types'

export interface RenderCtx {
  image: HTMLImageElement
  exif: ExifData
  logo: HTMLImageElement | null
  config: TemplateConfig
}

/**
 * 主入口：根据 config.id 分发到对应渲染器
 * 返回一个 offscreen canvas，用于预览与导出
 */
export function renderFrame(ctx: RenderCtx): HTMLCanvasElement {
  switch (ctx.config.id) {
    case 'minimal':  return renderMinimal(ctx)
    case 'polaroid': return renderPolaroid(ctx)
    case 'film':     return renderFilm(ctx)
    case 'exif':     return renderExif(ctx)
    case 'insta':    return renderInsta(ctx)
    default:         return renderMinimal(ctx)
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

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2
  canvas.height = H + pad * 2 + bottomExtra
  const c = canvas.getContext('2d')!

  c.fillStyle = config.bgColor
  c.fillRect(0, 0, canvas.width, canvas.height)

  c.drawImage(image, pad, pad, W, H)

  // 底部文字
  const fontPx = Math.round(long * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `500 ${fontPx}px -apple-system, "Helvetica Neue", "PingFang SC", sans-serif`
  c.textBaseline = 'middle'

  const centerY = pad + H + bottomExtra / 2
  const line = config.customText || [exif.model, formatExifLine(exif)].filter(Boolean).join('  ·  ')
  if (line) {
    c.textAlign = 'center'
    c.fillText(line, canvas.width / 2, centerY)
  }

  // 左下 Logo
  if (config.showLogo && logo) {
    const lh = Math.round(long * config.logoSize / 100)
    const lw = lh * (logo.width / logo.height)
    c.drawImage(logo, pad, centerY - lh / 2, lw, lh)
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

  const canvas = document.createElement('canvas')
  canvas.width = W + sidePad * 2
  canvas.height = H + sidePad + bottomPad
  const c = canvas.getContext('2d')!

  c.fillStyle = config.bgColor
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 图像内部轻微内阴影感（微暗底色）
  c.drawImage(image, sidePad, sidePad, W, H)

  // 底部签名文字
  const fontPx = Math.round(long * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `italic 500 ${fontPx}px "Snell Roundhand", "Zapfino", "STXingkai", cursive`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const line = config.customText || exif.dateTaken || ''
  if (line) c.fillText(line, canvas.width / 2, sidePad + H + bottomPad / 2)

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 3：胶片 Film —— 黑色边框 + 齿孔 + 胶片编号
// ═══════════════════════════════════════════════════════
function renderFilm({ image, exif, config }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const pad = Math.round(long * config.padding / 100)

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2
  canvas.height = H + pad * 2
  const c = canvas.getContext('2d')!

  c.fillStyle = config.bgColor
  c.fillRect(0, 0, canvas.width, canvas.height)

  c.drawImage(image, pad, pad, W, H)

  // 齿孔（上下各一排）
  const holeR = pad * 0.18
  const holeGap = pad * 1.6
  c.fillStyle = '#000'
  const drawHoles = (yCenter: number) => {
    for (let x = pad + holeGap; x < canvas.width - pad - holeGap; x += holeGap) {
      c.beginPath()
      c.arc(x, yCenter, holeR, 0, Math.PI * 2)
      c.fillStyle = 'rgba(255,255,255,0.85)'
      c.fill()
    }
  }
  drawHoles(pad / 2)
  drawHoles(canvas.height - pad / 2)

  // 底部胶片编号 + EXIF
  const fontPx = Math.round(long * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `${fontPx}px "SF Mono", "Menlo", monospace`
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
  c.font = `600 ${Math.round(fontPx * 1.2)}px -apple-system, "Helvetica Neue", "PingFang SC", sans-serif`
  c.fillText(modelText, leftX, centerY - fontPx * 0.5)

  c.fillStyle = 'rgba(255,255,255,0.55)'
  c.font = `400 ${Math.round(fontPx * 0.85)}px -apple-system, sans-serif`
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
      c.font = `600 ${blockFontValue}px "SF Mono", -apple-system, sans-serif`
      c.fillText(b.value, rightX, centerY - blockFontLabel * 0.5)
      c.fillStyle = 'rgba(255,255,255,0.55)'
      c.font = `400 ${blockFontLabel}px -apple-system, sans-serif`
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
  const shadow = config.shadow ? Math.round(long * 0.02) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2 + shadow * 2
  canvas.height = H + pad * 2 + bottomExtra + shadow * 2
  const c = canvas.getContext('2d')!

  // 全画布背景（半透明遮罩）
  c.fillStyle = '#f2f4f8'
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 卡片阴影
  if (shadow > 0) {
    c.save()
    c.shadowColor = 'rgba(0,0,0,0.15)'
    c.shadowBlur = shadow
    c.shadowOffsetY = shadow / 2
    c.fillStyle = config.bgColor
    roundRect(c, shadow, shadow, canvas.width - shadow * 2, canvas.height - shadow * 2, config.radius)
    c.fill()
    c.restore()
  } else {
    c.fillStyle = config.bgColor
    roundRect(c, 0, 0, canvas.width, canvas.height, config.radius)
    c.fill()
  }

  // 图像圆角剪裁
  const imgX = pad + shadow
  const imgY = pad + shadow
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
  c.font = `600 ${Math.round(fontPx * 1.1)}px -apple-system, sans-serif`
  const title = config.customText || exif.model || ''
  if (title) c.fillText(title, leftX, centerY - fontPx * 0.5)
  c.fillStyle = 'rgba(0,0,0,0.5)'
  c.font = `400 ${Math.round(fontPx * 0.85)}px -apple-system, sans-serif`
  const sub = formatExifLine(exif) || (exif.dateTaken ?? '')
  if (sub) c.fillText(sub, leftX, centerY + fontPx * 0.6)

  return canvas
}
