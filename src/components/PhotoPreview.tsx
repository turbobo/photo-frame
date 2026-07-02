import { useEffect, useMemo, useRef, useState } from 'react'
import type { PhotoData, TemplateConfig } from '../types'
import { renderFrame } from '../utils/canvas'

interface Props {
  photo: PhotoData
  config: TemplateConfig
  logo: HTMLImageElement | null
}

export default function PhotoPreview({ photo, config, logo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [rendered, setRendered] = useState<HTMLCanvasElement | null>(null)
  const [scale, setScale] = useState(1)

  // 渲染
  useEffect(() => {
    const canvas = renderFrame({
      image: photo.image,
      exif: photo.exif,
      logo,
      config,
    })
    setRendered(canvas)
  }, [photo, config, logo])

  // 自适应缩放
  useEffect(() => {
    const el = containerRef.current
    if (!el || !rendered) return
    const compute = () => {
      const rect = el.getBoundingClientRect()
      const pad = 40
      const availW = rect.width - pad * 2
      const availH = rect.height - pad * 2
      const s = Math.min(availW / rendered.width, availH / rendered.height, 1)
      setScale(Math.max(0.05, s))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [rendered])

  const size = useMemo(() => {
    if (!rendered) return { w: 0, h: 0 }
    return { w: Math.round(rendered.width * scale), h: Math.round(rendered.height * scale) }
  }, [rendered, scale])

  return (
    <div ref={containerRef} className="flex-1 checker overflow-auto flex items-center justify-center relative">
      {rendered && (
        <div
          className="fade-in shadow-2xl shadow-black/50 rounded-sm"
          style={{ width: size.w, height: size.h }}>
          <PreviewCanvas source={rendered} width={size.w} height={size.h} />
        </div>
      )}
      {rendered && (
        <div className="absolute bottom-3 right-3 bg-slate-900/70 backdrop-blur px-2.5 py-1 rounded-md text-[11px] text-slate-300 flex items-center gap-2">
          <span>{rendered.width} × {rendered.height}</span>
          <span className="text-slate-500">|</span>
          <span>{Math.round(scale * 100)}%</span>
        </div>
      )}
    </div>
  )
}

function PreviewCanvas({ source, width, height }: { source: HTMLCanvasElement; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = width * dpr
    c.height = height * dpr
    c.style.width = `${width}px`
    c.style.height = `${height}px`
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, c.width, c.height)
  }, [source, width, height])
  return <canvas ref={ref} className="block" />
}
