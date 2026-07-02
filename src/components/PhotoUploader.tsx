import { useCallback, useRef, useState } from 'react'

interface Props {
  onFileSelect: (f: File) => void
  loading?: boolean
  error?: string | null
}

const ACCEPT = '.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.cr2,.cr3,.nef,.arw,.raf,.rw2,.orf,.pef,.dng,.rwl,image/*'

export default function PhotoUploader({ onFileSelect, loading, error }: Props) {
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

  return (
    <div
      className="flex-1 flex items-center justify-center p-12 relative"
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div
        onClick={() => inputRef.current?.click()}
        className={`relative w-full max-w-xl aspect-[4/3] rounded-xl bg-surface border border-dashed border-border-strong
          flex flex-col items-center justify-center gap-6 cursor-pointer transition-all duration-fast
          ${dragOver ? 'dropzone-active' : 'hover:border-text-3 hover:bg-canvas'}`}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleChange} />

        <div className="w-14 h-14 rounded-xl bg-canvas flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#78716c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>

        <div className="text-center space-y-1.5 px-6">
          <p className="text-[18px] font-medium text-text tracking-tight">上传照片</p>
          <p className="text-[12px] text-text-2 flex items-center justify-center gap-1.5">
            拖拽 · 粘贴
            <kbd className="font-mono text-[10px] bg-canvas border border-border rounded px-1 py-0.5">⌘V</kbd>
            · 点击选择
          </p>
          <p className="text-[11px] text-text-3 pt-3">
            JPG · PNG · WebP · HEIC · RAW (CR2/CR3/NEF/ARW/RAF/RW2/ORF/DNG)
          </p>
        </div>

        {loading && (
          <div className="absolute bottom-6 flex items-center gap-2 text-xs text-text-2">
            <div className="w-3 h-3 rounded-full border-[1.5px] border-accent border-t-transparent animate-spin"/>
            解析文件中…
          </div>
        )}
        {error && !loading && (
          <p className="absolute bottom-6 text-xs text-red-600">{error}</p>
        )}
      </div>
    </div>
  )
}
