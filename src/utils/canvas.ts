// Canvas 渲染核心 —— 21 种边框模板绘制
import type { ExifData, TemplateConfig, GridPosition } from '../types'
import {
  withAlpha, getFontStack,
  getFontForRole, getResponsive,
  shadowBgColor,
  type ResponsiveConfig,
} from './fonts'
import {
  resolveFrameContent, resolveCustomText, renderPlainImage,
} from './frameContent'
import {
  drawFittedText, ellipsize, fitFontSize, hashSeed, drawGrain, fitImageInBox,
} from './renderUtils'
import {
  SHADOW_BLUR_RATIO, SHADOW_SPREAD_RATIO, BOTTOM_EXTRA_RATIO,
  POLAROID_BOTTOM_MULTIPLIER, INSTA_BOTTOM_EXTRA_RATIO, LEICA_BAR_HEIGHT_RATIO,
  EXIF_BAR_HEIGHT_RATIO, MIN_PADDING_PX, MIN_PADDING_RATIO,
  FILM_HOLE_RADIUS_RATIO, FILM_HOLE_GAP_MULTIPLIER, FILM_HOLE_MAX_ITERATIONS,
  FILM_HOLE_ALPHA, LOGO_WATERMARK_SCALE, BORDER_INFO_FONT_SCALE,
  TITLE_FONT_SCALE, SUBTITLE_FONT_SCALE,
  ALPHA_SEMI_TRANSPARENT,
  ALPHA_MEDIUM,
  ALPHA_STRONG, BG_MASK_COLOR, LEICA_RED,
  LOGO_TEXT_GAP_RATIO, IMAGE_CORNER_REDUCTION,
  LEICA_DOT_RADIUS_RATIO,
  LEICA_DOT_OFFSET_X, LEICA_TEXT_OFFSET_X, LINE_GAP_RATIO,
  VERTICAL_SAFETY_MARGIN,
  SHADOW_HEX, CARD_SHADOW_ALPHA, IMAGE_SHADOW_ALPHA,
  IMAGE_SHADOW_BLUR_RATIO, IMAGE_SHADOW_OFFSET_RATIO,
  VINTAGE_GRAIN, ACRYLIC_GRAIN, XHS_COVER_RATIO,
} from '../constants'

export interface RenderCtx {
  image: HTMLImageElement
  exif: ExifData
  logo: HTMLImageElement | null
  config: TemplateConfig
  /** 稳定纹理种子（文件名 + 模板 + 尺寸），保证预览与导出颗粒一致 */
  seed?: number
}

