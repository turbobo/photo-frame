import { useCallback, useRef, useState } from 'react'

interface Props {
  onFileSelect: (f: File) => void
  compact: boolean
  loading?: boolean
  error?: string | null
}

const ACCEPT = '.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.cr2,.cr3,.nef,.arw,.raf,.rw2,.orf,.pef,.dng,.rwl,image/*'

export default function PhotoUploader({ onFileSelect, compact, loading, error }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFileSelect(f)
  }, [onFileSelect])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onFileSelect(f)
    e.target.value = ''
  }

  if (compact) {
    return (
      <div className="border-t border-slate-800 bg-slate-900/60 p-2 flex items-center justify-center gap-3 shrink-0">
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleChange} />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30 transition-colors disabled:opacity-40">
          {loading ? '加载中…' : '↻ 更换照片'}
        </button>
        <span className="text-[11px] text-slate-500">或拖拽 / 粘贴 (⌘V)</span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
      {/* 装饰背景 */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl"/>
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl"/>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative w-full max-w-2xl aspect-[16/10] border-2 border-dashed rounded-2xl bg-slate-900/40 backdrop-blur flex flex-col items-center justify-center transition-all cursor-pointer
          ${dragOver ? 'dropzone-active scale-[1.01]' : 'border-slate-700 hover:border-slate-500'}`}
        onClick={() => inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleChange} />

        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 flex items-center justify-center mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>

        <p className="text-[15px] font-medium mb-1">拖入照片 · 粘贴 (⌘V) · 点击选择</p>
        <p className="text-[12px] text-slate-500 mb-5">支持 JPG · PNG · WEBP · HEIC · RAW（CR2/CR3/NEF/ARW/RAF/RW2/ORF/DNG…）</p>

        {loading && (
          <div className="flex items-center gap-2 text-[12px] text-sky-400">
            <div className="w-3 h-3 rounded-full border-2 border-sky-400 border-t-transparent animate-spin"/>
            正在解析文件…
          </div>
        )}
        {error && !loading && (
          <p className="text-[12px] text-red-400">⚠️ {error}</p>
        )}
      </div>
    </div>
  )
}
