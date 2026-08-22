import { Zip, ZipPassThrough } from 'fflate'
import type { TemplateConfig } from '../types'
import { loadImage, extractExif, validateImageFile } from './exif'
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
  cancelled: boolean
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

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (mem !== undefined && mem < 2) return 20

  const isAndroid = /Android/.test(ua)
  if (isAndroid || (mem !== undefined && mem < 4)) return 30

  return 50
}

async function renderOnePhoto(
  file: File,
  config: TemplateConfig,
  format: BatchExportParams['format'],
  quality: number,
  longEdge: number,
): Promise<Blob> {
  validateImageFile(file)
  const [image, exif] = await Promise.all([loadImage(file), extractExif(file)])
  let source: HTMLCanvasElement | null = null
  let target: HTMLCanvasElement | null = null

  try {
    let logo: HTMLImageElement | null = null
    const logoPath = getLogoPath(exif.make)
    if (logoPath) {
      try { logo = await loadLogo(logoPath) } catch { /* 无 Logo 时继续导出 */ }
    }

    source = renderFrame({ image, exif, logo, config })
    target = source
    if (longEdge > 0 && Math.max(source.width, source.height) > longEdge) {
      const scale = longEdge / Math.max(source.width, source.height)
      const resizedCanvas = document.createElement('canvas')
      resizedCanvas.width = Math.round(source.width * scale)
      resizedCanvas.height = Math.round(source.height * scale)
      const context = resizedCanvas.getContext('2d')
      if (!context) throw new Error('无法创建 Canvas 上下文')
      context.imageSmoothingQuality = 'high'
      context.drawImage(source, 0, 0, resizedCanvas.width, resizedCanvas.height)
      target = resizedCanvas
    }

    const mime = MIME_MAP[format] || 'image/jpeg'
    return await new Promise<Blob>((resolve, reject) => {
      target!.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('图片编码失败'))),
        mime,
        quality,
      )
    })
  } finally {
    if (target && target !== source) {
      target.width = 0
      target.height = 0
    }
    if (source) {
      source.width = 0
      source.height = 0
    }
  }
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
  const zipCompleted = new Promise<void>((resolve, reject) => {
    const zip = new Zip((error, data, final) => {
      if (error) {
        reject(error)
        return
      }
      chunks.push(data)
      if (final) resolve()
    })

    processFiles(zip).catch(reject)
  })

  async function processFiles(zip: Zip): Promise<void> {
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
        const data = new Uint8Array(await blob.arrayBuffer())
        const baseName = file.name.replace(/\.[^.]+$/, '')
        const fileName = `${baseName}-${templateId}-${i + 1}.${ext}`

        const entry = new ZipPassThrough(fileName)
        zip.add(entry)
        entry.push(data, true)
        completedCount++
      } catch (error: unknown) {
        failedCount++
        failures.push({
          name: file.name,
          reason: error instanceof Error ? error.message : String(error),
        })
      }

      if (!signal.aborted) {
        onProgress({
          current: i + 1,
          total: files.length,
          currentName: file.name,
          completedCount,
          failedCount,
          startedAt,
        })
      }
    }

    zip.end()
  }

  await zipCompleted

  if (!signal.aborted && completedCount > 0) {
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

    const zipBlob = new Blob(chunks, { type: 'application/zip' })
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

  return { completedCount, failedCount, failures, cancelled: signal.aborted }
}
