// Canvas 渲染核心 —— 21 种边框模板绘制
import type { ExifData, TemplateConfig, GridPosition } from '../types'
import {
  WATERMARK, withAlpha, formatExifLine, getFontStack,
  getFontForRole, getResponsive, replaceTextVars, cleanupText,
  shadowBgColor,
  type ResponsiveConfig,
} from './fonts'

/**
 * 解析自定义文本：非空时做变量替换 + 清理，否则返回 fallback
 * 用于所有 "customText || fallback" 模式
 */
function resolveCustomText(
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

export interface RenderCtx {
  image: HTMLImageElement
  exif: ExifData
  logo: HTMLImageElement | null
  config: TemplateConfig
}

/** 渲染时字体栈 + 响应式配置（每个 renderer 顶部通过 makeFontCtx 构建） */
export interface FontCtx {
  display: string
  ui: string
  mono: string
  hand: string
  accent: string
  responsive: ResponsiveConfig
}

/** 基于 TemplateConfig 构建 FontCtx（每个 renderer 在顶部调用一次） */
export function makeFontCtx(config: TemplateConfig, longEdge: number): FontCtx {
  const family = config.fontFamily
  return {
    display: getFontForRole('display', family),
    ui:      getFontForRole('ui', family),
    mono:    getFontForRole('mono', family),
    hand:    getFontForRole('hand', family),
    accent:  getFontForRole('accent', family),
    responsive: getResponsive(longEdge),
  }
}

/**
 * 主入口：根据 config.id 分发到对应渲染器
 * 返回一个 offscreen canvas，用于预览与导出
 *
 * 防御性处理：仅强制 fontSize ≥ 1（避免 0 字号渲染异常）
 * padding 由各模板自行处理（默认值已合理，padding=0 对某些模板是合法的）
 */
export function renderFrame(ctx: RenderCtx): HTMLCanvasElement {
  const safeFontSize = Math.max(1, ctx.config.fontSize)
  const safeConfig = {
    ...ctx.config,
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
    case 'light-shadow': return renderLightShadow(safeCtx)
    case 'frameless-rounded': return renderFramelessRounded(safeCtx)
    case 'white-border': return renderWhiteBorder(safeCtx)
    case 'ps-splash': return renderPsSplash(safeCtx)
    case 'lr-splash': return renderLrSplash(safeCtx)
    case 'vintage-photo': return renderVintagePhoto(safeCtx)
    case 'text-embed': return renderTextEmbed(safeCtx)
    case 'tiled-watermark': return renderTiledWatermark(safeCtx)
    default:         return renderMinimal(safeCtx)
  }
}

/** 竖版感知的尺寸基准：竖版用宽度、横版用长边，防止竖版照片底栏/字号过大 */
function sizeRef(W: number, H: number): number {
  return H > W ? W : Math.max(W, H)
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

// ═══════════════════════════════════════════════════════
// 模板 1：极简 Minimal —— 上下左右等宽白边 + 底部一行小字
// ═══════════════════════════════════════════════════════
function renderMinimal({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width
  const H = image.height
  const long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const pad = Math.round(long * config.padding / 100)
  const bottomExtra = Math.round(ref * 0.06)
  const spread = config.shadow ? Math.round(long * 0.04 * 0.4) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2 + spread * 2
  canvas.height = H + pad * 2 + bottomExtra + spread * 2
  const c = canvas.getContext('2d')!

  // 画布背景（阴影外围区域）
  c.fillStyle = shadowBgColor(config.bgColor)
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 卡片 + 三层阴影
  const { cardX, cardY } = drawCard(c, canvas, config, long)

  c.drawImage(image, cardX + pad, cardY + pad, W, H)

  // 底部文字
  const fontPx = Math.round(ref * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `400 ${fontPx}px ${f.ui}`
  c.textBaseline = 'middle'

  const centerY = cardY + pad + H + bottomExtra / 2
  const line = resolveCustomText(config.customText, [exif.model, formatExifLine(exif)].filter(Boolean).join('  ·  '), exif, config)
  if (line) {
    c.textAlign = 'center'
    c.fillText(line, canvas.width / 2, centerY)
  }

  // 左下 Logo
  if (config.showLogo && logo) {
    const lh = Math.round(ref * config.logoSize / 100)
    const lw = lh * (logo.width / logo.height)
    c.drawImage(logo, cardX + pad, centerY - lh / 2, lw, lh)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 2：拍立得 Polaroid —— 上左右窄边，下方大留白
// ═══════════════════════════════════════════════════════
function renderPolaroid({ image, config, exif, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const sidePad = Math.round(long * config.padding / 100)
  const bottomPad = Math.round(long * config.padding / 100 * 4)
  const spread = config.shadow ? Math.round(long * 0.04 * 0.4) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W + sidePad * 2 + spread * 2
  canvas.height = H + sidePad + bottomPad + spread * 2
  const c = canvas.getContext('2d')!

  c.fillStyle = shadowBgColor(config.bgColor)
  c.fillRect(0, 0, canvas.width, canvas.height)

  const { cardX, cardY } = drawCard(c, canvas, config, long)
  c.drawImage(image, cardX + sidePad, cardY + sidePad, W, H)

  // 图像区域内的 Logo 水印（半透明叠加）
  const imgLeft = cardX + sidePad
  const imgTop = cardY + sidePad
  if (config.showLogo && logo) {
    const wmFontPx = Math.max(10, Math.round(long * config.fontSize / 100 * 0.55))
    const wmPadX = Math.round(W * 0.04)
    const wmPadY = Math.round(H * 0.04)
    const lh = Math.round(wmFontPx * 1.5)
    const lw = Math.round(lh * (logo.width / logo.height))
    c.save()
    c.globalAlpha = 0.55
    c.drawImage(logo, imgLeft + wmPadX, imgTop + H - wmPadY - lh, lw, lh)
    c.restore()
  }

  // 底部白色边框区域内的 EXIF 参数信息
  const borderInfoFontPx = Math.max(10, Math.round(long * config.fontSize / 100 * 0.45))
  const borderTop = imgTop + H  // 图像底边 = 边框区域顶边
  let borderCurY = borderTop + bottomPad * 0.15

  if (config.showLogo) {
    const modelText = exif.model ?? ''
    if (modelText) {
      c.font = `500 ${Math.round(borderInfoFontPx * 1.1)}px ${f.display}`
      c.fillStyle = config.textColor
      c.globalAlpha = 0.7
      c.textAlign = 'left'
      c.textBaseline = 'top'
      c.fillText(modelText, cardX + sidePad * 1.2, borderCurY)
      borderCurY += Math.round(borderInfoFontPx * 1.1 * 1.5)
    }
  }
  if (config.showExif) {
    const paramText = formatExifLine(exif)
    if (paramText) {
      c.font = `400 ${borderInfoFontPx}px ${f.mono}`
      c.fillStyle = config.textColor
      c.globalAlpha = 0.5
      c.textAlign = 'left'
      c.textBaseline = 'top'
      c.fillText(paramText, cardX + sidePad * 1.2, borderCurY)
    }
  }
  c.globalAlpha = 1

  // 底部签名文字（保持在白色底边区域，强制约束在卡片内）
  const fontPx = Math.max(24, Math.round(long * config.fontSize / 100))
  const signatureLine = resolveCustomText(
    config.customText,
    exif.dateTaken || 'signature',
    exif,
    config,
  )
  if (signatureLine) {
    const maxW = canvas.width - sidePad * 2.4
    const sigY = cardY + sidePad + H + bottomPad / 2
    // 垂直安全：字号不能超出底边
    const cardBottom = cardY + sidePad + H + bottomPad
    const maxFontH = (cardBottom - sigY) * 1.6  // baseline 到 descender 约 0.3em
    c.font = `400 ${fontPx}px ${f.hand}`
    let actualFontPx = Math.min(fontPx, Math.floor(maxFontH))
    // 水平缩放
    if (c.measureText(signatureLine).width > maxW) {
      const scale = maxW / c.measureText(signatureLine).width
      actualFontPx = Math.max(10, Math.floor(actualFontPx * scale * 0.95))
    }
    c.font = `400 ${actualFontPx}px ${f.hand}`
    c.fillStyle = config.textColor
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(signatureLine, canvas.width / 2, sigY, maxW)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 3：胶片 Film —— 黑色边框 + 齿孔 + 胶片编号
// ═══════════════════════════════════════════════════════
function renderFilm({ image, exif, config }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
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
  const fontPx = Math.round(ref * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `${fontPx}px ${f.mono}`
  c.textBaseline = 'middle'

  // 左下：帧号（用 dateTaken 后 4 位或随机）
  const frame = exif.dateTaken?.replace(/\D/g, '').slice(-4) || '0001'
  c.textAlign = 'left'
  c.fillText(`▶ FRAME ${frame}`, pad + holeGap, canvas.height - pad / 2 - holeR - fontPx * 0.9)

  // 右下：EXIF
  const exifLine = resolveCustomText(config.customText, formatExifLine(exif) || (exif.model ?? ''), exif, config)
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
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const displayFont = getFontStack(config.fontFamily)
  const barH = Math.round(ref * 0.10)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H + barH
  const c = canvas.getContext('2d')!

  c.drawImage(image, 0, 0, W, H)

  c.fillStyle = config.bgColor
  c.fillRect(0, H, W, barH)

  // 检测竖版照片（手机照片典型特征：W < H）
  const isPortrait = H > W
  // 宽高比 < 0.75 的超窄图（如全景截图）也用紧凑模式
  const isNarrow = W / H < 0.75

  const padX = Math.round(W * 0.04)
  const centerY = H + barH / 2
  const hasLogo = config.showLogo && logo
  const modelText = exif.model || ''
  const lensText = exif.lens || resolveCustomText(config.customText, '', exif, config)

  // 收集实际存在的参数值
  const paramValues: string[] = []
  if (exif.focalLength) paramValues.push(`${Math.round(exif.focalLength)}mm`)
  if (exif.fNumber) paramValues.push(`f/${exif.fNumber}`)
  if (exif.exposureTime) paramValues.push(exif.exposureTime)
  if (exif.iso) paramValues.push(`ISO${exif.iso}`)

  // ── 简洁单行模式（Copicseal 风格）：竖版 / 窄图 / 参数 ≤ 3 个 ──
  const useCompact = isPortrait || isNarrow || paramValues.length <= 3

  if (useCompact) {
    // 字号按图片宽度计算（而非 long），避免竖版字过大
    const basePx = Math.round(W * config.fontSize / 100 * 0.85)
    const fontPx = Math.max(10, basePx)

    c.textBaseline = 'middle'
    c.textAlign = 'center'

    // 拼装单行内容：[型号] · 参数1 · 参数2 · ...
    const segments: string[] = []
    if (modelText) segments.push(modelText)
    if (lensText && !isPortrait && !isNarrow) segments.push(lensText) // 横版才加镜头
    segments.push(...paramValues)

    if (segments.length === 0) {
      // 无任何内容，bar 留空
      return canvas
    }

    // 字号与样式：型号加粗显示，参数等宽
    // 先计算布局：logo 在左，文字整体居中
    const modelPart = modelText ? segments[0] : ''
    const restParts = modelText ? segments.slice(1) : segments

    let textStr = ''
    if (restParts.length > 0) {
      textStr = restParts.join(' · ')
    }

    // 测量总宽度以判断是否需要缩小
    c.font = `400 ${fontPx}px ${displayFont}`
    const modelW = modelPart ? c.measureText(modelPart).width : 0
    c.font = `400 ${fontPx * 0.9}px ${f.mono}`
    const restW = textStr ? c.measureText(textStr).width : 0
    c.font = `400 ${fontPx * 0.9}px ${f.ui}`
    const sepW = modelPart && textStr ? c.measureText('  ').width : 0

    const logoH = hasLogo ? Math.round(barH * 0.4) : 0
    const logoW = hasLogo ? logoH * (logo!.width / logo!.height) : 0
    const logoGap = hasLogo ? Math.round(padX * 0.5) : 0

    const totalW = logoW + logoGap + modelW + sepW + restW
    const availW = W - padX * 2

    // 如果总宽度超过可用宽度，按比例缩小字号
    let finalFontPx = fontPx
    if (totalW > availW && totalW > 0) {
      const shrink = availW / totalW
      finalFontPx = Math.max(9, Math.round(fontPx * shrink * 0.95))
    }

    // 计算起始 X（整体居中）
    const modelFontPx = finalFontPx
    const restFontPx = Math.round(finalFontPx * 0.9)

    c.font = `400 ${modelFontPx}px ${displayFont}`
    const mW = modelPart ? c.measureText(modelPart).width : 0
    c.font = `400 ${restFontPx}px ${f.mono}`
    const rW = textStr ? c.measureText(textStr).width : 0
    c.font = `400 ${modelFontPx}px ${f.ui}`
    const sW = modelPart && textStr ? c.measureText('  ').width : 0

    const finalLogoH = hasLogo ? Math.round(barH * 0.4) : 0
    const finalLogoW = hasLogo ? finalLogoH * (logo!.width / logo!.height) : 0
    const finalLogoGap = hasLogo ? Math.round(padX * 0.5) : 0

    const finalTotalW = finalLogoW + finalLogoGap + mW + sW + rW
    let curX = (W - finalTotalW) / 2

    // 绘制 logo
    if (hasLogo) {
      c.drawImage(logo!, curX, centerY - finalLogoH / 2, finalLogoW, finalLogoH)
      curX += finalLogoW + finalLogoGap
    }

    // 绘制型号（粗体，显示字体）
    if (modelPart) {
      c.fillStyle = config.textColor
      c.textAlign = 'left'
      c.font = `400 ${modelFontPx}px ${displayFont}`
      c.fillText(modelPart, curX, centerY)
      curX += mW
    }

    // 分隔空白
    if (modelPart && textStr) {
      c.font = `400 ${modelFontPx}px ${f.ui}`
      curX += sW
    }

    // 绘制参数（等宽字体，次级颜色）
    if (textStr) {
      c.fillStyle = withAlpha(config.textColor, 0.7)
      c.textAlign = 'left'
      c.font = `400 ${restFontPx}px ${f.mono}`
      c.fillText(textStr, curX, centerY)
    }

    return canvas
  }

  // ═══════════════════════════════════════════════════════
  // 双行模式（横版 + 4 个参数）
  // ═══════════════════════════════════════════════════════
  // 竖版/窄图缩小字体系数，避免拥挤
  const fontScale = 1
  const fontPx = Math.round(ref * config.fontSize / 100 * fontScale)

  // ── 1. 预计算右侧参数块尺寸（无数据则不加入，不显示占位）──
  const rightBlocks: Array<{ label: string; value: string }> = []
  if (exif.focalLength) rightBlocks.push({ label: '焦距', value: `${Math.round(exif.focalLength)}mm` })
  if (exif.fNumber) rightBlocks.push({ label: '光圈', value: `f/${exif.fNumber}` })
  if (exif.exposureTime) rightBlocks.push({ label: '快门', value: exif.exposureTime })
  if (exif.iso) rightBlocks.push({ label: 'ISO', value: `${exif.iso}` })

  const blockFontValue = Math.round(fontPx * 1.2)
  const blockFontLabel = Math.round(fontPx * 0.7)
  const blockWidths: number[] = []
  let rightContentW = 0

  // 竖版模式：不显示 label，只计算 value 宽度
  const showLabels = !(isPortrait || isNarrow)

  for (const b of rightBlocks) {
    c.font = `400 ${blockFontValue}px ${f.mono}`
    const vw = c.measureText(b.value).width
    const bw = showLabels
      ? (() => {
          c.font = `400 ${blockFontLabel}px ${f.ui}`
          return Math.max(vw, c.measureText(b.label).width)
        })()
      : vw
    blockWidths.push(bw)
    rightContentW += bw
  }

  let gap = Math.round(fontPx * 2)
  if (rightBlocks.length > 1) {
    const gapsCount = rightBlocks.length - 1
    const maxRightW = W - padX * 3
    if (rightContentW + gapsCount * gap > maxRightW) {
      gap = Math.max(Math.round(padX * 0.4), Math.floor((maxRightW - rightContentW) / gapsCount))
    }
  }
  const rightAreaW = rightContentW + Math.max(0, rightBlocks.length - 1) * gap

  // 如果没有任何文字可显示（无型号 + 无镜头 + 无参数），整个 bar 留空
  const hasLeftContent = modelText || lensText
  const hasAnyContent = hasLeftContent || rightBlocks.length > 0

  if (hasAnyContent) {
    if (hasLogo && hasLeftContent) {
      let leftX = padX
      // 竖版模式 Logo 也相应缩小
      const logoScale = isPortrait || isNarrow ? 0.7 : 1
      const lh = Math.round(ref * config.logoSize / 100 * logoScale)
      const lw = lh * (logo!.width / logo!.height)
      c.drawImage(logo!, leftX, centerY - lh / 2, lw, lh)
      leftX += lw + padX * 0.6

      if (modelText) {
        c.fillStyle = config.textColor
        c.textBaseline = 'middle'
        c.textAlign = 'left'
        c.font = `400 ${Math.round(fontPx * 1.25)}px ${displayFont}`
        c.fillText(modelText, leftX, centerY - fontPx * 0.5)
      }
      if (lensText) {
        c.fillStyle = withAlpha(config.textColor, 0.55)
        c.font = `400 ${Math.round(fontPx * 0.85)}px ${f.ui}`
        c.fillText(lensText, leftX, modelText ? centerY + fontPx * 0.7 : centerY)
      }
    } else if (hasLeftContent) {
      // 无 Logo 但有文字
      c.fillStyle = config.textColor
      c.textBaseline = 'middle'

      if (rightBlocks.length === 0) {
        c.textAlign = 'center'
        if (modelText) {
          c.font = `400 ${Math.round(fontPx * 1.25)}px ${displayFont}`
          c.fillText(modelText, W / 2, centerY - (lensText ? fontPx * 0.5 : 0))
        }
        if (lensText) {
          c.fillStyle = withAlpha(config.textColor, 0.55)
          c.font = `400 ${Math.round(fontPx * 0.85)}px ${f.ui}`
          c.fillText(lensText, W / 2, modelText ? centerY + fontPx * 0.7 : centerY)
        }
      } else {
        const leftEnd = W - padX - rightAreaW - padX
        const leftCenterX = leftEnd > padX
          ? (padX + leftEnd) / 2
          : padX
        const align = leftEnd > padX ? 'center' as const : 'left' as const

        c.textAlign = align
        if (modelText) {
          c.font = `400 ${Math.round(fontPx * 1.25)}px ${displayFont}`
          c.fillText(modelText, leftCenterX, centerY - (lensText ? fontPx * 0.5 : 0))
        }
        if (lensText) {
          c.fillStyle = withAlpha(config.textColor, 0.55)
          c.font = `400 ${Math.round(fontPx * 0.85)}px ${f.ui}`
          c.fillText(lensText, leftCenterX, modelText ? centerY + fontPx * 0.7 : centerY)
        }
      }
    }

    // ── 3. 右侧参数块（竖版只显示 value，不显示 label）──
    if (rightBlocks.length) {
      let rightX = W - padX
      const blockEdges: number[] = []

      for (let i = rightBlocks.length - 1; i >= 0; i--) {
        const b = rightBlocks[i]
        c.textAlign = 'right'
        c.fillStyle = config.textColor
        c.font = `400 ${blockFontValue}px ${f.mono}`
        // 竖版：单行居中在 barY；横版：两行（value + label）
        c.fillText(b.value, rightX, showLabels ? centerY - blockFontLabel * 0.5 : centerY)
        if (showLabels) {
          c.fillStyle = withAlpha(config.textColor, 0.55)
          c.font = `400 ${blockFontLabel}px ${f.ui}`
          c.fillText(b.label, rightX, centerY + blockFontValue * 0.6)
        }
        rightX -= blockWidths[i]
        blockEdges.push(rightX)
        rightX -= gap
      }

      c.fillStyle = withAlpha(config.textColor, 0.35)
      const dotR = Math.max(1.5, Math.round(fontPx * 0.08))
      for (let i = 0; i < blockEdges.length - 1; i++) {
        const edgeX = blockEdges[i]
        const dotX = edgeX + gap / 2
        c.beginPath()
        c.arc(dotX, centerY, dotR, 0, Math.PI * 2)
        c.fill()
      }
    }
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 5：社交 Insta —— 白底毛玻璃 + 圆角 + 阴影
// ═══════════════════════════════════════════════════════
function renderInsta({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const displayFont = getFontStack(config.fontFamily)
  const pad = Math.round(long * config.padding / 100)
  const bottomExtra = Math.round(ref * 0.09)
  const spread = config.shadow ? Math.round(long * 0.04 * 0.4) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2 + spread * 2
  canvas.height = H + pad * 2 + bottomExtra + spread * 2
  const c = canvas.getContext('2d')!

  // 全画布背景（半透明遮罩）
  c.fillStyle = '#fafaf9'
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

  // 底部信息（两行布局：上行=型号，下行=EXIF）
  const fontPx = Math.round(ref * config.fontSize / 100)
  const titleFont = Math.round(fontPx * 1.15)
  const subFont = Math.round(fontPx * 0.85)
  const lineGap = Math.round(fontPx * 0.35)
  const centerY = imgY + H + bottomExtra / 2
  c.textBaseline = 'middle'

  // 上行基线 = centerY - (subFont + lineGap) / 2
  // 下行基线 = centerY + (titleFont + lineGap) / 2
  // 这样两行文字的视觉中线正好落在 centerY
  const topY = centerY - (subFont + lineGap) / 2
  const botY = centerY + (titleFont + lineGap) / 2
  const textBlockH = titleFont + lineGap + subFont

  // Logo 与上行文字对齐（同高）
  let leftX = imgX
  const hasLogo = config.showLogo && logo
  if (hasLogo) {
    const lh = Math.round(textBlockH * 0.95)
    const lw = lh * (logo!.width / logo!.height)
    c.drawImage(logo!, leftX, centerY - lh / 2, lw, lh)
    leftX += lw + ref * 0.015
  }

  // 上行：型号（思源宋体，优雅）
  c.fillStyle = config.textColor
  c.textAlign = hasLogo ? 'left' : 'center'
  const textX = hasLogo ? leftX : canvas.width / 2
  c.font = `400 ${titleFont}px ${displayFont}`
  const title = resolveCustomText(config.customText, exif.model || '', exif, config)
  if (title) c.fillText(title, textX, topY)

  // 下行：EXIF 参数（Inter，细体）
  c.fillStyle = withAlpha(config.textColor, 0.55)
  c.font = `400 ${subFont}px ${f.ui}`
  const sub = formatExifLine(exif) || (exif.dateTaken ?? '')
  if (sub) c.fillText(sub, textX, botY)

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 6：Leica 徕卡栏 —— 底部黑色窄栏 + 红点 + 型号/EXIF
// ═══════════════════════════════════════════════════════
function renderLeica({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const displayFont = getFontStack(config.fontFamily)
  const barH = Math.round(ref * 0.06)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H + barH
  const c = canvas.getContext('2d')!

  c.drawImage(image, 0, 0, W, H)

  // 底部黑色栏
  c.fillStyle = config.bgColor
  c.fillRect(0, H, W, barH)

  const fontPx = Math.round(ref * config.fontSize / 100)
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
  c.font = `400 ${Math.round(fontPx * 0.95)}px ${displayFont}`
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.fillText('Leica', padX + dotR * 2.8, centerY - fontPx * 0.5)
  c.font = `300 ${Math.round(fontPx * 0.5)}px ${f.ui}`
  c.fillStyle = 'rgba(255,255,255,0.55)'
  c.fillText('CAMERA · WETZLAR', padX + dotR * 2.8, centerY + fontPx * 0.55)

  // 右侧 EXIF 参数（右对齐）
  c.textAlign = 'right'
  c.fillStyle = config.textColor
  c.font = `300 ${Math.round(fontPx * 0.8)}px ${f.mono}`
  const exifText = resolveCustomText(config.customText, formatExifLine(exif) || (exif.model ?? ''), exif, config)
  c.fillText(exifText, W - padX, centerY)

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 7：Red Dot 红点水印 —— 悬浮在图片右下角（不扩画布）
// ═══════════════════════════════════════════════════════
function renderRedDot({ image, exif, config }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const displayFont = getFontStack(config.fontFamily)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!

  c.drawImage(image, 0, 0, W, H)

  const fontPx = Math.round(ref * config.fontSize / 100)
  const pad = Math.round(ref * 0.025)
  const dotR = Math.round(ref * 0.012)

  // 半透明背景块（提升可读性）
  const exifText = resolveCustomText(config.customText, formatExifLine(exif) || (exif.model ?? ''), exif, config)
  const modelText = exif.model || ''
  c.font = `300 ${fontPx}px ${f.mono}`
  const textW = Math.max(c.measureText(exifText).width, c.measureText(modelText).width, 60)
  const blockW = textW + dotR * 6 + pad * 1.2
  const blockH = fontPx * 2.6
  const blockX = W - blockW - pad
  const blockY = H - blockH - pad

  c.fillStyle = 'rgba(28,25,23,0.35)'
  roundRect(c, blockX, blockY, blockW, blockH, Math.round(ref * 0.006))
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
  c.font = `400 ${fontPx}px ${displayFont}`
  c.fillText(modelText, blockX + dotR * 3.5, blockY + blockH / 2 - fontPx * 0.55)
  c.font = `300 ${Math.round(fontPx * 0.8)}px ${f.mono}`
  c.fillStyle = 'rgba(255,255,255,0.85)'
  c.fillText(exifText, blockX + dotR * 3.5, blockY + blockH / 2 + fontPx * 0.55)

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 8：Dazz 胶卷 —— 仿 135 胶卷边框，上下齿孔 + 侧边文字 + 日期印字
// ═══════════════════════════════════════════════════════
function renderDazz({ image, exif, config }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
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
  const fontPx = Math.round(ref * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `400 ${fontPx}px ${f.mono}`
  c.textBaseline = 'middle'
  c.textAlign = 'center'

  // 左侧竖排：品牌/型号
  c.save()
  c.translate(pad / 2, canvas.height / 2)
  c.rotate(-Math.PI / 2)
  const frame = exif.dateTaken?.replace(/\D/g, '').slice(-4) || '0036'
  const filmBrand = resolveCustomText(config.customText, '', exif, config)
    || [exif.make, exif.model].filter(Boolean).join(' ')
    || 'SUPERIA 400'
  c.fillText(`${filmBrand.toUpperCase()}  ▶  ${frame}`, 0, 0)
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
    c.font = `400 ${dateFont}px ${f.mono}`
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
function renderInstax({ image, config, exif, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const sidePad = Math.round(long * config.padding / 100)
  const topPad = Math.round(sidePad * 0.8)
  const bottomPad = Math.round(sidePad * 3.5)
  const spread = config.shadow ? Math.round(long * 0.04 * 0.4) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W + sidePad * 2 + spread * 2
  canvas.height = H + topPad + bottomPad + spread * 2
  const c = canvas.getContext('2d')!

  c.fillStyle = shadowBgColor(config.bgColor)
  c.fillRect(0, 0, canvas.width, canvas.height)

  const { cardX, cardY, cardW, cardH } = drawCard(c, canvas, config, long)

  // 卡片内部纸张纹理（弱渐变）
  const grain = c.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH)
  grain.addColorStop(0, 'rgba(28,25,23,0.015)')
  grain.addColorStop(0.5, 'rgba(28,25,23,0)')
  grain.addColorStop(1, 'rgba(28,25,23,0.02)')
  c.fillStyle = grain
  c.fillRect(cardX, cardY, cardW, cardH)

  // 图像区域（轻微阴影）
  c.save()
  c.shadowColor = 'rgba(28,25,23,0.12)'
  c.shadowBlur = sidePad * 0.3
  c.shadowOffsetY = sidePad * 0.1
  c.fillStyle = '#000'
  c.fillRect(cardX + sidePad, cardY + topPad, W, H)
  c.restore()
  c.drawImage(image, cardX + sidePad, cardY + topPad, W, H)

  // 图像区域内的 Logo 水印（半透明叠加）
  const imgLeft = cardX + sidePad
  const imgTop = cardY + topPad
  if (config.showLogo && logo) {
    const wmFontPx = Math.max(10, Math.round(long * config.fontSize / 100 * 0.55))
    const wmPadX = Math.round(W * 0.04)
    const wmPadY = Math.round(H * 0.04)
    const lh = Math.round(wmFontPx * 1.5)
    const lw = Math.round(lh * (logo.width / logo.height))
    c.save()
    c.globalAlpha = 0.55
    c.drawImage(logo, imgLeft + wmPadX, imgTop + H - wmPadY - lh, lw, lh)
    c.restore()
  }

  // 底部白色边框区域内的 EXIF 参数信息
  const borderInfoFontPx = Math.max(10, Math.round(long * config.fontSize / 100 * 0.45))
  const borderTop = imgTop + H  // 图像底边 = 边框区域顶边
  let borderCurY = borderTop + bottomPad * 0.22

  if (config.showLogo) {
    const modelText = exif.model ?? ''
    if (modelText) {
      c.font = `500 ${Math.round(borderInfoFontPx * 1.1)}px ${f.display}`
      c.fillStyle = config.textColor
      c.globalAlpha = 0.7
      c.textAlign = 'left'
      c.textBaseline = 'top'
      c.fillText(modelText, cardX + sidePad * 1.2, borderCurY)
      borderCurY += Math.round(borderInfoFontPx * 1.1 * 1.5)
    }
  }
  if (config.showExif) {
    const paramText = formatExifLine(exif)
    if (paramText) {
      c.font = `400 ${borderInfoFontPx}px ${f.mono}`
      c.fillStyle = config.textColor
      c.globalAlpha = 0.5
      c.textAlign = 'left'
      c.textBaseline = 'top'
      c.fillText(paramText, cardX + sidePad * 1.2, borderCurY)
    }
  }
  c.globalAlpha = 1

  // 底部手写签名（保持在白色底边区域，强制约束在卡片内）
  const fontPx = Math.round(ref * config.fontSize / 100)
  const signature = resolveCustomText(config.customText, '', exif, config)
  if (signature) {
    const maxW = cardW - sidePad * 3.6
    const sigY = cardY + topPad + H + bottomPad * 0.55
    // 垂直安全：字号不能超出底边（预留日期小字空间）
    const cardBottom = cardY + cardH - sidePad * 0.6
    const maxFontH = (cardBottom - sigY) * 1.6
    c.font = `400 ${fontPx}px ${f.hand}`
    let actualFontPx = Math.min(fontPx, Math.max(8, Math.floor(maxFontH)))
    // 水平缩放
    if (c.measureText(signature).width > maxW) {
      const scale = maxW / c.measureText(signature).width
      actualFontPx = Math.max(8, Math.floor(actualFontPx * scale * 0.95))
    }
    c.font = `400 ${actualFontPx}px ${f.hand}`
    c.fillStyle = config.textColor
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    c.fillText(signature, cardX + sidePad * 1.2, sigY, maxW)
  }

  // 右下角日期小字
  if (exif.dateTaken) {
    const smallFont = Math.round(fontPx * 0.6)
    c.font = `300 ${smallFont}px ${f.ui}`
    c.fillStyle = 'rgba(28,25,23,0.5)'
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
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const displayFont = getFontStack(config.fontFamily)
  const pad = Math.round(long * config.padding / 100)
  const topArea = Math.round(ref * 0.08)
  const bottomArea = Math.round(ref * 0.12)
  const spread = config.shadow ? Math.round(long * 0.04 * 0.4) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2 + spread * 2
  canvas.height = H + pad * 2 + topArea + bottomArea + spread * 2
  const c = canvas.getContext('2d')!

  // 画布背景
  c.fillStyle = '#fafaf9'
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 卡片 + 三层阴影
  const { cardX, cardY, cardW, cardH } = drawCard(c, canvas, config, long)

  // 顶部小标签（"小红书 · 图文")
  const fontPx = Math.round(ref * config.fontSize / 100)
  c.textBaseline = 'middle'
  c.textAlign = 'left'
  c.fillStyle = withAlpha(config.textColor, 0.4)
  c.font = `400 ${Math.round(fontPx * 0.75)}px ${f.ui}`
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
  const hasLogo = config.showLogo && logo
  const hasDesc = !!(formatExifLine(exif) || exif.lens)

  if (hasLogo) {
    // 有 logo：左对齐标题/描述，右侧放 logo
    c.textAlign = 'left'
    c.fillStyle = config.textColor
    c.font = `400 ${Math.round(fontPx * 1.2)}px ${displayFont}`
    const title = resolveCustomText(config.customText, exif.model || '无标题', exif, config)
    c.fillText(title, cardX + pad * 1.2, bottomY + bottomArea * 0.38)

    c.fillStyle = withAlpha(config.textColor, 0.55)
    c.font = `400 ${Math.round(fontPx * 0.8)}px ${f.ui}`
    const desc = formatExifLine(exif) || (exif.lens ?? '')
    if (desc) c.fillText(desc, cardX + pad * 1.2, bottomY + bottomArea * 0.68)

    const lh = Math.round(ref * config.logoSize / 100 * 0.8)
    const lw = lh * (logo!.width / logo!.height)
    c.drawImage(logo!, cardX + cardW - pad * 1.2 - lw, bottomY + bottomArea / 2 - lh / 2, lw, lh)
  } else {
    // 无 logo：居中显示标题 + 描述
    c.textAlign = 'center'
    c.fillStyle = config.textColor
    c.font = `400 ${Math.round(fontPx * 1.2)}px ${displayFont}`
    const title = resolveCustomText(config.customText, exif.model || '无标题', exif, config)
    const titleY = hasDesc ? bottomY + bottomArea * 0.38 : bottomY + bottomArea * 0.5
    c.fillText(title, cardX + cardW / 2, titleY)

    c.fillStyle = withAlpha(config.textColor, 0.55)
    c.font = `400 ${Math.round(fontPx * 0.8)}px ${f.ui}`
    const desc = formatExifLine(exif) || (exif.lens ?? '')
    if (desc) c.fillText(desc, cardX + cardW / 2, bottomY + bottomArea * 0.68)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 11：Vintage 复古纸相框 —— 牛皮纸底 + 做旧边 + 手写签名
// ═══════════════════════════════════════════════════════
function renderVintage({ image, config, exif }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const pad = Math.round(long * config.padding / 100)

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2
  canvas.height = H + pad * 2 + Math.round(ref * 0.06)
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
  c.shadowColor = 'rgba(28,25,23,0.25)'
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
  const fontPx = Math.round(ref * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `400 ${fontPx}px ${f.hand}`
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  const sig = resolveCustomText(config.customText, 'Vintage', exif, config)
  c.fillText(sig, pad * 1.3, pad + H + Math.round(ref * 0.03))

  // 右下日期
  c.textAlign = 'right'
  c.font = `300 ${Math.round(fontPx * 0.8)}px ${f.ui}`
  if (exif.dateTaken) c.fillText(exif.dateTaken, canvas.width - pad * 1.3, pad + H + Math.round(ref * 0.03))

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 12：Magazine 杂志封面 —— 顶部大标题 + 底部 caption + 细线分隔
// ═══════════════════════════════════════════════════════
function renderMagazine({ image, exif, config }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const displayFont = getFontStack(config.fontFamily)
  const topBar = Math.round(ref * 0.08)
  const bottomBar = Math.round(ref * 0.1)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H + topBar + bottomBar
  const c = canvas.getContext('2d')!

  c.fillStyle = config.bgColor
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 图片居中
  c.drawImage(image, 0, topBar, W, H)

  const fontPx = Math.round(ref * config.fontSize / 100)
  const padX = Math.round(W * 0.04)

  // ── 顶部：杂志标题 + 期号 ──
  c.textBaseline = 'middle'
  c.textAlign = 'left'
  c.fillStyle = config.textColor
  c.font = `400 ${Math.round(fontPx * 1.8)}px ${displayFont}`
  c.fillText('PHOTO', padX, topBar / 2 - fontPx * 0.25)
  const photoW = c.measureText('PHOTO').width
  c.font = `300 ${Math.round(fontPx * 1.8)}px ${displayFont}`
  c.fillText('ZINE', padX + photoW + fontPx * 0.4, topBar / 2 - fontPx * 0.25)

  // 右上：期号 + 日期
  c.textAlign = 'right'
  c.font = `400 ${Math.round(fontPx * 0.65)}px ${f.mono}`
  c.fillStyle = 'rgba(28,25,23,0.55)'
  const issue = `ISSUE ${exif.dateTaken?.replace(/\D/g, '').slice(-4) || '001'}  ·  ${exif.dateTaken || ''}`
  c.fillText(issue, W - padX, topBar / 2 - fontPx * 0.25)

  // 顶部分隔线
  c.strokeStyle = 'rgba(28,25,23,0.15)'
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
  c.font = `400 ${Math.round(fontPx * 0.95)}px ${displayFont}`
  const title = resolveCustomText(config.customText, exif.model || 'Untitled', exif, config)
  c.fillText(title, padX, bottomY + bottomBar * 0.4)

  c.fillStyle = 'rgba(28,25,23,0.55)'
  c.font = `300 ${Math.round(fontPx * 0.7)}px ${f.ui}`
  const desc = formatExifLine(exif) || (exif.lens ?? '')
  if (desc) c.fillText(desc, padX, bottomY + bottomBar * 0.7)

  // 右下：页码
  c.textAlign = 'right'
  c.font = `400 ${Math.round(fontPx * 0.7)}px ${f.mono}`
  c.fillStyle = 'rgba(28,25,23,0.5)'
  c.fillText('— 01 / 01 —', W - padX, bottomY + bottomBar * 0.55)

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 13：Location 地理水印 —— 底部栏：Logo + 型号 + 📍地点 + 日期
// ═══════════════════════════════════════════════════════
function renderLocation({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const displayFont = getFontStack(config.fontFamily)
  const barH = Math.round(ref * 0.10)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H + barH
  const c = canvas.getContext('2d')!

  c.drawImage(image, 0, 0, W, H)

  c.fillStyle = config.bgColor
  c.fillRect(0, H, W, barH)

  const padX = Math.round(W * 0.035)
  const centerY = H + barH / 2
  const fontPx = Math.round(ref * config.fontSize / 100)

  // ── 左侧：Logo + 型号 ──
  const hasLogo = config.showLogo && logo
  let leftX = padX
  if (hasLogo) {
    const lh = Math.round(ref * config.logoSize / 100)
    const lw = lh * (logo!.width / logo!.height)
    c.drawImage(logo!, leftX, centerY - lh / 2, lw, lh)
    leftX += lw + padX * 0.6
  }

  c.textBaseline = 'middle'

  // 右侧：地点 + 日期
  const locationName = config.locationName || resolveCustomText(config.customText, '', exif, config)
  const hasRight = !!(locationName || exif.dateTaken)

  // 预计算右侧宽度以确定左侧可用区域
  let rightAreaW = 0
  if (hasRight) {
    c.font = `400 ${Math.round(fontPx * 1.0)}px ${displayFont}`
    if (locationName) rightAreaW = Math.max(rightAreaW, c.measureText(`📍 ${locationName}`).width)
    c.font = `400 ${Math.round(fontPx * 0.75)}px ${f.mono}`
    if (exif.dateTaken) rightAreaW = Math.max(rightAreaW, c.measureText(exif.dateTaken).width)
  }

  // 左侧文字布局
  if (hasLogo) {
    c.textAlign = 'left'
    c.fillStyle = config.textColor
    c.font = `400 ${Math.round(fontPx * 1.15)}px ${displayFont}`
    c.fillText(exif.model || '—', leftX, centerY - fontPx * 0.45)
    c.fillStyle = withAlpha(config.textColor, 0.55)
    c.font = `400 ${Math.round(fontPx * 0.75)}px ${f.ui}`
    const lens = exif.lens || formatExifLine(exif) || ''
    if (lens) c.fillText(lens, leftX, centerY + fontPx * 0.55)
  } else if (!hasRight) {
    // 无 logo 无右侧：全宽居中
    c.textAlign = 'center'
    c.fillStyle = config.textColor
    c.font = `400 ${Math.round(fontPx * 1.15)}px ${displayFont}`
    c.fillText(exif.model || '—', W / 2, centerY - fontPx * 0.45)
    c.fillStyle = withAlpha(config.textColor, 0.55)
    c.font = `400 ${Math.round(fontPx * 0.75)}px ${f.ui}`
    const lens = exif.lens || formatExifLine(exif) || ''
    if (lens) c.fillText(lens, W / 2, centerY + fontPx * 0.55)
  } else {
    // 无 logo 有右侧：左半区居中
    const leftEnd = W - padX - rightAreaW - padX
    const leftCenterX = leftEnd > padX ? (padX + leftEnd) / 2 : padX
    const align = leftEnd > padX ? 'center' as const : 'left' as const

    c.textAlign = align
    c.fillStyle = config.textColor
    c.font = `400 ${Math.round(fontPx * 1.15)}px ${displayFont}`
    c.fillText(exif.model || '—', leftCenterX, centerY - fontPx * 0.45)
    c.fillStyle = withAlpha(config.textColor, 0.55)
    c.font = `400 ${Math.round(fontPx * 0.75)}px ${f.ui}`
    const lens = exif.lens || formatExifLine(exif) || ''
    if (lens) c.fillText(lens, leftCenterX, centerY + fontPx * 0.55)
  }

  // ── 右侧：地点 + 日期 ──
  c.textAlign = 'right'
  c.fillStyle = config.textColor
  c.font = `400 ${Math.round(fontPx * 1.0)}px ${displayFont}`
  if (locationName) {
    c.fillText(`📍 ${locationName}`, W - padX, centerY - fontPx * 0.45)
  }
  c.fillStyle = withAlpha(config.textColor, 0.55)
  c.font = `400 ${Math.round(fontPx * 0.75)}px ${f.mono}`
  if (exif.dateTaken) {
    c.fillText(exif.dateTaken, W - padX, centerY + fontPx * 0.55)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 14：光影（light-shadow）—— 参考「光影边框」App
// 底部纯黑薄条 + 单行居中 EXIF（空格分隔，无 Logo，无 label）
// 顶部边缘带向上渐变雾化，让黑条与照片"融"在一起
// ═══════════════════════════════════════════════════════
function renderLightShadow({ image, config, exif }: RenderCtx): HTMLCanvasElement {
  const W = image.width
  const H = image.height
  // 黑条高度按图片高度的 5%（竖版/横版都基于 H，保持视觉厚度一致）
  const barH = Math.round(H * 0.05)
  // 顶部边缘雾化区（向上渐变 fade 进照片区域）
  // 比例：黑条高度的 60%，视觉上与黑条融为一体
  const fadeH = Math.max(8, Math.round(barH * 0.6))

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H + barH
  const c = canvas.getContext('2d')!

  // 绘制原图
  c.drawImage(image, 0, 0, W, H)

  // 1) 顶部边缘雾化：在照片最底部叠一层从透明到纯色的渐变
  //    让黑条外缘（与照片相接处）有"光渗"效果
  const fadeGrad = c.createLinearGradient(0, H - fadeH, 0, H)
  fadeGrad.addColorStop(0, withAlpha(config.bgColor, 0))
  fadeGrad.addColorStop(0.5, withAlpha(config.bgColor, 0.35))
  fadeGrad.addColorStop(1, withAlpha(config.bgColor, 0.85))
  c.fillStyle = fadeGrad
  c.fillRect(0, H - fadeH, W, fadeH)

  // 2) 底部纯黑薄条
  c.fillStyle = config.bgColor // 默认 #000000
  c.fillRect(0, H, W, barH)

  // 拼装单行 EXIF：品牌 型号  焦距 光圈 快门 ISO
  // 空格分隔（多个空格用于分组：型号 | 拍摄参数）
  const parts: string[] = []
  // 型号块：make + model（或仅 model）
  const modelBlock = [exif.make, exif.model].filter(Boolean).join(' ')
  if (modelBlock) parts.push(modelBlock)
  // 拍摄参数块
  const paramParts: string[] = []
  if (exif.focalLength) paramParts.push(`${Math.round(exif.focalLength)}mm`)
  if (exif.fNumber) paramParts.push(`F${exif.fNumber}`)
  if (exif.exposureTime) paramParts.push(exif.exposureTime)
  if (exif.iso) paramParts.push(`ISO${exif.iso}`)
  if (paramParts.length > 0) parts.push(paramParts.join(' '))

  // 兜底：自定义文字或日期
  const line = parts.length > 0
    ? parts.join('  ')
    : resolveCustomText(config.customText, exif.dateTaken || '', exif, config)

  if (!line) return canvas // 没有任何内容，只保留黑条

  // 字号：基于图片长边 1%（参考值），根据文本总宽度自适应缩小
  const long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const basePx = Math.max(10, Math.round(long * config.fontSize / 100 * 0.8))
  c.font = `300 ${basePx}px ${f.mono}`
  let textW = c.measureText(line).width
  const availW = W * 0.95
  // 自适应：文本过长时按比例缩小
  let finalPx = basePx
  if (textW > availW) {
    const shrink = availW / textW
    finalPx = Math.max(8, Math.round(basePx * shrink * 0.95))
    c.font = `300 ${finalPx}px ${f.mono}`
    textW = c.measureText(line).width
  }

  c.fillStyle = config.textColor // 默认 #ffffff
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(line, W / 2, H + barH / 2)

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 15：无框圆角（frameless-rounded）—— 参考 Copicseal tpl-default2
// 透明感画布 + 圆角图片 + 悬浮阴影 + 居中 EXIF 信息
// ═══════════════════════════════════════════════════════
function renderFramelessRounded({ image, config, exif, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width
  const H = image.height
  const long = Math.max(W, H)
  const f = makeFontCtx(config, long)

  // 边距：图片四周 + 底部 EXIF 区
  const pad = Math.max(Math.round(long * 0.02), Math.round(long * config.padding / 100))
  const infoGap = Math.round(long * 0.025) // 图片与 EXIF 间距
  const infoH = Math.round(long * 0.12)    // EXIF 区高度

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2
  canvas.height = H + pad * 2 + infoGap + infoH
  const c = canvas.getContext('2d')!

  // 画布背景
  c.fillStyle = config.bgColor
  c.fillRect(0, 0, canvas.width, canvas.height)

  const radius = Math.min(config.imageRadius ?? 16, Math.min(W, H) / 2)

  // 绘制带圆角 + 阴影的图片
  c.save()
  if (config.imageShadow) {
    c.shadowColor = 'rgba(28, 25, 23, 0.22)'
    c.shadowBlur = long * 0.03
    c.shadowOffsetX = 0
    c.shadowOffsetY = long * 0.012
  }
  // 1) 白色底板先渲染 → 阴影自然落到画布上
  roundRect(c, pad, pad, W, H, radius)
  c.fillStyle = '#ffffff'
  c.fill()
  c.restore()

  // 2) 圆角裁剪后绘制图片
  c.save()
  roundRect(c, pad, pad, W, H, radius)
  c.clip()
  c.drawImage(image, pad, pad, W, H)
  c.restore()

  // EXIF 信息（居中，垂直排列）
  const fontPx = Math.round(long * config.fontSize / 100)
  const centerX = canvas.width / 2
  let curY = pad + H + infoGap

  // 行 1：品牌 Logo + 型号
  if (config.showLogo || exif.model) {
    let logoEndX = centerX
    if (config.showLogo && logo && exif.model) {
      // 测量型号文字宽度，反推 Logo 起始位置，使整体居中
      const modelFontSize = Math.round(fontPx * 1.1)
      c.font = `500 ${modelFontSize}px ${f.display}`
      const modelW = c.measureText(exif.model).width
      const logoH = Math.round(fontPx * 1.4)
      const logoW = logoH * (logo.width / logo.height)
      const gap = fontPx * 0.5
      const totalW = logoW + gap + modelW
      const startX = centerX - totalW / 2
      // Logo 与文字中线对齐：文字 baseline=middle 时视觉中心在 box 的 50% 处
      c.drawImage(logo, startX, curY + (modelFontSize - logoH) / 2, logoW, logoH)
      logoEndX = startX + logoW + gap
      c.textAlign = 'left'
      c.textBaseline = 'middle'
      c.fillStyle = config.textColor
      c.fillText(exif.model, logoEndX, curY + modelFontSize / 2)
    } else if (exif.model) {
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillStyle = config.textColor
      c.font = `500 ${Math.round(fontPx * 1.1)}px ${f.display}`
      c.fillText(exif.model, centerX, curY + fontPx * 0.55)
    }
    curY += fontPx * 1.8
  }

  // 行 2：拍摄参数（等宽字体）
  const paramLine = [
    exif.focalLength ? `${Math.round(exif.focalLength)}mm` : '',
    exif.fNumber ? `f/${exif.fNumber}` : '',
    exif.exposureTime ?? '',
    exif.iso ? `ISO${exif.iso}` : '',
  ].filter(Boolean).join('  ·  ')
  if (paramLine) {
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillStyle = config.textColor
    c.font = `400 ${Math.round(fontPx * 0.85)}px ${f.mono}`
    c.fillText(paramLine, centerX, curY + fontPx * 0.45)
    curY += fontPx * 1.4
  }

  // 行 3：日期（较小、次级颜色）
  if (exif.dateTaken) {
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillStyle = withAlpha(config.textColor, 0.55)
    c.font = `300 ${Math.round(fontPx * 0.75)}px ${f.ui}`
    c.fillText(exif.dateTaken, centerX, curY + fontPx * 0.35)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 16：白色边框（white-border）—— 参考 Copicseal tpl-default
// 经典相框：四周等宽白边 + 底部两栏 EXIF + 外阴影
// ═══════════════════════════════════════════════════════
function renderWhiteBorder({ image, config, exif, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width
  const H = image.height
  const long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const border = Math.round(long * (config.borderPadding ?? 4) / 100)
  const bottomExtra = Math.round(long * 0.06) // 底部额外空间放 EXIF

  const canvas = document.createElement('canvas')
  canvas.width = W + border * 2
  canvas.height = H + border * 2 + bottomExtra
  const c = canvas.getContext('2d')!

  // 1) 外阴影：整个相框的悬浮感
  if (config.shadow) {
    c.save()
    c.shadowColor = 'rgba(28, 25, 23, 0.18)'
    c.shadowBlur = long * 0.025
    c.shadowOffsetX = 0
    c.shadowOffsetY = long * 0.01
    c.fillStyle = config.bgColor
    c.fillRect(0, 0, canvas.width, canvas.height)
    c.restore()
  } else {
    c.fillStyle = config.bgColor
    c.fillRect(0, 0, canvas.width, canvas.height)
  }

  // 2) 绘制原图
  c.drawImage(image, border, border, W, H)

  // 3) 底部 EXIF 区
  const infoY = border + H + Math.round(border * 0.6)
  const fontPx = Math.round(long * config.fontSize / 100)

  // 左栏：Logo + 型号
  let leftX = border
  if (config.showLogo && logo) {
    const logoH = Math.round(fontPx * 1.4)
    const logoW = logoH * (logo.width / logo.height)
    c.drawImage(logo, leftX, infoY + (fontPx * 1.2 - logoH) / 2, logoW, logoH)
    leftX += logoW + fontPx * 0.6
  }
  if (exif.model) {
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    c.fillStyle = config.textColor
    c.font = `500 ${Math.round(fontPx * 1.05)}px ${f.display}`
    c.fillText(exif.model, leftX, infoY + fontPx * 0.6)
  }

  // 右栏：参数 + 日期
  const rightX = border + W
  c.textAlign = 'right'
  c.textBaseline = 'middle'
  c.fillStyle = config.textColor
  c.font = `400 ${Math.round(fontPx * 0.85)}px ${f.mono}`
  const paramLine = [
    exif.focalLength ? `${Math.round(exif.focalLength)}mm` : '',
    exif.fNumber ? `f/${exif.fNumber}` : '',
    exif.exposureTime ?? '',
    exif.iso ? `ISO${exif.iso}` : '',
  ].filter(Boolean).join('  ·  ')
  if (paramLine) c.fillText(paramLine, rightX, infoY + fontPx * 0.45)
  if (exif.dateTaken) {
    c.fillStyle = withAlpha(config.textColor, 0.55)
    c.font = `300 ${Math.round(fontPx * 0.7)}px ${f.ui}`
    c.fillText(exif.dateTaken, rightX, infoY + fontPx * 1.35)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 通用：PS / LR 启动窗渲染（参数化品牌色与 Logo 发光色）
// 固定 10:10 正方形比例，左右分栏
// ═══════════════════════════════════════════════════════
function renderSplashScreen(
  ctx: RenderCtx,
  opts: {
    accentColor: string    // 强调色（Logo 发光 / 标题色）
    logoBoxBg: string      // Logo 方块背景
    brandText: string      // 品牌文字（当无 Logo 时显示，如 "Ps" / "Lr"）
    productName: string    // 产品名称（如 "Adobe Photoshop"）
  }
): HTMLCanvasElement {
  const { image, config, exif, logo } = ctx
  const W = image.width
  const H = image.height
  const long = Math.max(W, H)
  const f = makeFontCtx(ctx.config, long)

  // 画布：10:10 正方形，边长取图片长边 × 1.05
  const side = Math.round(long * 1.05)
  const outerPad = Math.round(side * 0.035)

  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const c = canvas.getContext('2d')!

  // 1) 整体背景
  c.fillStyle = config.bgColor
  c.fillRect(0, 0, side, side)

  // 2) 亚克力噪点层（isAcrylic 模式）
  if (config.isAcrylic) {
    c.fillStyle = 'rgba(255, 255, 255, 0.08)'
    c.fillRect(0, 0, side, side)
    // 简易噪点：稀疏白点
    const density = 0.003
    c.fillStyle = 'rgba(0, 0, 0, 0.06)'
    for (let y = 0; y < side; y += 4) {
      for (let x = 0; x < side; x += 4) {
        if (Math.random() < density) {
          c.fillRect(x, y, 1, 1)
        }
      }
    }
  }

  // 3) 左右面板划分
  const contentW = side - outerPad * 2
  const leftPanelW = Math.round(contentW * 0.55)
  const rightPanelW = contentW - leftPanelW
  const gap = Math.round(side * 0.02)
  const leftX = outerPad
  const rightX = outerPad + leftPanelW + gap

  // 4) 右面板：图片（contain 模式 + 圆角 + 阴影）
  const imgAreaY = outerPad
  const imgAreaH = side - outerPad * 2
  const imgAreaW = rightPanelW
  const imgRadius = config.imageRadius ?? 8

  // 计算 contain 缩放
  const scale = Math.min(imgAreaW / W, imgAreaH / H)
  const drawW = Math.round(W * scale)
  const drawH = Math.round(H * scale)
  const drawX = rightX + Math.round((imgAreaW - drawW) / 2)
  const drawY = imgAreaY + Math.round((imgAreaH - drawH) / 2)

  // 图片阴影 + 白色底 + 圆角裁剪
  c.save()
  if (config.shadow) {
    c.shadowColor = 'rgba(28, 25, 23, 0.25)'
    c.shadowBlur = side * 0.02
    c.shadowOffsetX = 0
    c.shadowOffsetY = side * 0.008
  }
  roundRect(c, drawX, drawY, drawW, drawH, imgRadius)
  c.fillStyle = '#ffffff'
  c.fill()
  c.restore()

  c.save()
  roundRect(c, drawX, drawY, drawW, drawH, imgRadius)
  c.clip()
  c.drawImage(image, drawX, drawY, drawW, drawH)
  c.restore()

  // 5) 左面板：品牌 Logo 方块 + 型号 + 参数 + 版权 + 网站
  const basePx = Math.max(12, Math.round(side * 0.018))
  const logoBoxSize = Math.round(basePx * 5)
  const logoBoxRadius = Math.round(basePx * 0.8)

  // Logo 方块（深色背景 + 发光效果）
  c.save()
  if (config.shadow) {
    c.shadowColor = opts.accentColor
    c.shadowBlur = basePx * 1.2
    c.shadowOffsetX = 0
    c.shadowOffsetY = 0
  }
  roundRect(c, leftX, outerPad, logoBoxSize, logoBoxSize, logoBoxRadius)
  c.fillStyle = opts.logoBoxBg
  c.fill()
  c.restore()

  // Logo 方块内容：优先用品牌 logo，否则显示品牌文字（Ps/Lr）
  if (config.showLogo && logo) {
    const logoSize = Math.round(logoBoxSize * 0.6)
    const logoDrawW = logoSize * (logo.width / logo.height)
    c.save()
    c.shadowColor = opts.accentColor
    c.shadowBlur = basePx * 0.5
    c.drawImage(
      logo,
      leftX + (logoBoxSize - logoDrawW) / 2,
      outerPad + (logoBoxSize - logoSize) / 2,
      logoDrawW,
      logoSize
    )
    c.restore()
  } else {
    c.fillStyle = opts.accentColor
    c.font = `600 ${Math.round(logoBoxSize * 0.45)}px ${f.ui}`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(opts.brandText, leftX + logoBoxSize / 2, outerPad + logoBoxSize / 2)
  }

  // 型号（大字）
  const modelY = outerPad + logoBoxSize + basePx * 1.8
  c.fillStyle = config.textColor
  c.font = `600 ${Math.round(basePx * 1.4)}px ${f.display}`
  c.textAlign = 'left'
  c.textBaseline = 'top'
  const modelText = exif.model || opts.productName
  c.fillText(modelText, leftX, modelY)

  // 分隔线
  const dividerY = modelY + basePx * 2.2
  c.strokeStyle = 'rgba(28, 25, 23, 0.08)'
  c.lineWidth = 1
  c.beginPath()
  c.moveTo(leftX, dividerY)
  c.lineTo(leftX + leftPanelW * 0.9, dividerY)
  c.stroke()

  // EXIF 详情列表
  const detailStartY = dividerY + basePx * 1.2
  const detailLineH = basePx * 1.5
  const detailFontPx = Math.round(basePx * 0.85)

  const details: Array<[string, string]> = []
  if (exif.make || exif.model) details.push(['Camera', [exif.make, exif.model].filter(Boolean).join(' ')])
  if (exif.focalLength) details.push(['Focal Length', `${Math.round(exif.focalLength)}mm`])
  if (exif.fNumber) details.push(['Aperture', `f/${exif.fNumber}`])
  if (exif.exposureTime) details.push(['Shutter', exif.exposureTime])
  if (exif.iso) details.push(['ISO', `${exif.iso}`])
  if (exif.dateTaken) details.push(['Date', exif.dateTaken])

  details.forEach(([label, value], i) => {
    const y = detailStartY + i * detailLineH
    c.fillStyle = withAlpha(config.textColor, 0.55)
    c.font = `400 ${detailFontPx}px ${f.ui}`
    c.fillText(label, leftX, y)
    c.fillStyle = config.textColor
    c.font = `500 ${detailFontPx}px ${f.mono}`
    c.fillText(value, leftX + basePx * 8, y)
  })

  // 版权 + 网站（底部）
  const footerY = side - outerPad - basePx * 2.8
  c.fillStyle = withAlpha(config.textColor, 0.5)
  c.font = `300 ${Math.round(basePx * 0.7)}px ${f.ui}`
  const copyright = config.copyright ?? '© Framelet. All rights reserved.'
  c.fillText(copyright, leftX, footerY)
  const website = config.website ?? ''
  if (website) {
    c.fillStyle = opts.accentColor
    c.fillText(website, leftX, footerY + basePx * 1.1)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 17：PS 启动窗（ps-splash）—— 模拟 Photoshop 启动加载界面
// Photoshop 品牌蓝 #31a8ff
// ═══════════════════════════════════════════════════════
function renderPsSplash(ctx: RenderCtx): HTMLCanvasElement {
  return renderSplashScreen(ctx, {
    accentColor: '#31a8ff',
    logoBoxBg: '#001e36',
    brandText: 'Ps',
    productName: 'Adobe Photoshop',
  })
}

// ═══════════════════════════════════════════════════════
// 模板 18：LR 启动窗（lr-splash）—— 模拟 Lightroom 启动加载界面
// Lightroom 品牌蓝 #0099ff
// ═══════════════════════════════════════════════════════
function renderLrSplash(ctx: RenderCtx): HTMLCanvasElement {
  return renderSplashScreen(ctx, {
    accentColor: '#0099ff',
    logoBoxBg: '#1a2535',
    brandText: 'Lr',
    productName: 'Adobe Lightroom',
  })
}

// ═══════════════════════════════════════════════════════
// 通用工具：9 宫格定位（0-8，左上到右下）
// ═══════════════════════════════════════════════════════
function gridPosition(
  pos: GridPosition,
  canvasW: number,
  canvasH: number,
  contentW: number,
  contentH: number,
  padX: number,
  padY: number,
): { x: number; y: number } {
  const row = Math.floor(pos / 3)
  const col = pos % 3
  const usableW = canvasW - padX * 2
  const usableH = canvasH - padY * 2
  let x: number, y: number
  if (col === 0)      x = padX
  else if (col === 1) x = padX + (usableW - contentW) / 2
  else                x = padX + usableW - contentW
  if (row === 0)      y = padY
  else if (row === 1) y = padY + (usableH - contentH) / 2
  else                y = padY + usableH - contentH
  return { x, y }
}

// ═══════════════════════════════════════════════════════
// 七段数码管：字符定义 + 绘制 + 字符串排版
// 段序：a(顶) b(右上) c(右下) d(底) e(左下) f(左上) g(中)
// 使用 tagged union 区分数字（7 段定义）与特殊字符（冒号/空格/点）
// ═══════════════════════════════════════════════════════
type SegDef =
  | { kind: 'digit'; segments: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] }
  | { kind: 'colon' }
  | { kind: 'dot' }
  | { kind: 'space' }

const SEVEN_SEG: Record<string, SegDef> = {
  '0': { kind: 'digit', segments: [true,  true,  true,  true,  true,  true,  false] },
  '1': { kind: 'digit', segments: [false, true,  true,  false, false, false, false] },
  '2': { kind: 'digit', segments: [true,  true,  false, true,  true,  false, true ] },
  '3': { kind: 'digit', segments: [true,  true,  true,  true,  false, false, true ] },
  '4': { kind: 'digit', segments: [false, true,  true,  false, false, true,  true ] },
  '5': { kind: 'digit', segments: [true,  false, true,  true,  false, true,  true ] },
  '6': { kind: 'digit', segments: [true,  false, true,  true,  true,  true,  true ] },
  '7': { kind: 'digit', segments: [true,  true,  true,  false, false, false, false] },
  '8': { kind: 'digit', segments: [true,  true,  true,  true,  true,  true,  true ] },
  '9': { kind: 'digit', segments: [true,  true,  true,  true,  false, true,  true ] },
  '-': { kind: 'digit', segments: [false, false, false, false, false, false, true ] },
  ':': { kind: 'colon' },
  ' ': { kind: 'space' },
  '.': { kind: 'dot' },
}

/** 单个七段字符的宽度（以字符高度为基准） */
function segCharWidth(char: string, charH: number): number {
  if (char === ':' || char === '.') return charH * 0.25
  if (char === ' ') return charH * 0.4
  return charH * 0.55
}

/** 在 (x, y) 绘制单个七段字符，返回字符宽度 */
function drawSegChar(
  c: CanvasRenderingContext2D,
  char: string,
  x: number,
  y: number,
  charH: number,
  color: string,
): number {
  const def = SEVEN_SEG[char]
  const segW = Math.max(1, charH * 0.14)   // 段宽
  const gap = Math.max(0.5, charH * 0.05)  // 段间
  c.fillStyle = color

  if (!def) {
    // 未知字符 → 绘制点
    c.fillRect(x, y + charH / 2 - segW / 2, segW, segW)
    return segCharWidth(' ', charH)
  }
  if (def.kind === 'colon') {
    // 冒号：上下两个点
    const dotR = segW * 0.7
    c.beginPath()
    c.arc(x + dotR, y + charH * 0.32, dotR, 0, Math.PI * 2)
    c.arc(x + dotR, y + charH * 0.68, dotR, 0, Math.PI * 2)
    c.fill()
    return charH * 0.25
  }
  if (def.kind === 'dot') {
    c.fillRect(x, y + charH - segW * 1.5, segW, segW)
    return charH * 0.25
  }
  if (def.kind === 'space') {
    return charH * 0.4
  }

  // def.kind === 'digit'
  const [a, b, cc, d, e, f, g] = def.segments
  const charW = charH * 0.55
  const innerH = (charH - segW - gap * 2) / 2

  // a: 顶部水平
  if (a) c.fillRect(x + segW + gap, y, charW - segW * 2 - gap * 2, segW)
  // d: 底部水平
  if (d) c.fillRect(x + segW + gap, y + charH - segW, charW - segW * 2 - gap * 2, segW)
  // g: 中部水平
  if (g) c.fillRect(x + segW + gap, y + segW + gap + innerH, charW - segW * 2 - gap * 2, segW)
  // f: 左上垂直
  if (f) c.fillRect(x, y + segW + gap, segW, innerH)
  // b: 右上垂直
  if (b) c.fillRect(x + charW - segW, y + segW + gap, segW, innerH)
  // e: 左下垂直
  if (e) c.fillRect(x, y + segW * 2 + gap * 2 + innerH, segW, innerH)
  // c: 右下垂直
  if (cc) c.fillRect(x + charW - segW, y + segW * 2 + gap * 2 + innerH, segW, innerH)

  return charW
}

/** 测量七段字符串总宽度 */
function measureSegString(text: string, charH: number): number {
  let w = 0
  for (const ch of text) w += segCharWidth(ch, charH)
  return w
}

/** 绘制七段字符串 + 双层发光（drop-shadow × 2） */
function drawSegString(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  charH: number,
  color: string,
): void {
  // 第 1 层发光（大范围柔和）
  c.save()
  c.shadowColor = color
  c.shadowBlur = charH * 0.35
  c.shadowOffsetX = 0
  c.shadowOffsetY = 0
  let curX = x
  for (const ch of text) curX += drawSegChar(c, ch, curX, y, charH, color)
  c.restore()

  // 第 2 层发光（小范围强烈）
  c.save()
  c.shadowColor = color
  c.shadowBlur = charH * 0.12
  curX = x
  for (const ch of text) curX += drawSegChar(c, ch, curX, y, charH, color)
  c.restore()
}

// ═══════════════════════════════════════════════════════
// 模板 19：老照片（vintage-photo）—— 参考 Copicseal tpl-default4
// 图片上叠加七段数码管时间戳 + 双层发光
// ═══════════════════════════════════════════════════════
function renderVintagePhoto({ image, config, exif }: RenderCtx): HTMLCanvasElement {
  const W = image.width
  const H = image.height

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!

  // 绘制原图
  c.drawImage(image, 0, 0, W, H)

  // 时间戳文本：EXIF 日期（YYYY-MM-DD HH:MM:SS 或仅日期）
  let ts = exif.dateTaken ?? ''
  if (ts && ts.length === 10) ts += ' 00:00:00' // 仅有日期时补 0 时间
  if (!ts) return canvas // 没有时间信息，不渲染

  // 字符高度：基于图片短边的 5%
  const shortEdge = Math.min(W, H)
  const charH = Math.round(shortEdge * 0.05)
  const color = config.timestampColor ?? '#ff3d00'

  // 测量字符串宽度
  const tsW = measureSegString(ts, charH)

  // 9 宫格定位（边距 4%）
  const padX = Math.round(W * 0.04)
  const padY = Math.round(H * 0.04)
  const pos = (config.timestampPosition ?? 8) as GridPosition
  const { x, y } = gridPosition(pos, W, H, tsW, charH, padX, padY)

  drawSegString(c, ts, x, y, charH, color)
  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 20：文字内嵌（text-embed）—— 参考 Copicseal tpl-default5
// EXIF 信息半透明覆盖在图片上，支持 V/H 双布局 + 9 宫格定位
// ═══════════════════════════════════════════════════════
function renderTextEmbed({ image, config, exif, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width
  const H = image.height
  const long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const fontPx = Math.max(10, Math.round(long * config.fontSize / 100))
  const opacity = config.embedOpacity ?? 0.55
  const layout = config.embedLayout ?? 'v'

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!

  // 绘制原图
  c.drawImage(image, 0, 0, W, H)

  // ─── 文本内容（P0 修复：支持 customText + showExif/showLogo 开关）───
  let line1 = ''
  let paramLine = ''
  let dateLine = ''

  const customText = config.customText
    ? cleanupText(replaceTextVars(config.customText, exif, {
        locationName: config.locationName,
        copyright: config.copyright,
      }))
    : ''

  if (customText) {
    // 自定义模式：按 \n 拆分多行；单行时放 line1
    const parts = customText.split('\n').map(s => s.trim()).filter(Boolean)
    line1 = parts[0] ?? ''
    paramLine = parts[1] ?? ''
    dateLine = parts[2] ?? ''
  } else {
    // 默认 EXIF 模式：受 showExif / showLogo 开关控制
    line1 = config.showLogo ? (exif.model ?? '') : ''
    if (config.showExif) {
      paramLine = [
        exif.focalLength ? `${Math.round(exif.focalLength)}mm` : '',
        exif.fNumber ? `f/${exif.fNumber}` : '',
        exif.exposureTime ?? '',
        exif.iso ? `ISO${exif.iso}` : '',
      ].filter(Boolean).join('  ')
      dateLine = exif.dateTaken ?? ''
    }
  }

  // Logo 宽度（仅当 showLogo=true 且有 logo 时才显示）
  const showLogo = !!(config.showLogo && logo)
  const logoH = Math.round(fontPx * 1.2)
  const logoW = showLogo && logo ? Math.round(logoH * (logo.width / logo.height)) : 0

  // 计算文本块尺寸
  c.font = `500 ${Math.round(fontPx * 1.05)}px ${f.display}`
  const line1W = line1 ? c.measureText(line1).width : 0
  c.font = `400 ${Math.round(fontPx * 0.85)}px ${f.mono}`
  const paramW = paramLine ? c.measureText(paramLine).width : 0
  c.font = `300 ${Math.round(fontPx * 0.75)}px ${f.ui}`
  const dateW = dateLine ? c.measureText(dateLine).width : 0

  let blockW: number, blockH: number
  let showSep = false
  if (layout === 'v') {
    blockW = Math.max(line1W, paramW, dateW)
    blockH = (line1 ? fontPx * 1.5 : 0) + (paramLine ? fontPx * 1.2 : 0) + (dateLine ? fontPx * 1.1 : 0)
  } else {
    // 水平布局：仅当「Logo 或 line1 存在」且「line1 或 paramLine 存在」时才显示分隔线
    const hasLeft = showLogo || !!line1
    const hasRight = !!line1 || !!paramLine
    showSep = hasLeft && hasRight
    const sepW = showSep ? Math.round(fontPx * 0.15) : 0
    const gap = fontPx * 0.6
    blockW = (logoW ? logoW + gap : 0)
      + (showSep ? sepW + gap : 0)
      + line1W
      + (paramLine ? gap + paramW : 0)
    blockH = Math.max(logoH, fontPx * 1.8)
  }

  // 9 宫格定位
  const padX = Math.round(W * 0.05)
  const padY = Math.round(H * 0.05)
  const pos = (config.embedPosition ?? 7) as GridPosition
  const { x: bx, y: by } = gridPosition(pos, W, H, blockW, blockH, padX, padY)

  if (layout === 'v') {
    // 垂直布局：所有元素一起受 opacity 影响
    c.globalAlpha = opacity
    let curY = by
    if (line1) {
      c.fillStyle = config.textColor
      c.font = `500 ${Math.round(fontPx * 1.05)}px ${f.display}`
      c.textAlign = 'left'
      c.textBaseline = 'top'
      c.fillText(line1, bx, curY)
      curY += fontPx * 1.5
    }
    if (paramLine) {
      c.fillStyle = config.textColor
      c.font = `400 ${Math.round(fontPx * 0.85)}px ${f.mono}`
      c.fillText(paramLine, bx, curY)
      curY += fontPx * 1.2
    }
    if (dateLine) {
      c.fillStyle = config.textColor
      c.font = `300 ${Math.round(fontPx * 0.75)}px ${f.ui}`
      c.fillText(dateLine, bx, curY)
    }
    c.globalAlpha = 1
  } else {
    // 水平布局：Logo 全不透明 + 文字半透明
    let curX = bx
    const centerY = by + blockH / 2
    c.textBaseline = 'middle'

    // Logo：全不透明绘制（P1 修复：不受 globalAlpha 影响）
    if (showLogo && logo) {
      c.globalAlpha = 1
      c.drawImage(logo, curX, centerY - logoH / 2, logoW, logoH)
      curX += logoW + fontPx * 0.6
    }

    // 文字部分：半透明
    c.globalAlpha = opacity

    // 竖线分隔（P1 修复：仅当需要时绘制）
    if (showSep) {
      c.strokeStyle = config.textColor
      c.lineWidth = Math.max(1, fontPx * 0.08)
      c.beginPath()
      c.moveTo(curX, by + blockH * 0.2)
      c.lineTo(curX, by + blockH * 0.8)
      c.stroke()
      curX += Math.round(fontPx * 0.15) + fontPx * 0.6
    }

    if (line1) {
      c.fillStyle = config.textColor
      c.font = `500 ${Math.round(fontPx * 1.05)}px ${f.display}`
      c.textAlign = 'left'
      c.fillText(line1, curX, centerY)
      curX += line1W + fontPx * 0.6
    }
    if (paramLine) {
      c.font = `400 ${Math.round(fontPx * 0.85)}px ${f.mono}`
      c.fillText(paramLine, curX, centerY)
    }
    c.globalAlpha = 1
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 21：平铺水印（tiled-watermark）—— 参考 Copicseal tpl-default6
// 全图平铺旋转水印瓦片，可调密度/角度/透明度
// ═══════════════════════════════════════════════════════
function renderTiledWatermark({ image, config, exif }: RenderCtx): HTMLCanvasElement {
  const W = image.width
  const H = image.height
  const long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const fontPx = Math.max(10, Math.round(long * config.fontSize / 100))
  const angle = (config.watermarkAngle ?? -22) * Math.PI / 180
  const density = config.watermarkDensity ?? 1
  const opacity = config.watermarkOpacity ?? 0.18
  const text = (config.watermarkText || config.customText)
    ? cleanupText(replaceTextVars(config.watermarkText || config.customText, exif, { locationName: config.locationName, copyright: config.copyright }))
    : 'Framelet'

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!

  // 绘制原图
  c.drawImage(image, 0, 0, W, H)

  // 测量单个水印文本尺寸
  c.font = `400 ${fontPx}px ${f.display}`
  const textW = c.measureText(text).width
  const textH = fontPx

  // 瓦片尺寸 = 文本尺寸 + 间距（密度控制）
  // 使用 sqrt 曲线代替线性倒数：density=0.5 时间距不会过大，density=3 时也不会过密
  // 附加最小基础间距（0.3× 文本尺寸），保证极值下仍有可读间隙
  const gapX = textW * (0.3 + 0.8 / Math.sqrt(density))
  const gapY = textH * (0.5 + 1.2 / Math.sqrt(density))
  const tileW = Math.round(textW + gapX)
  const tileH = Math.round(textH + gapY)

  // 创建瓦片 canvas
  const tile = document.createElement('canvas')
  tile.width = tileW
  tile.height = tileH
  const tc = tile.getContext('2d')!
  tc.fillStyle = config.textColor
  tc.font = `400 ${fontPx}px ${f.display}`
  tc.textAlign = 'center'
  tc.textBaseline = 'middle'
  tc.fillText(text, tileW / 2, tileH / 2)

  // 计算覆盖画布所需的对角线长度（旋转后瓦片需要重复的范围）
  const diag = Math.ceil(Math.sqrt(W * W + H * H))
  const tilesX = Math.ceil(diag / tileW) + 2
  const tilesY = Math.ceil(diag / tileH) + 2

  // 用 pattern 平铺（但 pattern 不支持旋转，所以手动绘制旋转后的瓦片网格）
  c.save()
  c.globalAlpha = opacity
  c.translate(W / 2, H / 2)
  c.rotate(angle)
  c.translate(-diag / 2, -diag / 2)
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      c.drawImage(tile, tx * tileW, ty * tileH)
    }
  }
  c.restore()

  return canvas
}
