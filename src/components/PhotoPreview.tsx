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
  const [bgUrl, setBgUrl] = useState<string | null>(null)

  // 渲染带边框的完整图像
  useEffect(() => {
    const canvas = renderFrame({
      image: photo.image,
      exif: photo.exif,
      logo,
      config,
    })
    setRendered(canvas)

    // 生成低分辨率背景（用于模糊光晕，省内存）
    const bgCanvas = document.createElement('canvas')
    const MAX_BG = 600
    const ratio = Math.min(MAX_BG / canvas.width, MAX_BG / canvas.height, 1)
    bgCanvas.width = Math.round(canvas.width * ratio)
    bgCanvas.height = Math.round(canvas.height * ratio)
    const bgCtx = bgCanvas.getContext('2d')!
    bgCtx.imageSmoothingQuality = 'medium'
    bgCtx.drawImage(canvas, 0, 0, bgCanvas.width, bgCanvas.height)
    setBgUrl(bgCanvas.toDataURL('image/jpeg', 0.7))
  }, [photo, config, logo])

  // 自适应缩放
  useEffect(() => {
    const el = containerRef.current
    if (!el || !rendered) return
    const compute = () => {
      const rect = el.getBoundingClientRect()
      const pad = rect.width < 640 ? 12 : 56
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
    <div ref={containerRef} className="h-full w-full flex items-center justify-center p-1.5 md:p-10 bg-canvas relative overflow-hidden">
      {/* 背景模糊层 —— 照片自身色彩扩散为柔焦光晕 */}
      {bgUrl && (
        <>
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              backgroundImage: `url(${bgUrl})`,
              backgroundSize: '110% 110%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              filter: 'blur(100px) saturate(1.2) brightness(1.05)',
              opacity: 0.3,
              transform: 'scale(1.08)', // 放大避免模糊边缘露白
            }}
            aria-hidden="true"
          />
          {/* 极浅叠加层 —— 保持近白画布的纯净感 */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(250, 250, 249, 0.5)' }}
            aria-hidden="true"
          />
        </>
      )}

      {/* 主图（前景）—— 细边框 + 柔阴影，像真实相框 */}
      {rendered && (
        <div
          className="relative fade-in rounded-md z-10 ring-1 ring-black/5"
          style={{
            width: size.w,
            height: size.h,
            boxShadow: '0 8px 24px rgba(28,25,23,0.12), 0 2px 6px rgba(28,25,23,0.06)',
          }}>
          <PreviewCanvas source={rendered} width={size.w} height={size.h} />
        </div>
      )}

      {/* 尺寸信息角标 */}
      {rendered && (
        <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 z-20 bg-surface border border-border px-2.5 py-1 rounded text-[10px] font-mono text-text-2 flex items-center gap-2 shadow-card">
          <span>{rendered.width} × {rendered.height}</span>
          <span className="text-border-strong">/</span>
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