/** 取得纹理种子；未显式传入时基于模板、图片与配置推导，保证可复现 */
function textureSeed(ctx: RenderCtx): number {
  if (ctx.seed !== undefined) return ctx.seed
  const { config, exif, image } = ctx
  return hashSeed([
    config.id,
    exif.model ?? '',
    exif.dateTaken ?? '',
    config.bgColor,
    `${image.width}x${image.height}`,
  ].join('|'))
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
    const blur = Math.round(long * SHADOW_BLUR_RATIO)   // 4% 长边 → 更强的模糊
    const spread = Math.round(blur * SHADOW_SPREAD_RATIO) // 阴影外扩
    c.save()
    // 第 1 层：大范围柔和（模拟环境光）
    c.shadowColor = withAlpha(SHADOW_HEX, CARD_SHADOW_ALPHA[0])
    c.shadowBlur = blur * 1.5
    c.shadowOffsetY = blur * 0.6
    c.fillStyle = config.bgColor
    roundRect(c, spread, spread, canvas.width - spread * 2, canvas.height - spread * 2, config.radius)
    c.fill()
    c.restore()

    c.save()
    // 第 2 层：中等模糊（过渡）
    c.shadowColor = withAlpha(SHADOW_HEX, CARD_SHADOW_ALPHA[1])
    c.shadowBlur = blur * 0.8
    c.shadowOffsetY = blur * 0.3
    c.fillStyle = config.bgColor
    roundRect(c, spread, spread, canvas.width - spread * 2, canvas.height - spread * 2, config.radius)
    c.fill()
    c.restore()

    c.save()
    // 第 3 层：小范围锐利（近接触阴影）
    c.shadowColor = withAlpha(SHADOW_HEX, CARD_SHADOW_ALPHA[2])
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
  const content = resolveFrameContent(exif, config, logo)
  const pad = Math.round(long * config.padding / 100)
  const bottomExtra = Math.round(ref * BOTTOM_EXTRA_RATIO)
  const spread = config.shadow ? Math.round(long * SHADOW_BLUR_RATIO * SHADOW_SPREAD_RATIO) : 0

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

  const centerY = cardY + pad + H + bottomExtra / 2
  const logoH = content.logo ? Math.round(ref * config.logoSize / 100) : 0
  const logoW = content.logo ? logoH * (content.logo.width / content.logo.height) : 0
  const logoGap = content.logo ? Math.round(ref * LOGO_TEXT_GAP_RATIO) : 0

  // 底部文字：自定义文字优先，否则「型号 · 参数」
  const line = content.hasCustom
    ? content.custom
    : [content.title, content.subtitle].filter(Boolean).join('  ·  ')

  if (line) {
    const availW = canvas.width - pad * 2 - logoW - logoGap
    const fontPx = Math.max(9, Math.round(ref * config.fontSize / 100))
    c.fillStyle = config.textColor
    c.textBaseline = 'middle'
    if (content.logo) {
      // 有 Logo 时文字左对齐接在 Logo 后方
      c.textAlign = 'left'
      drawFittedText(c, line, cardX + pad + logoW + logoGap, centerY,
        px => `400 ${px}px ${f.ui}`, fontPx, availW)
    } else {
      c.textAlign = 'center'
      drawFittedText(c, line, canvas.width / 2, centerY,
        px => `400 ${px}px ${f.ui}`, fontPx, availW)
    }
  }

  // 左下 Logo
  if (content.logo) {
    c.drawImage(content.logo, cardX + pad, centerY - logoH / 2, logoW, logoH)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 2：拍立得 Polaroid —— 上左右窄边，下方大留白
// ═══════════════════════════════════════════════════════
function renderPolaroid({ image, config, exif, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const content = resolveFrameContent(exif, config, logo)
  const sidePad = Math.round(long * config.padding / 100)
  const bottomPad = Math.round(long * config.padding / 100 * POLAROID_BOTTOM_MULTIPLIER)
  const spread = config.shadow ? Math.round(long * SHADOW_BLUR_RATIO * SHADOW_SPREAD_RATIO) : 0

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
  if (content.logo) {
    const wmFontPx = Math.max(10, Math.round(long * config.fontSize / 100 * LOGO_WATERMARK_SCALE))
    const wmPadX = Math.round(W * 0.04)
    const wmPadY = Math.round(H * 0.04)
    const lh = Math.round(wmFontPx * 1.5)
    const lw = Math.round(lh * (content.logo.width / content.logo.height))
    c.save()
    c.globalAlpha = ALPHA_SEMI_TRANSPARENT
    c.drawImage(content.logo, imgLeft + wmPadX, imgTop + H - wmPadY - lh, lw, lh)
    c.restore()
  }

  // 底部边框区域：型号 / 参数，逐行左对齐且限制在卡片内
  const borderInfoFontPx = Math.max(10, Math.round(long * config.fontSize / 100 * BORDER_INFO_FONT_SCALE))
  const borderTextX = cardX + sidePad * 1.2
  const borderAvailW = cardX + W + sidePad - borderTextX
  let borderCurY = imgTop + H + bottomPad * 0.15

  if (content.model) {
    const modelFont = Math.round(borderInfoFontPx * 1.1)
    c.save()
    c.globalAlpha = ALPHA_MEDIUM
    c.fillStyle = config.textColor
    c.textAlign = 'left'
    c.textBaseline = 'top'
    drawFittedText(c, content.model, borderTextX, borderCurY,
      px => `500 ${px}px ${f.display}`, modelFont, borderAvailW)
    c.restore()
    borderCurY += Math.round(modelFont * 1.5)
  }
  if (content.exifLine) {
    c.save()
    c.globalAlpha = 0.5
    c.fillStyle = config.textColor
    c.textAlign = 'left'
    c.textBaseline = 'top'
    drawFittedText(c, content.exifLine, borderTextX, borderCurY,
      px => `400 ${px}px ${f.mono}`, borderInfoFontPx, borderAvailW)
    c.restore()
  }

  // 底部签名文字（保持在白色底边区域，强制约束在卡片内）
  const fontPx = Math.max(24, Math.round(long * config.fontSize / 100))
  const signatureLine = content.custom || content.date
  if (signatureLine) {
    const maxW = canvas.width - sidePad * 2.4
    const sigY = cardY + sidePad + H + bottomPad / 2
    // 垂直安全：字号不能超出底边
    const cardBottom = cardY + sidePad + H + bottomPad
    const maxFontH = (cardBottom - sigY) * VERTICAL_SAFETY_MARGIN
    const handFont = (px: number) => `400 ${px}px ${f.hand}`
    const actualFontPx = Math.min(
      Math.floor(maxFontH),
      fitFontSize(c, signatureLine, handFont, fontPx, maxW, 10),
    )
    c.font = handFont(actualFontPx)
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
function renderFilm({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const content = resolveFrameContent(exif, config, logo)
  // 强制最小边距，避免 holeGap = 0 导致死循环
  const minPad = Math.max(MIN_PADDING_PX, Math.round(long * MIN_PADDING_RATIO))
  const pad = Math.max(minPad, Math.round(long * config.padding / 100))

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2
  canvas.height = H + pad * 2
  const c = canvas.getContext('2d')!

  c.fillStyle = config.bgColor
  c.fillRect(0, 0, canvas.width, canvas.height)

  c.drawImage(image, pad, pad, W, H)

  // 齿孔（上下各一排）
  const holeR = pad * FILM_HOLE_RADIUS_RATIO
  const holeGap = Math.max(1, pad * FILM_HOLE_GAP_MULTIPLIER)
  c.fillStyle = '#000'
  
  // 提前退出：防止 holeGap <= 0 导致死循环或无效循环
  if (holeGap <= 0 || holeR <= 0) return canvas
  
  const drawHoles = (yCenter: number) => {
    let iter = 0
    for (let x = pad + holeGap; x < canvas.width - pad - holeGap && iter < FILM_HOLE_MAX_ITERATIONS; x += holeGap) {
      c.beginPath()
      c.arc(x, yCenter, holeR, 0, Math.PI * 2)
      c.fillStyle = `rgba(255,255,255,${FILM_HOLE_ALPHA})`
      c.fill()
      iter++
    }
  }
  drawHoles(pad / 2)
  drawHoles(canvas.height - pad / 2)

  // 胶片编号与参数：仅在有内容时绘制，编号受 showExif 控制
  if (!content.hasAny) return canvas

  const fontPx = Math.round(ref * config.fontSize / 100)
  const textY = canvas.height - pad / 2 - holeR - fontPx * 0.9
  const textAvailW = (canvas.width - pad * 2 - holeGap * 2) / 2
  c.fillStyle = config.textColor
  c.textBaseline = 'middle'

  const canShowFrame = config.showExif !== false
  const frame = exif.dateTaken?.replace(/\D/g, '').slice(-4) || '0001'

  if (canShowFrame || content.hasCustom) {
    const frameLabel = content.hasCustom ? content.custom : `▶ FRAME ${frame}`
    c.textAlign = 'left'
    c.font = `${fontPx}px ${f.mono}`
    c.fillText(ellipsize(c, frameLabel, textAvailW), pad + holeGap, textY)
  }

  if (content.exifLine || content.model) {
    const rightText = content.exifLine || content.model
    c.textAlign = 'right'
    c.font = `${fontPx}px ${f.mono}`
    c.fillText(ellipsize(c, rightText, textAvailW), canvas.width - pad - holeGap, textY)
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
  const content = resolveFrameContent(exif, config, logo)

  // 无任何可展示内容且开启 hideEmptyExif：回退为纯图片，避免输出空黑栏
  if (content.shouldHideInfo) return renderPlainImage(image)

  const barH = Math.round(ref * EXIF_BAR_HEIGHT_RATIO)

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
  const hasLogo = !!content.logo
  const modelText = content.model
  const lensText = content.lens || (content.hasCustom ? content.custom : '')

  // 收集实际存在的参数值（已受 showExif 控制）
  const paramValues = content.params.map(p => p.value)

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
  const rightBlocks = content.params

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
      c.drawImage(content.logo!, leftX, centerY - lh / 2, lw, lh)
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
  const content = resolveFrameContent(exif, config, logo)
  const pad = Math.round(long * config.padding / 100)
  // 无文案时收起底部信息区，避免白底空块
  const bottomExtra = content.hasAny ? Math.round(ref * INSTA_BOTTOM_EXTRA_RATIO) : 0
  const spread = config.shadow ? Math.round(long * SHADOW_BLUR_RATIO * SHADOW_SPREAD_RATIO) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2 + spread * 2
  canvas.height = H + pad * 2 + bottomExtra + spread * 2
  const c = canvas.getContext('2d')!

  // 全画布背景（半透明遮罩）
  c.fillStyle = BG_MASK_COLOR
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 卡片 + 三层阴影
  const { cardX, cardY } = drawCard(c, canvas, config, long)

  // 图像圆角剪裁
  const imgX = cardX + pad
  const imgY = cardY + pad
  c.save()
  roundRect(c, imgX, imgY, W, H, Math.max(0, config.radius - pad * IMAGE_CORNER_REDUCTION))
  c.clip()
  c.drawImage(image, imgX, imgY, W, H)
  c.restore()

  if (!content.hasAny) return canvas

  // 底部信息（两行布局：上行=型号，下行=EXIF）
  const fontPx = Math.round(ref * config.fontSize / 100)
  const titleFont = Math.round(fontPx * TITLE_FONT_SCALE)
  const subFont = Math.round(fontPx * SUBTITLE_FONT_SCALE)
  const lineGap = Math.round(fontPx * LINE_GAP_RATIO)
  const centerY = imgY + H + bottomExtra / 2
  c.textBaseline = 'middle'

  // 上行基线 = centerY - (subFont + lineGap) / 2
  // 下行基线 = centerY + (titleFont + lineGap) / 2
  // 这样两行文字的视觉中线正好落在 centerY
  const topY = centerY - (subFont + lineGap) / 2
  const botY = centerY + (titleFont + lineGap) / 2
  const textBlockH = titleFont + lineGap + subFont

  // Logo 与上行文字对齐（同高）
  const logoH = content.logo ? Math.round(textBlockH * 0.95) : 0
  const logoW = content.logo ? logoH * (content.logo.width / content.logo.height) : 0
  const logoGap = content.logo ? Math.round(ref * LOGO_TEXT_GAP_RATIO) : 0

  let leftX = imgX
  if (content.logo) {
    c.drawImage(content.logo, leftX, centerY - logoH / 2, logoW, logoH)
    leftX += logoW + logoGap
  }

  // 两行文字：自定义文字优先，否则型号 + 参数
  const title = content.hasCustom ? content.custom : content.model
  const sub = content.subtitle
  const textX = content.logo ? leftX : canvas.width / 2
  c.textAlign = content.logo ? 'left' : 'center'
  const availTextW = Math.max(40, content.logo
    ? canvas.width - leftX - pad
    : canvas.width - pad * 2)

  if (title) {
    c.fillStyle = config.textColor
    drawFittedText(c, title, textX, topY, px => `400 ${px}px ${displayFont}`, titleFont, availTextW)
  }
  if (sub) {
    c.fillStyle = withAlpha(config.textColor, ALPHA_SEMI_TRANSPARENT)
    drawFittedText(c, sub, textX, botY, px => `400 ${px}px ${f.ui}`, subFont, availTextW)
  }

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
  const content = resolveFrameContent(exif, config, logo)

  // 无任何可展示内容且开启 hideEmptyExif：回退为纯图片，避免输出空黑栏
  if (content.shouldHideInfo) return renderPlainImage(image)

  const barH = Math.round(ref * LEICA_BAR_HEIGHT_RATIO)

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
  const dotR = barH * LEICA_DOT_RADIUS_RATIO
  const dotX = padX + dotR * LEICA_DOT_OFFSET_X
  c.fillStyle = LEICA_RED
  c.beginPath()
  c.arc(dotX, centerY, dotR, 0, Math.PI * 2)
  c.fill()

  const brandX = padX + dotR * LEICA_TEXT_OFFSET_X
  c.textAlign = 'left'
  c.textBaseline = 'middle'

  // 右侧文本：自定义文字优先，否则参数行，再次型号
  const rightText = content.hasCustom
    ? content.custom
    : (content.exifLine || content.model)

  // 右侧文本宽度决定左侧品牌文案可用空间
  c.font = `300 ${Math.round(fontPx * 0.8)}px ${f.mono}`
  const rightW = rightText ? c.measureText(rightText).width : 0
  const brandAvailW = Math.max(
    40,
    W - padX * 2 - rightW - (rightText ? padX * 2 : 0) - (brandX - padX),
  )

  // 红点旁的 LEICA 字样（超出可用宽度时自动缩小）
  c.fillStyle = config.textColor
  drawFittedText(c, 'Leica', brandX, centerY - fontPx * 0.5,
    px => `400 ${px}px ${displayFont}`, Math.round(fontPx * 0.95), brandAvailW)
  c.fillStyle = withAlpha('#ffffff', ALPHA_SEMI_TRANSPARENT)
  drawFittedText(c, 'CAMERA · WETZLAR', brandX, centerY + fontPx * 0.55,
    px => `300 ${px}px ${f.ui}`, Math.round(fontPx * 0.5), brandAvailW)

  // 右侧参数（右对齐）— 仅在有内容时渲染
  if (rightText) {
    c.textAlign = 'right'
    c.fillStyle = config.textColor
    c.font = `300 ${Math.round(fontPx * 0.8)}px ${f.mono}`
    c.fillText(ellipsize(c, rightText, W - padX * 2 - brandX + padX), W - padX, centerY)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 7：Red Dot 红点水印 —— 悬浮在图片右下角（不扩画布）
// ═══════════════════════════════════════════════════════
function renderRedDot({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const displayFont = getFontStack(config.fontFamily)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!

  c.drawImage(image, 0, 0, W, H)

  const content = resolveFrameContent(exif, config, logo)
  // 无任何可展示内容：不绘制悬浮块，直接输出原图
  if (!content.hasAny) return canvas

  const fontPx = Math.round(ref * config.fontSize / 100)
  const pad = Math.round(ref * 0.025)
  const dotR = Math.round(ref * 0.012)

  // 上行为标题（自定义文字优先，否则型号），下行为参数行
  const titleText = content.custom || content.model
  const infoText = content.exifLine || content.date || (content.custom ? content.model : '')
  if (!titleText && !infoText) return canvas

  const innerFontMax = Math.max(fontPx, Math.round(fontPx * 0.8))
  c.font = `300 ${innerFontMax}px ${f.mono}`
  const rawTextW = Math.max(
    c.measureText(titleText).width,
    c.measureText(infoText).width,
    60,
  )
  // 悬浮块宽度不超过画布宽度的 62%
  const maxBlockW = W * 0.62
  const blockW = Math.min(rawTextW + dotR * 6 + pad * 1.2, maxBlockW)
  const textAvailW = Math.max(20, blockW - dotR * 3.5 - dotR * 1.6)
  const blockH = fontPx * 2.6
  const blockX = W - blockW - pad
  const blockY = H - blockH - pad

  c.fillStyle = 'rgba(28,25,23,0.35)'
  roundRect(c, blockX, blockY, blockW, blockH, Math.round(ref * 0.006))
  c.fill()

  // 红点
  c.fillStyle = LEICA_RED
  c.beginPath()
  c.arc(blockX + dotR * 1.6, blockY + blockH / 2, dotR, 0, Math.PI * 2)
  c.fill()

  // 文字
  const textX = blockX + dotR * 3.5
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  if (titleText) {
    c.fillStyle = config.textColor
    drawFittedText(c, titleText, textX, blockY + blockH / 2 - fontPx * 0.55,
      px => `400 ${px}px ${displayFont}`, fontPx, textAvailW)
  }
  if (infoText) {
    c.fillStyle = withAlpha('#ffffff', ALPHA_STRONG)
    drawFittedText(c, infoText, textX, blockY + blockH / 2 + fontPx * 0.55,
      px => `300 ${px}px ${f.mono}`, Math.round(fontPx * 0.8), textAvailW)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 8：Dazz 胶卷 —— 仿 135 胶卷边框，上下齿孔 + 侧边文字 + 日期印字
// ═══════════════════════════════════════════════════════
function renderDazz({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const content = resolveFrameContent(exif, config, logo)
  // 强制最小边距，避免 holeGap = 0 导致死循环
  const minPad = Math.max(MIN_PADDING_PX, Math.round(long * MIN_PADDING_RATIO))
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
    let iter = 0
    for (let x = pad + holeGap * 0.8; x < canvas.width - pad - holeGap * 0.5 && iter < FILM_HOLE_MAX_ITERATIONS; x += holeGap) {
      roundRect(c, x - holeW / 2, yCenter - holeH / 2, holeW, holeH, holeW * 0.25)
      c.fill()
      iter++
    }
  }
  drawHoleRow(pad / 2)
  drawHoleRow(canvas.height - pad / 2)

  if (!content.hasAny) return canvas

  // 侧边竖排文字（胶片编号 + 品牌）
  const fontPx = Math.round(ref * config.fontSize / 100)
  c.fillStyle = config.textColor
  c.font = `400 ${fontPx}px ${f.mono}`
  c.textBaseline = 'middle'
  c.textAlign = 'center'

  // 帧号由拍摄日期派生，因此同样受 showExif 门控（与 renderFilm 保持一致）
  const canShowFrame = config.showExif !== false
  const frame = canShowFrame
    ? (content.date?.replace(/\D/g, '').slice(-4) || '0036')
    : ''
  const sideAvailW = canvas.height - pad * 3

  // 左侧竖排：品牌/型号（自定义文字优先，帧号仅在开启 EXIF 时拼接）
  const filmBrand = content.custom
    || [content.make, content.model].filter(Boolean).join(' ')
    || 'SUPERIA 400'
  const leftSide = [filmBrand.toUpperCase(), frame].filter(Boolean).join('  ▶  ')
  c.save()
  c.translate(pad / 2, canvas.height / 2)
  c.rotate(-Math.PI / 2)
  c.fillText(ellipsize(c, leftSide, sideAvailW), 0, 0)
  c.restore()

  // 右侧竖排：参数行（自定义文字优先，否则参数/型号）
  const rightSide = content.custom
    || content.exifLine
    || content.model
  if (rightSide) {
    c.save()
    c.translate(canvas.width - pad / 2, canvas.height / 2)
    c.rotate(Math.PI / 2)
    c.fillText(ellipsize(c, `◀  ${rightSide}`, sideAvailW), 0, 0)
    c.restore()
  }

  // 右下角日期印字（橙色，仿旧式相机日期背印）
  if (content.date) {
    const dateFont = Math.round(fontPx * 1.1)
    c.font = `400 ${dateFont}px ${f.mono}`
    c.fillStyle = config.textColor
    c.textAlign = 'right'
    c.textBaseline = 'bottom'
    c.fillText(content.date.replace(/-/g, '.'), W + pad - pad * 0.15, H + pad - pad * 0.15)
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
  const content = resolveFrameContent(exif, config, logo)
  const sidePad = Math.round(long * config.padding / 100)
  const topPad = Math.round(sidePad * 0.8)
  const bottomPad = Math.round(sidePad * 3.5)
  const spread = config.shadow ? Math.round(long * SHADOW_BLUR_RATIO * SHADOW_SPREAD_RATIO) : 0

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
  if (content.logo) {
    const wmFontPx = Math.max(10, Math.round(long * config.fontSize / 100 * LOGO_WATERMARK_SCALE))
    const wmPadX = Math.round(W * 0.04)
    const wmPadY = Math.round(H * 0.04)
    const lh = Math.round(wmFontPx * 1.5)
    const lw = Math.round(lh * (content.logo.width / content.logo.height))
    c.save()
    c.globalAlpha = ALPHA_SEMI_TRANSPARENT
    c.drawImage(content.logo, imgLeft + wmPadX, imgTop + H - wmPadY - lh, lw, lh)
    c.restore()
  }

  // 底部边框区域：型号 / 参数，逐行左对齐且限制在卡片内
  const borderInfoFontPx = Math.max(10, Math.round(long * config.fontSize / 100 * BORDER_INFO_FONT_SCALE))
  const borderTextX = cardX + sidePad * 1.2
  const borderAvailW = cardW - sidePad * 1.2 - sidePad
  let borderCurY = imgTop + H + bottomPad * 0.22

  if (content.model) {
    const modelFont = Math.round(borderInfoFontPx * 1.1)
    c.save()
    c.globalAlpha = ALPHA_MEDIUM
    c.fillStyle = config.textColor
    c.textAlign = 'left'
    c.textBaseline = 'top'
    drawFittedText(c, content.model, borderTextX, borderCurY,
      px => `500 ${px}px ${f.display}`, modelFont, borderAvailW)
    c.restore()
    borderCurY += Math.round(modelFont * 1.5)
  }
  if (content.exifLine) {
    c.save()
    c.globalAlpha = 0.5
    c.fillStyle = config.textColor
    c.textAlign = 'left'
    c.textBaseline = 'top'
    drawFittedText(c, content.exifLine, borderTextX, borderCurY,
      px => `400 ${px}px ${f.mono}`, borderInfoFontPx, borderAvailW)
    c.restore()
  }

  // 底部手写签名（保持在白色底边区域，强制约束在卡片内）
  const fontPx = Math.round(ref * config.fontSize / 100)
  const signature = content.custom || content.date
  if (signature) {
    const maxW = cardW - sidePad * 3.6
    const sigY = cardY + topPad + H + bottomPad * 0.55
    // 垂直安全：字号不能超出底边（预留日期小字空间）
    const cardBottom = cardY + cardH - sidePad * 0.6
    const maxFontH = (cardBottom - sigY) * VERTICAL_SAFETY_MARGIN
    const handFont = (px: number) => `400 ${px}px ${f.hand}`
    const actualFontPx = Math.min(
      Math.max(8, Math.floor(maxFontH)),
      fitFontSize(c, signature, handFont, fontPx, maxW, 8),
    )
    c.font = handFont(actualFontPx)
    c.fillStyle = config.textColor
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    c.fillText(signature, borderTextX, sigY, maxW)
  }

  // 右下角日期小字
  if (content.date) {
    const smallFont = Math.round(fontPx * 0.6)
    c.font = `300 ${smallFont}px ${f.ui}`
    c.fillStyle = 'rgba(28,25,23,0.5)'
    c.textAlign = 'right'
    c.fillText(content.date, cardX + cardW - sidePad * 1.2, cardY + cardH - sidePad * 0.8)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 10：小红书 —— 固定 3:4 封面卡片 + 圆角图片 + 标题 + 描述
// 输出画布严格为 3:4，图片在内容框内 contain 或 cover
// ═══════════════════════════════════════════════════════
function renderXhs({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const displayFont = getFontStack(config.fontFamily)
  const content = resolveFrameContent(exif, config, logo)
  const pad = Math.round(long * config.padding / 100)
  const topArea = Math.round(ref * 0.08)
  const bottomArea = content.hasAny ? Math.round(ref * 0.12) : Math.round(ref * 0.04)
  const spread = config.shadow ? Math.round(long * SHADOW_BLUR_RATIO * SHADOW_SPREAD_RATIO) : 0

  // 画布严格 3:4：先定画布宽，再按比例反推画布高（卡片内缩由 drawCard 处理）
  const canvasW = W + pad * 2 + spread * 2
  const canvasH = Math.round(canvasW / XHS_COVER_RATIO)
  // 图片内容框 = 卡片高度 − 卡片内边距 − 顶部标签区 − 底部文案区
  const cardH = canvasH - spread * 2
  const imageBoxW = W
  const imageBoxH = Math.max(1, cardH - pad * 2 - topArea - bottomArea)

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const c = canvas.getContext('2d')!

  // 画布背景
  c.fillStyle = BG_MASK_COLOR
  c.fillRect(0, 0, canvasW, canvasH)

  // 卡片 + 三层阴影
  const { cardX, cardY, cardW: innerCardW } = drawCard(c, canvas, config, long)

  // 顶部小标签（左上）与日期（右上）
  const fontPx = Math.round(ref * config.fontSize / 100)
  c.textBaseline = 'middle'
  c.textAlign = 'left'
  c.fillStyle = withAlpha(config.textColor, 0.4)
  const labelFont = Math.round(fontPx * 0.75)
  const labelY = cardY + topArea / 2
  const labelAvailW = innerCardW - pad * 2.4 - (content.date ? pad * 6 : 0)
  drawFittedText(c, '📕 小红书笔记', cardX + pad * 1.2, labelY,
    px => `400 ${px}px ${f.ui}`, labelFont, Math.max(40, labelAvailW))

  if (content.date) {
    c.textAlign = 'right'
    drawFittedText(c, content.date, cardX + innerCardW - pad * 1.2, labelY,
      px => `400 ${px}px ${f.ui}`, labelFont, Math.max(40, innerCardW * 0.4))
  }

  // 图片（圆角 + contain/cover）
  const imgX = cardX + pad
  const imgY = cardY + topArea
  const fit = fitImageInBox(W, H, imageBoxW, imageBoxH, config.xhsImageFit ?? 'cover')
  const radius = Math.max(0, config.radius - pad * IMAGE_CORNER_REDUCTION)

  c.save()
  roundRect(c, imgX, imgY, imageBoxW, imageBoxH, radius)
  c.clip()
  c.drawImage(
    image,
    fit.source.sx, fit.source.sy, fit.source.sw, fit.source.sh,
    imgX + fit.dest.dx, imgY + fit.dest.dy, fit.dest.dw, fit.dest.dh,
  )
  c.restore()

  // 底部信息区：标题 + 描述 + Logo
  if (!content.hasAny) return canvas

  const bottomY = imgY + imageBoxH
  const titleFont = Math.round(fontPx * 1.2)
  const descFont = Math.round(fontPx * 0.8)
  const title = content.custom || content.model || '无标题'
  const desc = content.exifLine || content.lens

  c.textBaseline = 'middle'
  if (content.logo) {
    // 有 Logo：标题/描述左对齐，Logo 贴右
    const lh = Math.round(ref * config.logoSize / 100 * 0.8)
    const lw = lh * (content.logo.width / content.logo.height)
    const titleAvailW = Math.max(40, innerCardW - pad * 2.4 - lw - pad * 1.2)

    c.textAlign = 'left'
    c.fillStyle = config.textColor
    const titleY = desc ? bottomY + bottomArea * 0.38 : bottomY + bottomArea * 0.5
    drawFittedText(c, title, cardX + pad * 1.2, titleY,
      px => `400 ${px}px ${displayFont}`, titleFont, titleAvailW)

    if (desc) {
      c.fillStyle = withAlpha(config.textColor, ALPHA_SEMI_TRANSPARENT)
      drawFittedText(c, desc, cardX + pad * 1.2, bottomY + bottomArea * 0.68,
        px => `400 ${px}px ${f.ui}`, descFont, titleAvailW)
    }

    c.drawImage(content.logo, cardX + innerCardW - pad * 1.2 - lw,
      bottomY + bottomArea / 2 - lh / 2, lw, lh)
  } else {
    // 无 Logo：标题/描述居中
    const titleAvailW = Math.max(40, innerCardW - pad * 2.4)
    c.textAlign = 'center'
    c.fillStyle = config.textColor
    const titleY = desc ? bottomY + bottomArea * 0.38 : bottomY + bottomArea * 0.5
    drawFittedText(c, title, cardX + innerCardW / 2, titleY,
      px => `400 ${px}px ${displayFont}`, titleFont, titleAvailW)

    if (desc) {
      c.fillStyle = withAlpha(config.textColor, ALPHA_SEMI_TRANSPARENT)
      drawFittedText(c, desc, cardX + innerCardW / 2, bottomY + bottomArea * 0.68,
        px => `400 ${px}px ${f.ui}`, descFont, titleAvailW)
    }
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 11：Vintage 复古纸相框 —— 牛皮纸底 + 做旧边 + 手写签名
// ═══════════════════════════════════════════════════════
function renderVintage(ctx: RenderCtx): HTMLCanvasElement {
  const { image, config, exif, logo } = ctx
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const content = resolveFrameContent(exif, config, logo)
  const pad = Math.round(long * config.padding / 100)

  const canvas = document.createElement('canvas')
  canvas.width = W + pad * 2
  canvas.height = H + pad * 2 + Math.round(ref * BOTTOM_EXTRA_RATIO)
  const c = canvas.getContext('2d')!

  // 牛皮纸底（带渐变 + 纹理）
  c.fillStyle = config.bgColor
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 纹理噪点：使用确定性种子，保证预览与导出颗粒一致
  drawGrain(c, canvas.width, canvas.height, { seed: textureSeed(ctx), ...VINTAGE_GRAIN })

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

  // 底部签名 + 日期（无任何内容时省略）
  if (!content.hasAny) return canvas

  const fontPx = Math.round(ref * config.fontSize / 100)
  const infoY = pad + H + Math.round(ref * 0.03)
  const sig = content.custom || 'Vintage'
  c.fillStyle = config.textColor
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  drawFittedText(c, sig, pad * 1.3, infoY, px => `400 ${px}px ${f.hand}`,
    fontPx, canvas.width - pad * 2.6 - (content.date ? canvas.width * 0.3 : 0))

  // 右下日期
  if (content.date) {
    c.textAlign = 'right'
    c.fillStyle = config.textColor
    c.font = `300 ${Math.round(fontPx * 0.8)}px ${f.ui}`
    c.fillText(content.date, canvas.width - pad * 1.3, infoY)
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 12：Magazine 杂志封面 —— 顶部大标题 + 底部 caption + 细线分隔
// ═══════════════════════════════════════════════════════
function renderMagazine({ image, exif, config, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width, H = image.height, long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const ref = sizeRef(W, H)
  const displayFont = getFontStack(config.fontFamily)
  const content = resolveFrameContent(exif, config, logo)
  // 无文案时收起信息栏，只输出图片
  const topBar = content.hasAny ? Math.round(ref * 0.08) : 0
  const bottomBar = content.hasAny ? Math.round(ref * 0.1) : 0

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H + topBar + bottomBar
  const c = canvas.getContext('2d')!

  c.fillStyle = config.bgColor
  c.fillRect(0, 0, canvas.width, canvas.height)

  // 图片居中
  c.drawImage(image, 0, topBar, W, H)

  if (!content.hasAny) return canvas

  const fontPx = Math.round(ref * config.fontSize / 100)
  const padX = Math.round(W * 0.04)

  // ── 顶部：可编辑刊名（默认 PHOTO ZINE）+ 期号 ──
  const masthead = (config.magazineName || 'PHOTO ZINE').trim()
  const [mastheadMain, ...mastheadRest] = masthead.split(/\s+/)
  const mastheadSub = mastheadRest.join(' ')
  const mastheadFont = Math.round(fontPx * 1.8)
  const mastheadMainFont = `400 ${mastheadFont}px ${displayFont}`
  const mastheadSubFont = `300 ${mastheadFont}px ${displayFont}`

  c.textBaseline = 'middle'
  c.textAlign = 'left'
  c.fillStyle = config.textColor
  c.font = mastheadMainFont
  const mastheadMainW = c.measureText(mastheadMain).width
  let mastheadW = mastheadMainW
  if (mastheadSub) {
    c.font = mastheadSubFont
    mastheadW += fontPx * 0.4 + c.measureText(mastheadSub).width
  }

  c.font = mastheadMainFont
  c.fillText(mastheadMain, padX, topBar / 2 - fontPx * 0.25)
  if (mastheadSub) {
    c.font = mastheadSubFont
    c.fillText(mastheadSub, padX + mastheadMainW + fontPx * 0.4, topBar / 2 - fontPx * 0.25)
  }

  // 右上：期号 + 日期（刊名占宽过大时自动缩小）
  c.textAlign = 'right'
  c.fillStyle = withAlpha('#1c1917', ALPHA_SEMI_TRANSPARENT)
  const issueNo = config.magazineIssue?.trim()
    || (content.date ? content.date.replace(/\D/g, '').slice(-4) : '')
    || '001'
  const issue = [`ISSUE ${issueNo}`, content.date].filter(Boolean).join('  ·  ')
  drawFittedText(c, issue, W - padX, topBar / 2 - fontPx * 0.25,
    px => `400 ${px}px ${f.mono}`, Math.round(fontPx * 0.65),
    Math.max(40, W - padX * 3 - mastheadW))

  // 顶部分隔线
  c.strokeStyle = 'rgba(28,25,23,0.15)'
  c.lineWidth = 1
  c.beginPath()
  c.moveTo(padX, topBar - 1)
  c.lineTo(W - padX, topBar - 1)
  c.stroke()

  // ── 底部 caption ──
  const bottomY = topBar + H
  c.beginPath()
  c.moveTo(padX, bottomY + 1)
  c.lineTo(W - padX, bottomY + 1)
  c.stroke()

  const title = content.custom || content.model || 'Untitled'
  const desc = content.exifLine || content.lens
  const pageLabel = '— 01 / 01 —'

  c.textAlign = 'right'
  c.fillStyle = 'rgba(28,25,23,0.5)'
  c.font = `400 ${Math.round(fontPx * 0.7)}px ${f.mono}`
  const pageW = c.measureText(pageLabel).width

  c.textAlign = 'left'
  c.fillStyle = config.textColor
  const captionAvailW = Math.max(40, W - padX * 2.4 - pageW - padX)
  drawFittedText(c, title, padX, bottomY + bottomBar * 0.4,
    px => `400 ${px}px ${displayFont}`, Math.round(fontPx * 0.95), captionAvailW)

  if (desc) {
    c.fillStyle = 'rgba(28,25,23,0.55)'
    drawFittedText(c, desc, padX, bottomY + bottomBar * 0.7,
      px => `300 ${px}px ${f.ui}`, Math.round(fontPx * 0.7), captionAvailW)
  }

  // 右下：页码
  c.textAlign = 'right'
  c.fillStyle = 'rgba(28,25,23,0.5)'
  c.font = `400 ${Math.round(fontPx * 0.7)}px ${f.mono}`
  c.fillText(pageLabel, W - padX, bottomY + bottomBar * 0.55)

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
  const content = resolveFrameContent(exif, config, logo)

  // 地点名：配置优先，否则回退到自定义文字
  const locationName = config.locationName?.trim()
    || (content.hasCustom ? content.custom : '')

  // 无任何可展示内容且开启 hideEmptyExif：回退为纯图片
  if (content.shouldHideInfo) return renderPlainImage(image)

  const barH = Math.round(ref * EXIF_BAR_HEIGHT_RATIO)

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
  const hasLeftContent = !!(content.model || content.lens)
  const hasRightContent = !!(locationName || content.date)
  const titleFont = Math.round(fontPx * TITLE_FONT_SCALE)
  const subFont = Math.round(fontPx * 0.75)
  const locationFont = Math.round(fontPx)

  // ── 左侧：Logo + 型号 + 镜头 ──
  let leftX = padX
  const logoH = content.logo ? Math.round(ref * config.logoSize / 100) : 0
  const logoW = content.logo ? logoH * (content.logo.width / content.logo.height) : 0
  if (content.logo) {
    c.drawImage(content.logo, leftX, centerY - logoH / 2, logoW, logoH)
    leftX += logoW + padX * 0.6
  }

  c.textBaseline = 'middle'

  // 右侧（地点 + 日期）宽度决定左侧可用区域
  const rightTexts = [
    { text: locationName ? `📍 ${locationName}` : '', font: locationFont, family: displayFont },
    { text: content.date, font: subFont, family: f.mono },
  ]
  let rightAreaW = 0
  for (const item of rightTexts) {
    if (!item.text) continue
    c.font = `400 ${item.font}px ${item.family}`
    rightAreaW = Math.max(rightAreaW, c.measureText(item.text).width)
  }

  // ── 左侧文字布局 ──
  const hasLogo = !!content.logo
  const leftAreaStart = hasLogo ? leftX : padX
  let leftAlign: CanvasTextAlign = 'left'
  let leftAreaEnd = W - padX
  if (hasRightContent) {
    leftAreaEnd = W - padX - rightAreaW - padX * 1.5
    if (!hasLogo && leftAreaEnd > padX) leftAlign = 'center'
  } else if (!hasLogo) {
    leftAlign = 'center'
  }
  const leftCenterX = leftAreaEnd > leftAreaStart
    ? (leftAreaStart + leftAreaEnd) / 2
    : leftAreaStart
  const leftAnchorX = leftAlign === 'center' ? leftCenterX : leftAreaStart
  const leftAvailW = Math.max(40, leftAreaEnd - leftAreaStart)

  if (hasLeftContent) {
    c.textAlign = leftAlign
    if (content.model) {
      c.fillStyle = config.textColor
      drawFittedText(c, content.model, leftAnchorX, centerY - fontPx * 0.45,
        px => `400 ${px}px ${displayFont}`, titleFont, leftAvailW)
    }
    const subline = content.lens || content.exifLine
    if (subline) {
      c.fillStyle = withAlpha(config.textColor, ALPHA_SEMI_TRANSPARENT)
      drawFittedText(c, subline, leftAnchorX, centerY + fontPx * 0.55,
        px => `400 ${px}px ${f.ui}`, subFont, leftAvailW)
    }
  }

  // ── 右侧：地点 + 日期 ──
  if (hasRightContent) {
    c.textAlign = 'right'
    const rightAvailW = Math.max(40, W - padX * 2 - leftAreaStart + padX)
    if (locationName) {
      c.fillStyle = config.textColor
      drawFittedText(c, `📍 ${locationName}`, W - padX, centerY - fontPx * 0.45,
        px => `400 ${px}px ${displayFont}`, locationFont, rightAvailW)
    }
    if (content.date) {
      c.fillStyle = withAlpha(config.textColor, ALPHA_SEMI_TRANSPARENT)
      drawFittedText(c, content.date, W - padX, centerY + fontPx * 0.55,
        px => `400 ${px}px ${f.mono}`, subFont, rightAvailW)
    }
  }

  return canvas
}

// ═══════════════════════════════════════════════════════
// 模板 14：光影（light-shadow）—— 参考「光影边框」App
// 底部纯黑薄条 + 单行居中 EXIF（空格分隔，无 Logo，无 label）
// 顶部边缘带向上渐变雾化，让黑条与照片"融"在一起
// ═══════════════════════════════════════════════════════
function renderLightShadow({ image, config, exif, logo }: RenderCtx): HTMLCanvasElement {
  const W = image.width
  const H = image.height
  const content = resolveFrameContent(exif, config, logo)
  // 无任何可展示内容且开启 hideEmptyExif：回退为纯图片
  if (content.shouldHideInfo) return renderPlainImage(image)

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

  // 单行内容：品牌块（品牌 + 型号）+ 参数块，多空格用于分组
  const brandBlock = [content.make, content.model].filter(Boolean).join(' ')
  const paramBlock = content.params.map(p => p.value.replace('f/', 'F')).join(' ')

  let line = ''
  if (content.hasCustom) {
    line = content.custom
  } else if (brandBlock || paramBlock) {
    line = [brandBlock, paramBlock].filter(Boolean).join('  ')
  } else if (content.date) {
    line = content.date
  }

  if (!line) return canvas // 无内容时只保留黑条

  // 字号：基于图片长边 1%（参考值），根据文本总宽度自适应缩小
  const long = Math.max(W, H)
  const f = makeFontCtx(config, long)
  const basePx = Math.max(10, Math.round(long * config.fontSize / 100 * 0.8))
  c.fillStyle = config.textColor // 默认 #ffffff
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  drawFittedText(c, line, W / 2, H + barH / 2,
    px => `300 ${px}px ${f.mono}`, basePx, W * 0.95)

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
  const content = resolveFrameContent(exif, config, logo)

  // 边距：图片四周 + 底部信息区（无文案时收起信息区）
  const pad = Math.max(Math.round(long * 0.02), Math.round(long * config.padding / 100))
  const infoGap = content.hasAny ? Math.round(long * 0.025) : 0 // 图片与信息区间距
  const infoH = content.hasAny ? Math.round(long * 0.12) : 0    // 信息区高度

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
    c.shadowColor = withAlpha(SHADOW_HEX, IMAGE_SHADOW_ALPHA)
    c.shadowBlur = long * IMAGE_SHADOW_BLUR_RATIO
    c.shadowOffsetX = 0
    c.shadowOffsetY = long * IMAGE_SHADOW_OFFSET_RATIO
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

  if (!content.hasAny) return canvas

  // 信息区（居中，垂直排列）
  const fontPx = Math.round(long * config.fontSize / 100)
  const centerX = canvas.width / 2
  const maxTextW = canvas.width - pad * 2
  let curY = pad + H + infoGap

  // 行 1：品牌 Logo + 标题
  const title = content.custom || content.model
  if (title) {
    const titleFont = Math.round(fontPx * 1.1)
    const titleFontStr = (px: number) => `500 ${px}px ${f.display}`
    c.font = titleFontStr(titleFont)
    const fittedTitleFont = fitFontSize(c, title, titleFontStr, titleFont, maxTextW)
    c.font = titleFontStr(fittedTitleFont)
    const titleW = c.measureText(title).width
    const logoH = content.logo ? Math.round(fontPx * 1.4) : 0
    const logoW = content.logo ? logoH * (content.logo.width / content.logo.height) : 0
    const logoGap = content.logo ? fontPx * 0.5 : 0
    const totalW = logoW + logoGap + titleW
    const startX = centerX - totalW / 2

    if (content.logo) {
      c.drawImage(content.logo, startX, curY + (titleFont - logoH) / 2, logoW, logoH)
    }
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    c.fillStyle = config.textColor
    c.fillText(title, startX + logoW + logoGap, curY + titleFont / 2)
    curY += fontPx * 1.8
  }

  // 行 2：拍摄参数（等宽字体）
  const paramLine = content.params.map(p => p.value).join('  ·  ')
  if (paramLine) {
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillStyle = config.textColor
    drawFittedText(c, paramLine, centerX, curY + fontPx * 0.45,
      px => `400 ${px}px ${f.mono}`, Math.round(fontPx * 0.85), maxTextW)
    curY += fontPx * 1.4
  }

  // 行 3：日期（较小、次级颜色）
  if (content.date) {
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillStyle = withAlpha(config.textColor, ALPHA_SEMI_TRANSPARENT)
    drawFittedText(c, content.date, centerX, curY + fontPx * 0.35,
      px => `300 ${px}px ${f.ui}`, Math.round(fontPx * 0.75), maxTextW)
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
  const content = resolveFrameContent(exif, config, logo)
  const border = Math.round(long * (config.borderPadding ?? 4) / 100)
  // 底部额外空间：无文案时不预留
  const bottomExtra = content.hasAny ? Math.round(sizeRef(W, H) * BOTTOM_EXTRA_RATIO) : 0

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

  if (!content.hasAny) return canvas

  // 3) 底部信息区：左栏标题，右栏参数 + 日期
  const infoY = border + H + Math.round(border * 0.6)
  const fontPx = Math.round(long * config.fontSize / 100)
  const title = content.custom || content.model
  const logoH = content.logo ? Math.round(fontPx * 1.4) : 0
  const logoW = content.logo ? logoH * (content.logo.width / content.logo.height) : 0
  const logoGap = content.logo ? fontPx * 0.6 : 0

  // 右栏宽度决定左栏可用空间
  const paramLine = content.params.map(p => p.value).join('  ·  ')
  const paramFont = Math.round(fontPx * SUBTITLE_FONT_SCALE)
  const dateFont = Math.round(fontPx * 0.7)
  const rightTexts = [
    { text: paramLine, font: paramFont, family: f.mono },
    { text: content.date, font: dateFont, family: f.ui },
  ]
  let rightW = 0
  for (const item of rightTexts) {
    if (!item.text) continue
    c.font = `400 ${item.font}px ${item.family}`
    rightW = Math.max(rightW, c.measureText(item.text).width)
  }

  let leftX = border
  if (content.logo) {
    c.drawImage(content.logo, leftX, infoY + (fontPx * 1.2 - logoH) / 2, logoW, logoH)
    leftX += logoW + logoGap
  }
  if (title) {
    const titleFont = Math.round(fontPx * 1.05)
    const titleAvailW = Math.max(40,
      canvas.width - border * 2 - (leftX - border) - rightW - fontPx * 1.5)
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    c.fillStyle = config.textColor
    drawFittedText(c, title, leftX, infoY + fontPx * 0.6,
      px => `500 ${px}px ${f.display}`, titleFont, titleAvailW)
  }

  // 右栏：参数 + 日期
  const rightX = border + W
  // 右栏最多占底栏宽度的 62%，左栏已按 rightW 预留空间
  const rightAvailW = Math.max(40, W * 0.62)
  c.textAlign = 'right'
  c.textBaseline = 'middle'
  if (paramLine) {
    c.fillStyle = config.textColor
    drawFittedText(c, paramLine, rightX, infoY + fontPx * 0.45,
      px => `400 ${px}px ${f.mono}`, paramFont, rightAvailW)
  }
  if (content.date) {
    c.fillStyle = withAlpha(config.textColor, ALPHA_SEMI_TRANSPARENT)
    drawFittedText(c, content.date, rightX, infoY + fontPx * 1.35,
      px => `300 ${px}px ${f.ui}`, dateFont, rightAvailW)
  }

  return canvas
}

/**
 * 参数中文标签 → 启动窗英文标签。
 * 必须按标签查表，不能按下标取：content.params 只包含实际存在的项，
 * 缺失任一字段时按下标取会让后续标签整体错位。
 */
const EXIF_DETAIL_LABELS: Record<string, string> = {
  焦距: 'Focal Length',
  光圈: 'Aperture',
  快门: 'Shutter',
  ISO: 'ISO',
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
  const content = resolveFrameContent(exif, config, logo)

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

  // 2) 亚克力噪点层（isAcrylic 模式）——确定性种子，保证预览与导出一致
  if (config.isAcrylic) {
    c.fillStyle = 'rgba(255, 255, 255, 0.08)'
    c.fillRect(0, 0, side, side)
    drawGrain(c, side, side, { seed: textureSeed(ctx), ...ACRYLIC_GRAIN, colors: ['#000', '#000'] })
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
  if (content.logo) {
    const logoSize = Math.round(logoBoxSize * 0.6)
    const logoDrawW = logoSize * (content.logo.width / content.logo.height)
    c.save()
    c.shadowColor = opts.accentColor
    c.shadowBlur = basePx * 0.5
    c.drawImage(
      content.logo,
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

  // 型号（大字）：自定义文字优先，否则型号，再次产品名
  const modelY = outerPad + logoBoxSize + basePx * 1.8
  const panelTextW = leftPanelW * 0.9
  c.fillStyle = config.textColor
  c.textAlign = 'left'
  c.textBaseline = 'top'
  const modelText = content.custom || content.model || opts.productName
  drawFittedText(c, modelText, leftX, modelY,
    px => `600 ${px}px ${f.display}`, Math.round(basePx * 1.4), panelTextW)

  // 分隔线
  const dividerY = modelY + basePx * 2.2
  c.strokeStyle = 'rgba(28, 25, 23, 0.08)'
  c.lineWidth = 1
  c.beginPath()
  c.moveTo(leftX, dividerY)
  c.lineTo(leftX + leftPanelW * 0.9, dividerY)
  c.stroke()

  // EXIF 详情列表（受 showExif / showLogo 控制）
  const detailStartY = dividerY + basePx * 1.2
  const detailLineH = basePx * 1.5
  const detailFontPx = Math.round(basePx * 0.85)

  const details: Array<[string, string]> = []
  const cameraLabel = [content.make, content.model].filter(Boolean).join(' ')
  if (cameraLabel) details.push(['Camera', cameraLabel])
  for (const p of content.params) {
    details.push([EXIF_DETAIL_LABELS[p.label] ?? p.label, p.value])
  }
  if (content.date) details.push(['Date', content.date])

  details.forEach(([label, value], i) => {
    const y = detailStartY + i * detailLineH
    c.fillStyle = withAlpha(config.textColor, ALPHA_SEMI_TRANSPARENT)
    c.font = `400 ${detailFontPx}px ${f.ui}`
    c.fillText(label, leftX, y)
    c.fillStyle = config.textColor
    drawFittedText(c, value, leftX + basePx * 8, y,
      px => `500 ${px}px ${f.mono}`, detailFontPx, Math.max(40, leftPanelW * 0.9 - basePx * 8))
  })

  // 版权 + 网站（底部）
  const footerY = side - outerPad - basePx * 2.8
  c.fillStyle = withAlpha(config.textColor, 0.5)
  const copyright = config.copyright ?? '© Framelet. All rights reserved.'
  drawFittedText(c, copyright, leftX, footerY,
    px => `300 ${px}px ${f.ui}`, Math.round(basePx * 0.7), leftPanelW * 0.95)
  const website = config.website ?? ''
  if (website) {
    c.fillStyle = opts.accentColor
    drawFittedText(c, website, leftX, footerY + basePx * 1.1,
      px => `300 ${px}px ${f.ui}`, Math.round(basePx * 0.7), leftPanelW * 0.95)
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

  const customText = resolveCustomText(config.customText, '', exif, config)

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
  const text = resolveCustomText(config.watermarkText || config.customText, 'Framelet', exif, config)

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
