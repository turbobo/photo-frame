import { Zip, ZipPassThrough } from 'fflate'
import type { TemplateConfig } from '../types'
import { loadImage, extractExif } from './exif'
import { getLogoPath, loadLogo } from './logos'
import { renderFrame } from './canvas'

export interface BatchExportParams {
  files: File[]
  config: TemplateConfig
  format: 'jpeg' | 'png' | 'webp'
  quality: number
  longEdge: number
  onProgress: (p: BatchProgress) => void
  signal: AbortSignal
}

export interface BatchProgress {
  current: number
  total: number
  currentName: string
  completedCount: number
  failedCount: number
  startedAt: number
}

export interface BatchResult {
  completedCount: number
  failedCount: number
  failures: Array<{ name: string; reason: string }>
}

const MIME_MAP: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export function detectDeviceLimit(): number {
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) return 20

  const mem = (navigator as any).deviceMemory as number | undefined
  if (mem !== undefined && mem < 2) return 20

  const isAndroid = /Android/.test(ua)
  if (isAndroid || (mem !== undefined && mem < 4)) return 30

  return 50
}

async function renderOnePhoto(
  file: File,
  config: TemplateConfig,
  format: string,
  quality: number,
  longEdge: number,
): Promise<Blob> {
  const [image, exif] = await Promise.all([loadImage(file), extractExif(file)])

  let logo: HTMLImageElement | null = null
  const logoPath = getLogoPath(exif.make)
  if (logoPath) {
    try { logo = await loadLogo(logoPath) } catch { /* ignore */ }
  }

  const source = renderFrame({ image, exif, logo, config })

  let target = source
  if (longEdge > 0 && Math.max(source.width, source.height) > longEdge) {
    const s = longEdge / Math.max(source.width, source.height)
    const c = document.createElement('canvas')
    c.width = Math.round(source.width * s)
    c.height = Math.round(source.height * s)
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, c.width, c.height)
    source.width = 0
    source.height = 0
    target = c
  }

  const mime = MIME_MAP[format] || 'image/jpeg'
  const blob = await new Promise<Blob>((resolve, reject) => {
    target.toBlob(
      b => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      mime,
      quality,
    )
  })

  target.width = 0
  target.height = 0
  URL.revokeObjectURL(image.src)

  return blob
}

export async function runBatchExport(params: BatchExportParams): Promise<BatchResult> {
  const { files, config, format, quality, longEdge, onProgress, signal } = params

  await document.fonts.ready

  const ext = format === 'jpeg' ? 'jpg' : format
  const templateId = config.id

  let completedCount = 0
  let failedCount = 0
  const failures: Array<{ name: string; reason: string }> = []
  const startedAt = Date.now()

  const chunks: Uint8Array[] = []
  const zip = new Zip((err, data, final) => {
    if (err) throw err
    chunks.push(data)
  })

  for (let i = 0; i < files.length; i++) {
    if (signal.aborted) break

    const file = files[i]
    onProgress({
      current: i + 1,
      total: files.length,
      currentName: file.name,
      completedCount,
      failedCount,
      startedAt,
    })

    try {
      const blob = await renderOnePhoto(file, config, format, quality, longEdge)
      const arrayBuf = await blob.arrayBuffer()
      const data = new Uint8Array(arrayBuf)

      const baseName = file.name.replace(/\.[^.]+$/, '')
      const fileName = `${baseName}-${templateId}.${ext}`

      const entry = new ZipPassThrough(fileName)
      zip.add(entry)
      entry.push(data, true)

      completedCount++
    } catch (e: any) {
      failedCount++
      failures.push({ name: file.name, reason: e?.message || String(e) })
    }
  }

  zip.end()

  if (completedCount > 0) {
    const totalSize = chunks.reduce((s, c) => s + c.length, 0)
    const merged = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    const now = new Date()
    const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('')
    const zipName = `framelet-batch-${ts}.zip`

    const zipBlob = new Blob([merged], { type: 'application/zip' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = zipName
    a.style.display = 'none'
    document.body.appendChild(a)
    a.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }))
    setTimeout(() => {
      try { document.body.removeChild(a) } catch {}
      URL.revokeObjectURL(url)
    }, 100)
  }

  return { completedCount, failedCount, failures }
}
