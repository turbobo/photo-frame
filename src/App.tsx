import { useState, useCallback, useEffect } from 'react'
import type { PhotoData, TemplateConfig } from './types'
import { loadImage, extractExif } from './utils/exif'
import { getLogoPath, loadLogo } from './utils/logos'
import { getDefaultConfig } from './templates'
import PhotoUploader from './components/PhotoUploader'
import PhotoPreview from './components/PhotoPreview'
import ControlPanel from './components/ControlPanel'

export default function App() {
  const [photo, setPhoto] = useState<PhotoData | null>(null)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null)
  const [config, setConfig] = useState<TemplateConfig>(getDefaultConfig('exif'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const [image, exif] = await Promise.all([loadImage(file), extractExif(file)])
      setPhoto({ file, image, exif, originalName: file.name })

      const logoPath = getLogoPath(exif.make)
      if (logoPath) {
        try {
          const l = await loadLogo(logoPath)
          setLogo(l)
        } catch { setLogo(null) }
      } else {
        setLogo(null)
      }
    } catch (e: any) {
      setError(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) handleFileSelect(f)
          break
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFileSelect])

  return (
    <div className="min-h-full md:h-full flex flex-col bg-bg text-text md:overflow-hidden">
      {/* ─────── Header ─────── */}
      <header className="flex items-center justify-between px-4 md:px-7 h-[52px] md:h-[64px] shrink-0 border-b border-border bg-surface">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="1.5"/>
              <circle cx="12" cy="12.5" r="3"/>
              <path d="M8 6l1.5-2h5L16 6"/>
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <h1 className="font-display">Photo Frame</h1>
            <span className="text-[10px] text-text-3 font-mono tracking-tight">v2</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1.5">
          {['RAW', 'JPG', 'PNG', 'HEIC'].map(f => (
            <span key={f} className="px-1.5 py-0.5 text-[9px] font-caption text-text-3 border border-border rounded">
              {f}
            </span>
          ))}
        </div>
      </header>

      {/* ─────── Main: Preview + Control Panel ─────── */}
      <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
        {/* Preview Area */}
        <main className="h-[50vh] md:h-auto md:flex-1 flex flex-col overflow-hidden relative bg-canvas">
          {photo ? (
            <>
              <div className="flex-1 overflow-hidden">
                <PhotoPreview photo={photo} config={config} logo={logo} />
              </div>
              {/* Bottom: EXIF inline info bar */}
              <div className="shrink-0 px-4 md:px-7 py-2 md:py-3 border-t border-border bg-surface flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-4">
                <div className="flex items-center gap-2 text-text-2 font-mono text-xs truncate">
                  <span className="text-text font-medium">{photo.exif.model || photo.originalName}</span>
                  {photo.exif.lens && <><span className="text-border-strong">·</span><span>{photo.exif.lens}</span></>}
                </div>
                <div className="flex items-center gap-2 text-text-2 font-mono text-xs flex-wrap md:flex-nowrap md:shrink-0">
                  {photo.exif.focalLength && <span>{Math.round(photo.exif.focalLength)}mm</span>}
                  {photo.exif.fNumber && <><span className="text-border-strong">·</span><span>f/{photo.exif.fNumber}</span></>}
                  {photo.exif.exposureTime && <><span className="text-border-strong">·</span><span>{photo.exif.exposureTime}</span></>}
                  {photo.exif.iso && <><span className="text-border-strong">·</span><span>ISO{photo.exif.iso}</span></>}
                  {photo.exif.dateTaken && <><span className="text-border-strong">·</span><span className="text-text-3">{photo.exif.dateTaken}</span></>}
                </div>
              </div>
            </>
          ) : (
            <PhotoUploader onFileSelect={handleFileSelect} loading={loading} error={error} />
          )}
        </main>

        {/* Control Panel */}
        <aside className="w-full md:w-[320px] shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface md:overflow-y-auto">
          <ControlPanel
            photo={photo}
            config={config}
            onChange={setConfig}
            logo={logo}
            onReplace={photo ? handleFileSelect : undefined}
            loading={loading}
          />
        </aside>
      </div>
    </div>
  )
}
