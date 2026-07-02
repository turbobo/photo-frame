import { useEffect, useMemo, useRef, useState } from 'react'
import type { PhotoData, TemplateConfig } from '../types'
import { renderFrame } from '../utils/canvas'

interface Props {
  photo: PhotoData
  config: TemplateConfig
  logo: HTMLImageElement | null
  onReplace?: (f: File) => void
  onClear?: () => void
}

export default function PhotoPreview({ photo, config, logo, onReplace, onClear }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

      {/* 浮动操作栏 —— 左下角（换一张 + 清空） */}
      {(onReplace || onClear) && (
        <div className="absolute bottom-2 left-2 md:bottom-4 md:left-4 z-20 flex items-center gap-1.5">
          {/* 隐藏的 file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.cr2,.cr3,.nef,.arw,.raf,.rw2,.orf,.pef,.dng,.rwl,image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f && onReplace) onReplace(f)
              e.target.value = ''
            }}
          />

          {/* 换一张按钮 */}
          {onReplace && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="group/btn flex items-center gap-1.5 px-3 py-1.5 rounded-full
                bg-black/60 backdrop-blur-md border border-white/10
                hover:bg-black/75 hover:border-white/20
                text-white text-[12px] font-medium
                shadow-elev transition-all duration-fast"
              title="换一张照片">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/>
                <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/>
                <polyline points="3 22 3 16 9 16"/>
                <polyline points="21 2 21 8 15 8"/>
              </svg>
              <span className="hidden md:inline">换一张</span>
            </button>
          )}

          {/* 清空按钮 */}
          {onClear && (
            <button
              onClick={onClear}
              className="group/btn flex items-center gap-1.5 px-3 py-1.5 rounded-full
                bg-black/60 backdrop-blur-md border border-white/10
                hover:bg-red-500/80 hover:border-red-400/40
                text-white text-[12px] font-medium
                shadow-elev transition-all duration-fast"
              title="清空照片回到上传">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              <span className="hidden md:inline">清空</span>
            </button>
          )}
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
