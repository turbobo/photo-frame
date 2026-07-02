import { useState, useCallback, useEffect } from 'react'
import type { PhotoData, TemplateConfig } from './types'
import { loadImage, extractExif } from './utils/exif'
import { getLogoPath, loadLogo } from './utils/logos'
import { getDefaultConfig } from './templates'
import PhotoUploader from './components/PhotoUploader'
import PhotoPreview from './components/PhotoPreview'
import TemplateSelector from './components/TemplateSelector'
import TemplateEditor from './components/TemplateEditor'
import ExifInfoPanel from './components/ExifInfoPanel'
import ExportPanel from './components/ExportPanel'

export default function App() {
  const [photo, setPhoto] = useState<PhotoData | null>(null)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null)
  const [config, setConfig] = useState<TemplateConfig>(getDefaultConfig('exif'))
  const [rightTab, setRightTab] = useState<'info' | 'edit' | 'export'>('edit')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const [image, exif] = await Promise.all([loadImage(file), extractExif(file)])
      setPhoto({ file, image, exif, originalName: file.name })

      // 匹配品牌 Logo
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
    <div className="h-full flex flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-slate-900/70 backdrop-blur border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2"/>
              <circle cx="12" cy="12" r="3.5"/>
              <path d="M8 5l1.5-2h5L16 5"/>
            </svg>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">Photo Frame</h1>
            <p className="text-[11px] text-slate-400">相机 · 边框 · 水印 · 一站生成</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-500">
          <span className="px-2 py-1 rounded bg-slate-800/70">RAW</span>
          <span className="px-2 py-1 rounded bg-slate-800/70">JPG</span>
          <span className="px-2 py-1 rounded bg-slate-800/70">PNG</span>
          <span className="px-2 py-1 rounded bg-slate-800/70">HEIC</span>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左：模板选择 */}
        <aside className="w-56 border-r border-slate-800 overflow-y-auto bg-slate-900/40 shrink-0">
          <TemplateSelector selectedId={config.id} onSelect={id => setConfig(getDefaultConfig(id))} />
        </aside>

        {/* 中：预览 */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {photo ? (
            <PhotoPreview photo={photo} config={config} logo={logo} />
          ) : (
            <PhotoUploader onFileSelect={handleFileSelect} compact={false} loading={loading} error={error} />
          )}
          {photo && (
            <PhotoUploader onFileSelect={handleFileSelect} compact={true} loading={loading} error={error} />
          )}
        </main>

        {/* 右：Tabs */}
        <aside className="w-72 border-l border-slate-800 flex flex-col bg-slate-900/40 shrink-0">
          <div className="flex border-b border-slate-800 shrink-0">
            {([
              { id: 'edit',   label: '样式' },
              { id: 'info',   label: '信息' },
              { id: 'export', label: '导出' },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setRightTab(t.id)}
                className={`flex-1 text-[13px] py-3 transition-colors font-medium ${
                  rightTab === t.id
                    ? 'text-sky-400 border-b-2 border-sky-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {rightTab === 'edit'   && <TemplateEditor config={config} onChange={setConfig} />}
            {rightTab === 'info'   && <ExifInfoPanel photo={photo} />}
            {rightTab === 'export' && <ExportPanel photo={photo} config={config} logo={logo} />}
          </div>
        </aside>
      </div>
    </div>
  )
}
