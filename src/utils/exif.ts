// EXIF / RAW 解析工具
// 支持格式: JPG/PNG/HEIC + 主流 RAW (CR2/CR3/NEF/ARW/RAF/RW2/ORF/DNG/PEF)
// 策略：exifr 一次性提取 EXIF 元数据 + 内嵌 JPEG 预览图

import type { ExifData } from '../types'
// 静态导入 exifr：避免 EdgeOne 部署下 dynamic import chunk fetch 失败
// 代价：增加主 bundle ~75KB (gzipped ~26KB)，换取 100% 加载可靠性
import * as exifr from 'exifr'

/** RAW 后缀白名单 */
const RAW_EXTENSIONS = ['cr2', 'cr3', 'nef', 'arw', 'sr2', 'raf', 'rw2', 'orf', 'pef', 'dng', 'rwl']

/** 判断文件是否为 RAW */
export function isRawFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return !!ext && RAW_EXTENSIONS.includes(ext)
}

/** 判断是否为浏览器可原生渲染的图像 */
export function isNativeImage(file: File): boolean {
  return /^image\/(jpeg|jpg|png|webp|avif|gif)$/i.test(file.type)
}

/** 从 File 创建 HTMLImageElement */
async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // 保留 URL 直到 image 使用完（组件卸载时释放）
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图像加载失败'))
    }
    img.src = url
  })
}

/**
 * 从任意支持格式的 File 提取 HTMLImageElement
 * - RAW / HEIC → 提取内嵌 JPEG 预览
 * - JPG/PNG/WEBP → 直接加载
 */
export async function loadImage(file: File): Promise<HTMLImageElement> {
  if (isNativeImage(file)) {
    return loadImageFromBlob(file)
  }

  // RAW / HEIC / 其他 → 尝试提取内嵌预览
  try {
    const buf = await exifr.thumbnail(file)
    if (buf) {
      const blob = new Blob([buf as ArrayBuffer], { type: 'image/jpeg' })
      return loadImageFromBlob(blob)
    }
  } catch (e) {
    console.warn('exifr thumbnail failed:', e)
  }

  // fallback: 让浏览器尝试原生渲染
  return loadImageFromBlob(file)
}

/** 提取 EXIF 元数据 */
export async function extractExif(file: File): Promise<ExifData> {
  try {
    const meta = await exifr.parse(file, {
      pick: [
        'Make', 'Model', 'LensModel', 'LensMake',
        'FNumber', 'ExposureTime', 'ISO', 'FocalLength',
        'DateTimeOriginal', 'CreateDate', 'DateTime',
        'GPSLatitude', 'GPSLongitude',
        'ExifImageWidth', 'ExifImageHeight',
      ],
      gps: true,
    })

    if (!meta) return {}

    // 快门格式：ExposureTime 是浮点，如 0.004 → "1/250"
    let exposureTime: string | undefined
    if (typeof meta.ExposureTime === 'number') {
      if (meta.ExposureTime >= 1) {
        exposureTime = `${meta.ExposureTime}s`
      } else {
        const denom = Math.round(1 / meta.ExposureTime)
        exposureTime = `1/${denom}`
      }
    }

    // 日期格式化
    let dateTaken: string | undefined
    const rawDate = meta.DateTimeOriginal || meta.CreateDate || meta.DateTime
    if (rawDate) {
      const d = rawDate instanceof Date ? rawDate : new Date(rawDate)
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        dateTaken = `${y}-${m}-${day}`
      }
    }

    // 镜头信息处理（Sony/Canon 常包含制造商前缀）
    let lens: string | undefined = meta.LensModel
    if (lens && meta.LensMake && !lens.toLowerCase().includes(meta.LensMake.toLowerCase())) {
      // 保持原样
    }

    // GPS
    let gps: { lat: number; lng: number } | undefined
    if (typeof meta.latitude === 'number' && typeof meta.longitude === 'number') {
      gps = { lat: meta.latitude, lng: meta.longitude }
    }

    return {
      make: meta.Make?.trim(),
      model: meta.Model?.trim(),
      lens: lens?.trim(),
      fNumber: typeof meta.FNumber === 'number' ? meta.FNumber : undefined,
      exposureTime,
      iso: typeof meta.ISO === 'number' ? meta.ISO : undefined,
      focalLength: typeof meta.FocalLength === 'number' ? meta.FocalLength : undefined,
      dateTaken,
      gps,
      width: meta.ExifImageWidth,
      height: meta.ExifImageHeight,
    }
  } catch (e) {
    console.warn('extractExif failed:', e)
    return {}
  }
}
