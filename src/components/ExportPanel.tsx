import { useState } from 'react'
import type { PhotoData, TemplateConfig } from '../types'
import { renderFrame } from '../utils/canvas'

interface Props {
  photo: PhotoData | null
  config: TemplateConfig
  logo: HTMLImageElement | null
}

const SIZE_OPTIONS = [
  { key: 'orig', label: '原图', longEdge: 0 },
  { key: '3840', label: '4K', longEdge: 3840 },
  { key: '2048', label: '2K', longEdge: 2048 },
  { key: '1080', label: '社交', longEdge: 1080 },
]
const FORMATS = [
  { key: 'jpeg', label: 'JPG', mime: 'image/jpeg' },
  { key: 'png',  label: 'PNG', mime: 'image/png' },
  { key: 'webp', label: 'WebP', mime: 'image/webp' },
]

export default function ExportPanel({ photo, config, logo }: Props) {
  const [size, setSize] = useState(SIZE_OPTIONS[0].key)
  const [format, setFormat] = useState('jpeg')
  const [quality, setQuality] = useState(0.92)
  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    if (!photo) return
    setBusy(true)
    try {
      const source = renderFrame({ image: photo.image, exif: photo.exif, logo, config })

      const opt = SIZE_OPTIONS.find(o => o.key === size)!
      let target = source
      if (opt.longEdge && Math.max(source.width, source.height) > opt.longEdge) {
        target = downscale(source, opt.longEdge)
      }

      const mime = FORMATS.find(f => f.key === format)!.mime
      const blob = await new Promise<Blob | null>(resolve => target.toBlob(resolve, mime, quality))
      if (!blob) return

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ext = format === 'jpeg' ? 'jpg' : format
      const base = photo.originalName.replace(/\.[^.]+$/, '')
      a.href = url
      a.download = `${base}-${config.id}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } finally {
      setBusy(false)
    }
  }

  if (!photo) {
    return <div className="p-4 text-[12px] text-slate-500">先上传一张照片</div>
  }

  return (
    <div className="p-4 space-y-5 fade-in">
      <div>
        <p className="text-[12px] text-slate-400 mb-2">尺寸</p>
        <div className="grid grid-cols-4 gap-1.5">
          {SIZE_OPTIONS.map(o => (
            <button key={o.key}
              onClick={() => setSize(o.key)}
              className={`py-1.5 rounded-md text-[12px] font-medium transition-all
                ${size === o.key
                  ? 'bg-sky-500 text-white shadow shadow-sky-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[12px] text-slate-400 mb-2">格式</p>
        <div className="grid grid-cols-3 gap-1.5">
          {FORMATS.map(f => (
            <button key={f.key}
              onClick={() => setFormat(f.key)}
              className={`py-1.5 rounded-md text-[12px] font-medium transition-all
                ${format === f.key
                  ? 'bg-sky-500 text-white shadow shadow-sky-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {format !== 'png' && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] text-slate-400">质量</span>
            <span className="text-[12px] font-mono text-sky-400">{Math.round(quality * 100)}</span>
          </div>
          <input type="range" min={0.5} max={1} step={0.02}
            value={quality} onChange={e => setQuality(Number(e.target.value))}
            className="w-full"/>
        </div>
      )}

      <button onClick={handleExport}
        disabled={busy}
        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium text-[13px] shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-indigo-400 disabled:opacity-50 transition-all">
        {busy ? '导出中…' : '↓ 下载'}
      </button>
    </div>
  )
}

function downscale(src: HTMLCanvasElement, longEdge: number): HTMLCanvasElement {
  const scale = longEdge / Math.max(src.width, src.height)
  const c = document.createElement('canvas')
  c.width = Math.round(src.width * scale)
  c.height = Math.round(src.height * scale)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return c
}
