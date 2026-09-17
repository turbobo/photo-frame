// 渲染通用工具 —— 文字适配、可复现纹理、画幅策略
//
// 提取自 canvas.ts 中重复出现的排版逻辑，供 21 个渲染器共享。

// ═══════════════════════════════════════════════════════
// 文字测量与适配
// ═══════════════════════════════════════════════════════

/**
 * 单行文字自适应：文本超出可用宽度时按比例缩小字号。
 * 返回最终字号，调用方需用返回值重新设置 c.font 后再绘制。
 */
export function fitFontSize(
  c: CanvasRenderingContext2D,
  text: string,
  fontTemplate: (px: number) => string,
  basePx: number,
  availW: number,
  minPx = 8,
): number {
  if (!text) return basePx
  c.font = fontTemplate(basePx)
  const w = c.measureText(text).width
  if (w <= availW || w === 0) return basePx
  const scaled = Math.floor(basePx * (availW / w) * 0.98)
  return Math.max(minPx, scaled)
}

/**
 * 单行文字截断：超过可用宽度时截断并追加省略号。
 * 用于日期、地点等「不宣缩小字号」的次要信息。
 */
export function ellipsize(
  c: CanvasRenderingContext2D,
  text: string,
  availW: number,
): string {
  if (!text) return ''
  if (c.measureText(text).width <= availW) return text
  const ellipsis = '…'
  const ellipsisW = c.measureText(ellipsis).width
  let result = ''
  for (const ch of text) {
    if (c.measureText(result + ch).width + ellipsisW > availW) break
    result += ch
  }
  return result ? result + ellipsis : ellipsis
}

/**
 * 绘制自适应单行文字，返回实际使用字号。
 * align 决定 x 的语义（与 canvas textAlign 一致）。
 */
export function drawFittedText(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontTemplate: (px: number) => string,
  basePx: number,
  availW: number,
  minPx = 8,
): number {
  const px = fitFontSize(c, text, fontTemplate, basePx, availW, minPx)
  c.font = fontTemplate(px)
  c.fillText(text, x, y)
  return px
}

// ═══════════════════════════════════════════════════════
// 可复现纹理
// ═══════════════════════════════════════════════════════

/**
 * 稳定字符串哈希（FNV-1a 变体），用于把「文件名 + 模板 + 配置」映射为种子。
 * 同一张照片 + 同一配置必须得到相同种子，否则预览与导出会出现颗粒差异。
 */
export function hashSeed(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** 由种子创建的确定性伪随机数生成器（mulberry32） */
export function createSeededRandom(seed: number): () => number {
  let state = seed || 1
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 纹理颗粒绘制：用确定性随机数在画布上撒点。
 * 复用同一 seed 时多次渲染结果完全一致。
 */
export function drawGrain(
  c: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: {
    seed: number
    step?: number
    density?: number
    size?: number
    alpha?: number
    colors?: [string, string]
  },
): void {
  const {
    seed,
    step = 9,
    density = 0.4,
    size = 3,
    alpha = 0.08,
    colors = ['#000', '#fff'],
  } = options
  const random = createSeededRandom(seed)
  c.save()
  c.globalAlpha = alpha
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (random() < density) {
        c.fillStyle = random() > 0.5 ? colors[0] : colors[1]
        c.fillRect(x, y, size, size)
      }
    }
  }
  c.restore()
}

// ═══════════════════════════════════════════════════════
// 画幅策略
// ═══════════════════════════════════════════════════════

/** 图片按 cover 方式居中裁切到目标宽高比所需的源矩形 */
export function coverSourceRect(
  srcW: number,
  srcH: number,
  targetRatio: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const srcRatio = srcW / srcH
  if (srcRatio > targetRatio) {
    const sw = Math.round(srcH * targetRatio)
    return { sx: Math.round((srcW - sw) / 2), sy: 0, sw, sh: srcH }
  }
  const sh = Math.round(srcW / targetRatio)
  return { sx: 0, sy: Math.round((srcH - sh) / 2), sw: srcW, sh }
}

export interface BoxFitResult {
  /** 源图裁切区域 */
  source: { sx: number; sy: number; sw: number; sh: number }
  /** 目标绘制区域 */
  dest: { dx: number; dy: number; dw: number; dh: number }
}

/**
 * 把源图放入固定尺寸的内容框：
 * - contain：整图完整保留，短边留白
 * - cover：  等比放大后居中裁切，填满内容框
 */
export function fitImageInBox(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number,
  mode: 'contain' | 'cover' = 'contain',
): BoxFitResult {
  if (mode === 'cover') {
    const boxRatio = boxW / boxH
    const source = coverSourceRect(srcW, srcH, boxRatio)
    return { source, dest: { dx: 0, dy: 0, dw: boxW, dh: boxH } }
  }

  const scale = Math.min(boxW / srcW, boxH / srcH)
  const dw = Math.round(srcW * scale)
  const dh = Math.round(srcH * scale)
  return {
    source: { sx: 0, sy: 0, sw: srcW, sh: srcH },
    dest: {
      dx: Math.round((boxW - dw) / 2),
      dy: Math.round((boxH - dh) / 2),
      dw,
      dh,
    },
  }
}
