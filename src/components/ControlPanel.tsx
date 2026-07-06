import { useState, useEffect, useRef, useCallback } from 'react'
import type { PhotoData, TemplateConfig } from '../types'
import { TEMPLATES, TEMPLATE_GROUPS, getDefaultConfig } from '../templates'
import { FONT_FAMILIES, TEXT_VARIABLES, replaceTextVars, cleanupText } from '../utils/fonts'
import { renderFrame } from '../utils/canvas'
import {
  loadPresets, savePreset, deletePreset,
  type TemplatePreset,
} from '../utils/presets'
import {
  runBatchExport, detectDeviceLimit,
  type BatchProgress,
} from '../utils/batchExport'
import BatchProgressModal from './BatchProgressModal'

interface Props {
  photo: PhotoData | null
  config: TemplateConfig
  onChange: (c: TemplateConfig) => void
  logo: HTMLImageElement | null
  onReplace?: (f: File) => void
  onClear?: () => void
  loading?: boolean
  onPresetActivate?: (name: string) => void
  onPresetDeactivate?: () => void
}

type Tab = 'style' | 'info'

const BATCH_ACCEPT = '.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.cr2,.cr3,.nef,.arw,.raf,.rw2,.orf,.pef,.dng,.rwl,image/*'

// ═══════════════════════════════════════════════════════
// SVG Icons (replacing emoji for cross-platform consistency)
// ═══════════════════════════════════════════════════════
function IconPreset({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  )
}

function IconTemplate({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18"/>
      <path d="M9 21V9"/>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════
// Inline Dialog (replaces window.prompt / window.confirm)
// ═══════════════════════════════════════════════════════
function InlineDialog({ title, children, onClose }: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl shadow-elev border border-border w-full max-w-[320px] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <h3 className="text-[14px] font-semibold text-text">{title}</h3>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Toast notification (replaces window.alert)
// ═══════════════════════════════════════════════════════
function Toast({ message, type = 'info', onClose }: {
  message: string
  type?: 'info' | 'error' | 'success'
  onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  const colors = {
    info: 'bg-accent text-white',
    error: 'bg-red-600 text-white',
    success: 'bg-green-600 text-white',
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 fade-in" role="alert" aria-live="polite">
      <div className={`${colors[type]} px-4 py-2.5 rounded-lg shadow-elev text-[12px] font-medium max-w-[320px]`}>
        {message}
      </div>
    </div>
  )
}

export default function ControlPanel({ photo, config, onChange, logo, loading, onPresetActivate, onPresetDeactivate }: Props) {
  const [tab, setTab] = useState<Tab>('style')

  // 导出状态
  const [size, setSize] = useState('orig')
  const [format, setFormat] = useState('jpeg')
  const [quality, setQuality] = useState(0.92)
  const [busy, setBusy] = useState(false)

  // 批量导出状态
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [showBatchTip, setShowBatchTip] = useState(false)
  const batchAbortRef = useRef<AbortController | null>(null)
  const batchInputRef = useRef<HTMLInputElement>(null)

  // 预设状态
  const [presets, setPresets] = useState<TemplatePreset[]>([])
  const [activePresetId, setActivePresetId] = useState<string | null>(null)

  // 内联对话框状态
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [savePresetName, setSavePresetName] = useState('')
  const saveInputRef = useRef<HTMLInputElement>(null)

  // Toast 状态
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null)

  useEffect(() => {
    setPresets(loadPresets())
  }, [])

  useEffect(() => {
    if (showSaveDialog && saveInputRef.current) {
      saveInputRef.current.focus()
    }
  }, [showSaveDialog])

  const handleSelectPreset = (preset: TemplatePreset) => {
    onChange(preset.config)
    setActivePresetId(preset.id)
    onPresetActivate?.(preset.name)
  }

  const handleSavePreset = () => {
    setSavePresetName(`我的预设 ${presets.filter(p => !p.official).length + 1}`)
    setShowSaveDialog(true)
  }

  const handleConfirmSave = () => {
    const name = savePresetName.trim()
    if (!name) return
    const newPreset = savePreset(name, config)
    setPresets(loadPresets())
    setActivePresetId(newPreset.id)
    onPresetActivate?.(name)
    setShowSaveDialog(false)
    setToast({ message: `预设「${name}」已保存`, type: 'success' })
  }

  const handleDeletePreset = () => {
    if (!activePresetId) return
    const preset = presets.find(p => p.id === activePresetId)
    if (!preset) return
    if (preset.official) {
      setToast({ message: '官方预设不可删除', type: 'info' })
      return
    }
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = () => {
    const preset = presets.find(p => p.id === activePresetId)
    deletePreset(activePresetId!)
    setPresets(loadPresets())
    setActivePresetId(null)
    onPresetDeactivate?.()
    setShowDeleteDialog(false)
    setToast({ message: `预设「${preset?.name}」已删除`, type: 'info' })
  }

  const patch = (p: Partial<TemplateConfig>) => {
    onChange({ ...config, ...p })
    onPresetDeactivate?.()
  }

  const handleBatchExport = async (files: File[]) => {
    if (!files.length) return
    const limit = detectDeviceLimit()
    const capped = files.slice(0, limit)
    if (files.length > limit) {
      setToast({ message: `当前设备最多支持 ${limit} 张，已自动截取前 ${limit} 张`, type: 'info' })
    }

    const ac = new AbortController()
    batchAbortRef.current = ac
    const longEdge = SIZE_OPTIONS.find(o => o.key === size)?.longEdge ?? 0

    setBatchProgress({
      current: 0, total: capped.length, currentName: '',
      completedCount: 0, failedCount: 0, startedAt: Date.now(),
    })

    try {
      const result = await runBatchExport({
        files: capped,
        config,
        format: format as 'jpeg' | 'png' | 'webp',
        quality,
        longEdge,
        onProgress: setBatchProgress,
        signal: ac.signal,
      })

      if (result.failedCount > 0) {
        setToast({
          message: `批量导出完成：${result.completedCount} 成功，${result.failedCount} 失败`,
          type: 'error',
        })
      }
    } catch (err) {
      console.error('batch export failed:', err)
      setToast({
        message: `批量导出失败: ${err instanceof Error ? err.message : String(err)}`,
        type: 'error',
      })
    } finally {
      setBatchProgress(null)
      batchAbortRef.current = null
    }
  }

  const handleExport = async () => {
    if (!photo) return
    setBusy(true)
    try {
      await document.fonts.ready
      const source = renderFrame({ image: photo.image, exif: photo.exif, logo, config })
      const sizeOpt = SIZE_OPTIONS.find(o => o.key === size)!
      let target = source
      if (sizeOpt.longEdge && Math.max(source.width, source.height) > sizeOpt.longEdge) {
        const s = sizeOpt.longEdge / Math.max(source.width, source.height)
        const c = document.createElement('canvas')
        c.width = Math.round(source.width * s)
        c.height = Math.round(source.height * s)
        const ctx = c.getContext('2d')!
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(source, 0, 0, c.width, c.height)
        target = c
      }
      const mime = FORMATS.find(f => f.key === format)!.mime
      const blob = await new Promise<Blob | null>(r => target.toBlob(r, mime, quality))
      if (!blob) {
        setToast({ message: '生成图片失败，请重试', type: 'error' })
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ext = format === 'jpeg' ? 'jpg' : format
      const base = photo.originalName.replace(/\.[^.]+$/, '')
      a.href = url
      a.download = `${base}-${config.id}.${ext}`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.dispatchEvent(new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
      }))
      setTimeout(() => {
        try { document.body.removeChild(a) } catch {}
        URL.revokeObjectURL(url)
      }, 100)
    } catch (err) {
      console.error('handleExport failed:', err)
      setToast({
        message: `下载失败: ${err instanceof Error ? err.message : String(err)}`,
        type: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col md:h-full">
      {/* Tabs */}
      <div className="px-5 pt-4 md:pt-5 pb-3 md:pb-4 border-b border-border shrink-0">
        <div className="segment w-full" role="tablist" aria-label="控制面板">
          <button role="tab" aria-selected={tab === 'style'} data-active={tab === 'style'} onClick={() => setTab('style')}>样式</button>
          <button role="tab" aria-selected={tab === 'info'} data-active={tab === 'info'} onClick={() => setTab('info')}>信息</button>
        </div>
      </div>

      {/* Content */}
      <div className="md:flex-1 md:overflow-y-auto" role="tabpanel">
        {tab === 'style' && <StylePanel
          config={config}
          onChange={patch}
          photo={photo}
          quality={quality}
          setQuality={setQuality}
          format={format}
          presets={presets}
          activePresetId={activePresetId}
          onSelectPreset={handleSelectPreset}
          onSavePreset={handleSavePreset}
          onDeletePreset={handleDeletePreset}
          onClosePreset={() => { setActivePresetId(null); onPresetDeactivate?.() }}
        />}
        {tab === 'info'   && <InfoPanel photo={photo} />}
      </div>

      {/* ─── 常驻导出栏（sticky footer）─── */}
      <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-surface px-5 py-3 md:py-4 space-y-3">
        {/* 格式 */}
        <div className="flex items-center gap-2">
          <span className="font-caption text-text-3 w-10 shrink-0">格式</span>
          <div className="segment flex-1" role="radiogroup" aria-label="导出格式">
            {FORMATS.map(f => (
              <button key={f.key} role="radio" aria-checked={format === f.key} data-active={format === f.key}
                onClick={() => setFormat(f.key)}
                className="flex-1">{f.label}</button>
            ))}
          </div>
        </div>

        {/* 尺寸 */}
        <div className="flex items-center gap-2">
          <span className="font-caption text-text-3 w-10 shrink-0">尺寸</span>
          <div className="segment flex-1" role="radiogroup" aria-label="导出尺寸">
            {SIZE_OPTIONS.map(o => (
              <button key={o.key} role="radio" aria-checked={size === o.key} data-active={size === o.key}
                onClick={() => setSize(o.key)}
                className="flex-1">{o.label}</button>
            ))}
          </div>
        </div>

        {/* 下载按钮 */}
        <button
          onClick={handleExport}
          disabled={!photo || busy}
          className="btn-primary w-full py-2.5 rounded-md text-[13px] font-medium flex items-center justify-center gap-2">
          {busy ? (
            <>
              <div className="w-3 h-3 rounded-full border-[1.5px] border-white border-t-transparent animate-spin"/>
              导出中…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {photo ? `下载 ${format === 'jpeg' ? 'JPG' : format.toUpperCase()}` : '下载'}
            </>
          )}
        </button>

        {/* 批量导出 */}
        <input
          ref={batchInputRef}
          type="file"
          multiple
          accept={BATCH_ACCEPT}
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files || [])
            e.target.value = ''
            if (files.length > 0) handleBatchExport(files)
          }}
        />
        <div className="relative group/batch">
          <button
            onClick={() => batchInputRef.current?.click()}
            disabled={busy || !!batchProgress}
            className="btn-outline w-full py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <rect x="4" y="4" width="16" height="3" rx="1" opacity="0.5"/>
              <rect x="6" y="1" width="12" height="3" rx="1" opacity="0.25"/>
            </svg>
            批量导出 ZIP
            <span
              role="button"
              tabIndex={-1}
              onClick={e => {
                e.stopPropagation()
                setShowBatchTip(v => !v)
                setTimeout(() => setShowBatchTip(false), 3000)
              }}
              className="shrink-0 cursor-help">
              <svg className="w-3.5 h-3.5 text-text-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </span>
            <span className="ml-auto text-[10px] text-text-3 font-mono">
              ≤ {detectDeviceLimit()} 张
            </span>
          </button>
          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-accent text-surface text-[11px] font-normal leading-relaxed whitespace-nowrap
                          transition-all duration-fast pointer-events-none z-20
                          after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2
                          after:border-4 after:border-transparent after:border-t-accent
                          ${showBatchTip ? 'opacity-100 visible' : 'opacity-0 invisible group-hover/batch:opacity-100 group-hover/batch:visible'}`}>
            建议先用当前照片预览模板效果
          </div>
        </div>
      </div>

      {/* 批量导出进度浮层 */}
      {batchProgress && (
        <BatchProgressModal
          progress={batchProgress}
          onCancel={() => {
            batchAbortRef.current?.abort()
            setBatchProgress(null)
          }}
          templateName={TEMPLATES.find(t => t.id === config.id)?.name}
          format={format}
          quality={quality}
        />
      )}

      {/* 保存预设对话框 */}
      {showSaveDialog && (
        <InlineDialog title="保存预设" onClose={() => setShowSaveDialog(false)}>
          <input
            ref={saveInputRef}
            type="text"
            value={savePresetName}
            onChange={e => setSavePresetName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleConfirmSave() }}
            placeholder="预设名称"
            className="w-full px-3 py-2 bg-canvas border border-border rounded-md text-[13px] text-text placeholder:text-text-3 outline-none focus:border-accent transition-colors duration-fast mb-3"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowSaveDialog(false)} className="btn-outline flex-1 py-2 rounded-md text-[12px]">取消</button>
            <button onClick={handleConfirmSave} className="btn-primary flex-1 py-2 rounded-md text-[12px]">保存</button>
          </div>
        </InlineDialog>
      )}

      {/* 删除预设确认 */}
      {showDeleteDialog && (
        <InlineDialog title="删除预设" onClose={() => setShowDeleteDialog(false)}>
          <p className="text-[12px] text-text-2 mb-4">
            确定删除预设「{presets.find(p => p.id === activePresetId)?.name}」？此操作不可撤销。
          </p>
          <div className="flex gap-2">
            <button onClick={() => setShowDeleteDialog(false)} className="btn-outline flex-1 py-2 rounded-md text-[12px]">取消</button>
            <button onClick={handleConfirmDelete} className="flex-1 py-2 rounded-md text-[12px] bg-red-600 text-white hover:bg-red-700 transition-colors">删除</button>
          </div>
        </InlineDialog>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Export constants
// ═══════════════════════════════════════════════════════
const SIZE_OPTIONS = [
  { key: 'orig', label: '原图', longEdge: 0 },
  { key: '3840', label: '4K',   longEdge: 3840 },
  { key: '2048', label: '2K',   longEdge: 2048 },
  { key: '1080', label: '1080', longEdge: 1080 },
]
const FORMATS = [
  { key: 'jpeg', label: 'JPG',  mime: 'image/jpeg' },
  { key: 'png',  label: 'PNG',  mime: 'image/png' },
  { key: 'webp', label: 'WebP', mime: 'image/webp' },
]

function describePresetEffect(p: TemplatePreset): string {
  const tpl = TEMPLATES.find(t => t.id === p.config.id)
  if (!tpl) return ''
  const fontLabel = FONT_FAMILIES.find(f => f.key === p.config.fontFamily)?.label || ''
  const parts: string[] = [tpl.name]
  if (fontLabel) parts.push(fontLabel)
  if (p.config.shadow) parts.push('阴影')
  return parts.join(' · ')
}

const parseCustomTextTokens = (text: string | undefined): string[] =>
  (text || '').match(/\{[^}]+\}|[^{\s]+/g) || []

// ═══════════════════════════════════════════════════════
// Color name map (for aria-label on color swatches)
// ═══════════════════════════════════════════════════════
const COLOR_NAMES: Record<string, string> = {
  '#ffffff': '白色', '#fafaf9': '米白', '#f5f5f4': '浅灰',
  '#d4b896': '牛皮色', '#a8a39d': '暖灰', '#44403c': '深灰',
  '#1c1917': '墨色', '#18181b': '黑色',
  '#ff3d00': '橙红', '#ff6b35': '橙色', '#ffcc00': '黄色',
  '#00ff88': '绿色', '#00aaff': '蓝色', '#ff00aa': '粉红',
}

function getColorName(hex: string): string {
  return COLOR_NAMES[hex.toLowerCase()] || hex
}

// ═══════════════════════════════════════════════════════
// Custom Text Input — contentEditable + tag palette + preview
// ═══════════════════════════════════════════════════════
function CustomTextInput({
  value, exif, onChange,
}: {
  value: string | undefined
  exif?: { make?: string; model?: string; lens?: string; focalLength?: number; fNumber?: number; exposureTime?: string; iso?: number; dateTaken?: string }
  onChange: (v: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalUpdate = useRef(false)

  // 从 config.customText 初始化 contentEditable DOM
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const currentText = extractText(el)
    if (currentText === (value || '')) return
    isInternalUpdate.current = true
    el.innerHTML = ''
    if (!value) {
      isInternalUpdate.current = false
      return
    }
    const tokens = parseCustomTextTokens(value)
    tokens.forEach((token, i) => {
      if (i > 0) el.appendChild(document.createTextNode(' '))
      const varMatch = token.match(/^\{(.+)\}$/)
      if (varMatch) {
        const varDef = TEXT_VARIABLES.find(v => v.key === varMatch[1])
        const span = document.createElement('span')
        span.className = 'var-tag'
        span.contentEditable = 'false'
        span.textContent = varDef?.label || varMatch[1]
        span.dataset.varKey = varMatch[1]
        el.appendChild(span)
      } else {
        el.appendChild(document.createTextNode(token))
      }
    })
    isInternalUpdate.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const extractText = useCallback((el: HTMLElement): string => {
    let text = ''
    el.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || ''
      } else if (node instanceof HTMLElement && node.dataset.varKey) {
        text += `{${node.dataset.varKey}}`
      }
    })
    return text.replace(/\s+/g, ' ').trim()
  }, [])

  const syncToConfig = useCallback(() => {
    if (isInternalUpdate.current) return
    const el = editorRef.current
    if (!el) return
    onChange(extractText(el))
  }, [onChange, extractText])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') e.preventDefault()
  }, [])

  const insertTag = useCallback((varKey: string) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    const varDef = TEXT_VARIABLES.find(v => v.key === varKey)
    const sel = window.getSelection()
    let range: Range | null = null
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0)
    } else {
      range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
    }
    // 前导空格
    const container = range.startContainer
    const offset = range.startOffset
    const needSpace = container.nodeType === Node.TEXT_NODE
      && container.textContent && offset > 0
      && container.textContent[offset - 1] !== ' '
    if (needSpace) {
      range.insertNode(document.createTextNode(' '))
      range.collapse(false)
    }
    // 创建标签
    const span = document.createElement('span')
    span.className = 'var-tag'
    span.contentEditable = 'false'
    span.textContent = varDef?.label || varKey
    span.dataset.varKey = varKey
    range.insertNode(span)
    // 尾部空格 + 光标
    const spaceAfter = document.createTextNode('\u00A0')
    span.after(spaceAfter)
    range.setStartAfter(spaceAfter)
    range.setEndAfter(spaceAfter)
    sel?.removeAllRanges()
    sel?.addRange(range)
    syncToConfig()
  }, [syncToConfig])

  const previewText = value
    ? cleanupText(replaceTextVars(value, exif || {}, {}))
    : ''

  return (
    <section>
      <SectionLabel>自定义文字</SectionLabel>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="自定义文字输入"
        data-placeholder="输入文字或点击下方标签插入拍摄信息"
        className="var-editor min-h-[44px] md:min-h-[36px] px-3 py-2 bg-canvas border border-border rounded-md
                   text-[13px] text-text leading-relaxed
                   focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none transition-colors duration-fast"
        onInput={syncToConfig}
        onKeyDown={handleKeyDown}
      />
      <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 mobile-scroll">
        {TEXT_VARIABLES.map(v => (
          <button key={v.key} type="button" onClick={() => insertTag(v.key)}
            title={`插入${v.label}（示例：${v.sample}）`}
            className="shrink-0 px-3 py-2 md:px-2 md:py-1.5 text-[11px] rounded-md
                       border border-border bg-surface text-text-2
                       hover:border-accent hover:text-text hover:bg-canvas-soft
                       active:scale-95 transition-all duration-fast
                       min-h-[40px] md:min-h-[32px]">
            {v.label}
          </button>
        ))}
      </div>
      {previewText && (
        <p className="text-[11px] text-text-2 mt-2 font-mono truncate">预览：{previewText}</p>
      )}
    </section>
  )
}

// ═══════════════════════════════════════════════════════
// Style Tab
// ═══════════════════════════════════════════════════════
function StylePanel({
  config, onChange, photo, quality, setQuality, format,
  presets, activePresetId, onSelectPreset, onSavePreset, onDeletePreset, onClosePreset,
}: {
  config: TemplateConfig
  onChange: (p: Partial<TemplateConfig>) => void
  photo: PhotoData | null
  quality: number
  setQuality: (v: number) => void
  format: string
  presets: TemplatePreset[]
  activePresetId: string | null
  onSelectPreset: (preset: TemplatePreset) => void
  onSavePreset: () => void
  onDeletePreset: () => void
  onClosePreset: () => void
}) {
  return (
    <div className="p-5 space-y-5 md:space-y-7">
      {/* ─── 预设（Presets）─── 中性风格 */}
      <section className="p-3 md:p-4 rounded-xl border border-border bg-canvas-soft">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[13px] font-semibold text-text flex items-center gap-1.5">
            <IconPreset className="text-text-2" />
            <span>预设</span>
            <span
              title="预设 = 一键应用整套配置（模板 + 字体 + 文字 + 颜色），保存后可复用"
              className="w-3.5 h-3.5 rounded-full bg-canvas text-text-3 text-[9px] font-bold flex items-center justify-center cursor-help border border-border">
              ?
            </span>
          </h3>
          <span className="text-[10px] text-text-3 font-mono font-semibold">{presets.length} 个</span>
        </div>
        <p className="text-[9px] text-text-3 mb-2 leading-relaxed">
          一键应用整套配置 · 微调后可另存为新预设
        </p>
        <div className="flex gap-1.5 items-stretch">
          <div className="relative flex-1 min-w-0">
            <select
              value={activePresetId ?? ''}
              onChange={e => {
                const id = e.target.value
                if (!id) {
                  onClosePreset()
                  return
                }
                const preset = presets.find(p => p.id === id)
                if (preset) onSelectPreset(preset)
              }}
              aria-label="选择预设"
              className="w-full px-2 py-1.5 pr-7 bg-surface border border-border rounded-md text-[11px] text-text outline-none focus:border-accent transition-colors duration-fast"
            >
              <option value="">— 选择 —</option>
              <optgroup label="官方">
                {presets.filter(p => p.official).map(p => {
                  const effectDesc = describePresetEffect(p)
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name}{effectDesc ? ` · ${effectDesc}` : ''}
                    </option>
                  )
                })}
              </optgroup>
              {presets.some(p => !p.official) && (
                <optgroup label="我的">
                  {presets.filter(p => !p.official).map(p => {
                    const effectDesc = describePresetEffect(p)
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name}{effectDesc ? ` · ${effectDesc}` : ''}
                      </option>
                    )
                  })}
                </optgroup>
              )}
            </select>
            {activePresetId && (
              <button
                type="button"
                onClick={() => onClosePreset()}
                title="关闭预设高亮（不改当前配置）"
                aria-label="关闭预设"
                className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-canvas hover:bg-border text-text-3 flex items-center justify-center text-[10px] font-bold leading-none transition-colors duration-fast">
                ×
              </button>
            )}
          </div>
          <button
            onClick={onSavePreset}
            title="保存当前配置为预设"
            className="btn-primary px-2.5 py-1.5 text-[11px] rounded-md whitespace-nowrap">
            + 保存
          </button>
          <button
            onClick={onDeletePreset}
            disabled={!activePresetId}
            title="删除所选预设"
            className="btn-outline px-2.5 py-1.5 text-[11px] rounded-md hover:border-red-400 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
            删除
          </button>
        </div>
        {activePresetId && (() => {
          const active = presets.find(p => p.id === activePresetId)
          if (!active) return null
          const tpl = TEMPLATES.find(t => t.id === active.config.id)
          const fontLabel = FONT_FAMILIES.find(f => f.key === active.config.fontFamily)?.label || '宋体'
          return (
            <div className="mt-2 p-2 rounded-md bg-surface border border-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-2">模板</span>
                <span className="text-[11px] text-text font-medium">{tpl?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-2">字体</span>
                <span className="text-[11px] text-text font-medium">{fontLabel}</span>
              </div>
              {active.config.customText && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] text-text-2 shrink-0">文字</span>
                  <div className="flex flex-wrap gap-0.5 justify-end">
                    {parseCustomTextTokens(active.config.customText).map((token, i) => {
                      const varKey = token.match(/^\{(.+)\}$/)?.[1]
                      const varDef = varKey ? TEXT_VARIABLES.find(v => v.key === varKey) : null
                      return (
                        <span key={i} className="px-1 py-px rounded bg-accent/10 text-[9px] text-text font-mono">
                          {varDef?.label || varKey || token}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              {active.config.shadow && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-2">阴影</span>
                  <span className="text-[10px] text-text">开启</span>
                </div>
              )}
            </div>
          )
        })()}
      </section>

      {/* ─── 模板（Templates）─── */}
      <section className="p-3 md:p-4 rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[13px] font-semibold text-text flex items-center gap-1.5">
            <IconTemplate className="text-text-2" />
            <span>模板</span>
            <span
              title="模板 = 视觉结构（边框/布局/装饰），可叠加右侧参数微调"
              className="w-3.5 h-3.5 rounded-full bg-canvas text-text-3 text-[9px] font-bold flex items-center justify-center cursor-help border border-border">
              ?
            </span>
          </h3>
          <span className="text-[10px] text-text-3 font-mono font-semibold">{TEMPLATES.length} 个</span>
        </div>
        <p className="text-[9px] text-text-3 mb-3 leading-relaxed">
          仅切换视觉结构 · 右侧参数可继续微调
        </p>
        <TemplateGrid selectedId={config.id} onSelect={id => {
          const defaults = getDefaultConfig(id as TemplateConfig['id'])
          onChange({
            ...defaults,
            // 保留用户自定义设置（不随模板切换重置）
            customText: config.customText,
            watermarkText: config.watermarkText,
            showLogo: config.showLogo,
            showExif: config.showExif,
            fontFamily: config.fontFamily,
            locationName: config.locationName,
            copyright: config.copyright,
          })
        }} />
      </section>

      {/* Dimensions */}
      <section className="space-y-4">
        <SectionLabel>尺寸</SectionLabel>

        <RangeRow label="边距" value={config.padding} min={0} max={20} step={0.5}
          suffix="%" onChange={v => onChange({ padding: v })} />
        <RangeRow label="字号" value={config.fontSize} min={1} max={5} step={0.1}
          suffix="%" onChange={v => onChange({ fontSize: v })} />
        <RangeRow label="圆角" value={config.radius} min={0} max={80} step={1}
          suffix="px" onChange={v => onChange({ radius: v })} />
      </section>

      {/* Colors */}
      <section>
        <SectionLabel>颜色</SectionLabel>
        <div className="space-y-3">
          <ColorRow label="背景" value={config.bgColor} onChange={v => onChange({ bgColor: v })} />
          <ColorRow label="文字" value={config.textColor} onChange={v => onChange({ textColor: v })} />
        </div>
      </section>

      {/* Font family */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <SectionLabel>字体</SectionLabel>
          <span className="text-[9px] text-text-3">影响所有文字</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="字体选择">
          {FONT_FAMILIES.map(f => {
            const isActive = (config.fontFamily || 'noto-serif') === f.key
            const sample = f.key === 'jetbrains' ? 'F/2.8'
              : f.key === 'wenkai' ? '签名'
              : f.key === 'noto-serif' ? '宋 Aa'
              : f.key === 'noto-sans' ? '黑 Aa'
              : 'Aa 1'
            return (
              <button key={f.key}
                role="radio"
                aria-checked={isActive}
                aria-label={f.label}
                onClick={() => onChange({ fontFamily: f.key })}
                className={`py-1.5 rounded-md text-center border transition-all duration-fast
                  ${isActive
                    ? 'border-accent bg-surface shadow-card text-text'
                    : 'border-border bg-canvas-soft text-text-2 hover:border-text-3'}`}>
                <div className="text-[13px] leading-tight" style={{ fontFamily: f.stack }}>
                  {sample}
                </div>
                <div className={`text-[9px] mt-0.5 ${isActive ? 'text-text-2' : 'text-text-3'}`}>
                  {f.label}
                </div>
              </button>
            )
          })}
        </div>
        <p className="text-[9px] text-text-3 mt-1.5 leading-relaxed">
          应用到照片上的所有文字：型号、EXIF 参数、日期、自定义文字、签名
        </p>
      </section>

      {/* Toggles */}
      <section className="space-y-2">
        <SectionLabel>选项</SectionLabel>
        <ToggleRow label="品牌 Logo" value={config.showLogo} onChange={v => onChange({ showLogo: v })} />
        <ToggleRow label="EXIF 信息" value={config.showExif} onChange={v => onChange({ showExif: v })} />
        <ToggleRow label="卡片阴影" value={config.shadow} onChange={v => onChange({ shadow: v })} />
      </section>

      {/* Quality (only for lossy formats) */}
      {format !== 'png' && (
        <section>
          <RangeRow label="质量" value={Math.round(quality * 100)} min={50} max={100} step={2}
            suffix="%" onChange={v => setQuality(v / 100)} />
        </section>
      )}

      {/* Custom text — rich input with tag insertion */}
      <CustomTextInput
        value={config.customText}
        exif={photo?.exif}
        onChange={v => onChange({ customText: v })}
      />

      {/* Location (only for location template) */}
      {config.id === 'location' && (
        <section>
          <SectionLabel>地点名</SectionLabel>
          <input
            type="text"
            value={config.locationName || ''}
            onChange={e => onChange({ locationName: e.target.value })}
            placeholder="如 北京·故宫 / 上海·外滩"
            aria-label="地点名称"
            className="w-full px-3 py-2 bg-canvas border border-border rounded-md text-[12px] text-text placeholder:text-text-3 outline-none focus:border-accent transition-colors duration-fast"/>
        </section>
      )}

      {/* Vintage-photo: timestamp position + color */}
      {config.id === 'vintage-photo' && (
        <>
          <section>
            <SectionLabel>时间戳位置</SectionLabel>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-canvas rounded-md" role="radiogroup" aria-label="时间戳位置">
              {([0, 1, 2, 3, 4, 5, 6, 7, 8] as const).map(p => {
                const posLabels = ['左上', '中上', '右上', '左中', '正中', '右中', '左下', '中下', '右下']
                return (
                  <button key={p}
                    role="radio"
                    aria-checked={config.timestampPosition === p}
                    aria-label={posLabels[p]}
                    onClick={() => onChange({ timestampPosition: p })}
                    className={`aspect-square rounded text-[10px] transition-all duration-fast min-h-[36px]
                      ${config.timestampPosition === p
                        ? 'bg-accent text-surface shadow-card'
                        : 'bg-surface text-text-3 border border-border hover:border-text-3'}`}>
                    {p + 1}
                  </button>
                )
              })}
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>时间戳颜色</SectionLabel>
              <input
                type="color"
                value={config.timestampColor || '#ff3d00'}
                onChange={e => onChange({ timestampColor: e.target.value })}
                aria-label="自定义时间戳颜色"
                className="w-6 h-6 rounded cursor-pointer bg-transparent border border-border p-0"/>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {['#ff3d00', '#ff6b35', '#ffcc00', '#00ff88', '#00aaff', '#ff00aa'].map(c => (
                <button key={c}
                  onClick={() => onChange({ timestampColor: c })}
                  aria-label={getColorName(c)}
                  className={`aspect-square rounded border transition-all duration-fast min-h-[36px]
                    ${(config.timestampColor || '#ff3d00') === c
                      ? 'border-accent scale-110 shadow-card'
                      : 'border-border hover:scale-105'}`}
                  style={{ background: c }}/>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Text-embed: layout + position + opacity */}
      {config.id === 'text-embed' && (
        <>
          <section>
            <SectionLabel>布局方向</SectionLabel>
            <div className="segment w-full" role="radiogroup" aria-label="布局方向">
              <button role="radio" aria-checked={config.embedLayout === 'v'} data-active={config.embedLayout === 'v'}
                onClick={() => onChange({ embedLayout: 'v' })}
                className="flex-1">垂直</button>
              <button role="radio" aria-checked={config.embedLayout === 'h'} data-active={config.embedLayout === 'h'}
                onClick={() => onChange({ embedLayout: 'h' })}
                className="flex-1">水平</button>
            </div>
          </section>
          <section>
            <SectionLabel>位置（9 宫格）</SectionLabel>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-canvas rounded-md" role="radiogroup" aria-label="文字位置">
              {([0, 1, 2, 3, 4, 5, 6, 7, 8] as const).map(p => {
                const posLabels = ['左上', '中上', '右上', '左中', '正中', '右中', '左下', '中下', '右下']
                return (
                  <button key={p}
                    role="radio"
                    aria-checked={config.embedPosition === p}
                    aria-label={posLabels[p]}
                    onClick={() => onChange({ embedPosition: p })}
                    className={`aspect-square rounded text-[10px] transition-all duration-fast min-h-[36px]
                      ${config.embedPosition === p
                        ? 'bg-accent text-surface shadow-card'
                        : 'bg-surface text-text-3 border border-border hover:border-text-3'}`}>
                    {p + 1}
                  </button>
                )
              })}
            </div>
          </section>
          <section>
            <RangeRow
              label="透明度"
              value={Math.round((config.embedOpacity ?? 0.55) * 100)}
              min={10} max={100} step={5} suffix="%"
              onChange={v => onChange({ embedOpacity: v / 100 })}/>
          </section>
        </>
      )}

      {/* Tiled-watermark: text + angle + density + opacity */}
      {config.id === 'tiled-watermark' && (
        <>
          <section>
            <SectionLabel>水印文本</SectionLabel>
            <input
              type="text"
              value={config.watermarkText || config.customText || ''}
              onChange={e => onChange({ watermarkText: e.target.value, customText: e.target.value })}
              placeholder="如 Framelet / 摄影师名字"
              aria-label="水印文本"
              className="w-full px-3 py-2 bg-canvas border border-border rounded-md text-[12px] text-text placeholder:text-text-3 outline-none focus:border-accent transition-colors duration-fast"/>
          </section>
          <section>
            <RangeRow
              label="旋转角度"
              value={config.watermarkAngle ?? -22}
              min={-45} max={45} step={1} suffix="°"
              onChange={v => onChange({ watermarkAngle: v })}/>
          </section>
          <section>
            <RangeRow
              label="密度"
              value={Math.round((config.watermarkDensity ?? 1) * 10) / 10}
              min={5} max={30} step={1} suffix="×"
              onChange={v => onChange({ watermarkDensity: v / 10 })}/>
          </section>
          <section>
            <RangeRow
              label="透明度"
              value={Math.round((config.watermarkOpacity ?? 0.18) * 100)}
              min={5} max={60} step={1} suffix="%"
              onChange={v => onChange({ watermarkOpacity: v / 100 })}/>
          </section>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Template grid (2 columns of minimal thumbnails)
// ═══════════════════════════════════════════════════════
function TemplateGrid({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-3" role="radiogroup" aria-label="模板选择">
      {TEMPLATE_GROUPS.map(group => {
        const items = TEMPLATES.filter(t => t.group === group.id)
        return (
          <div key={group.id}>
            <p className="text-[10px] font-semibold text-text-2 uppercase tracking-wider mb-2">
              {group.name}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {items.map(t => (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={selectedId === t.id}
                  aria-label={`${t.name} - ${t.desc}`}
                  onClick={() => onSelect(t.id)}
                  className={`rounded-lg border transition-all duration-fast overflow-hidden
                    ${selectedId === t.id
                      ? 'border-accent bg-surface shadow-card ring-2 ring-accent/10'
                      : 'border-border bg-surface hover:border-text-3 hover:shadow-card'
                    }`}>
                  <TemplateThumb id={t.id} name={t.name} desc={t.desc} selected={selectedId === t.id} />
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TemplateThumb({ id, name, desc, selected }: { id: string; name: string; desc: string; selected: boolean }) {
  return (
    <div className="flex flex-col">
      <div className="aspect-[4/3] w-full relative flex items-center justify-center bg-canvas-soft">
        <TemplatePreview id={id} />
      </div>
      <div className="px-2 py-1.5 bg-surface">
        <div className={`text-[11px] font-medium truncate ${selected ? 'text-text' : 'text-text-2'}`}>
          {name}
        </div>
        <div className="text-[9px] text-text-3 truncate leading-tight">
          {desc}
        </div>
      </div>
    </div>
  )
}

function TemplatePreview({ id }: { id: string }) {
  const photo = 'w-8 h-6 rounded-sm'
  const photoGradient = 'background:linear-gradient(135deg,#f59e0b 0%,#ec4899 50%,#8b5cf6 100%)'
  switch (id) {
    case 'minimal':
      return (
        <div className="w-11 h-10 bg-white rounded-sm relative flex items-center justify-center shadow-sm">
          <div className={photo} style={{ background: photoGradient }}/>
          <div className="absolute bottom-0.5 left-0.5 right-0.5 h-1 flex items-center justify-center">
            <div className="text-[3px] text-text-3 font-mono">NIKON · f/4 · 1/320</div>
          </div>
        </div>
      )
    case 'polaroid':
      return (
        <div className="w-9 h-11 bg-white rounded-sm flex flex-col shadow-sm">
          <div className="mx-1 mt-1 w-7 h-6" style={{ background: photoGradient }}/>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[4px] text-text-3 font-hand italic">signature</div>
          </div>
        </div>
      )
    case 'film':
      return (
        <div className="w-12 h-10 bg-black rounded-sm relative flex flex-col">
          <div className="flex justify-around py-0.5">
            {[0,1,2,3].map(i => <div key={i} className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>)}
          </div>
          <div className="flex-1 mx-1.5" style={{ background: photoGradient }}/>
          <div className="flex justify-around py-0.5">
            {[0,1,2,3].map(i => <div key={i} className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>)}
          </div>
        </div>
      )
    case 'exif':
      return (
        <div className="w-11 h-10 relative">
          <div className="absolute inset-x-0 top-0 h-7" style={{ background: photoGradient }}/>
          <div className="absolute inset-x-0 bottom-0 h-3 bg-black rounded-b-sm flex items-center px-1 justify-between">
            <div className="text-[3.5px] text-yellow-400 font-bold">Nikon</div>
            <div className="text-[3px] text-white font-mono">f/4 · 1/320</div>
          </div>
        </div>
      )
    case 'insta':
      return (
        <div className="w-10 h-10 bg-white rounded-md shadow-md flex items-center justify-center">
          <div className="w-8 h-7 rounded-sm" style={{ background: photoGradient }}/>
        </div>
      )
    case 'leica':
      return (
        <div className="w-11 h-10 relative">
          <div className="absolute inset-x-0 top-0 h-7" style={{ background: photoGradient }}/>
          <div className="absolute inset-x-0 bottom-0 h-3 bg-black rounded-b-sm flex items-center px-1 gap-0.5">
            <div className="w-1 h-1 rounded-full bg-red-500"/>
            <div className="text-[3.5px] text-white">Leica · M11</div>
          </div>
        </div>
      )
    case 'red-dot':
      return (
        <div className="w-11 h-9 relative rounded-sm overflow-hidden">
          <div className="absolute inset-0" style={{ background: photoGradient }}/>
          <div className="absolute bottom-0.5 right-0.5 bg-black/40 backdrop-blur px-1 py-0.5 rounded-sm flex items-center gap-0.5">
            <div className="w-0.5 h-0.5 rounded-full bg-red-500"/>
            <div className="text-[3px] text-white font-mono">f/4 · ISO250</div>
          </div>
        </div>
      )
    case 'dazz':
      return (
        <div className="w-12 h-10 bg-black rounded-sm flex flex-col justify-between py-0.5">
          <div className="flex justify-around px-0.5">
            {[0,1,2,3].map(i => <div key={i} className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>)}
          </div>
          <div className="mx-1.5 h-5" style={{ background: photoGradient }}/>
          <div className="flex justify-around px-0.5">
            {[0,1,2,3].map(i => <div key={i} className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>)}
          </div>
        </div>
      )
    case 'instax':
      return (
        <div className="w-9 h-11 bg-[#fefdf7] rounded-sm flex flex-col shadow-sm">
          <div className="mx-1 mt-1 w-7 h-5" style={{ background: photoGradient }}/>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[4px] text-text-3 font-hand">handwritten</div>
          </div>
        </div>
      )
    case 'xhs':
      return (
        <div className="w-9 h-11 bg-white rounded-md shadow-md flex flex-col p-0.5">
          <div className="flex items-center gap-0.5 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-sm bg-red-500"/>
            <div className="text-[3px] text-text-3">小红书笔记</div>
          </div>
          <div className="flex-1 rounded-sm" style={{ background: photoGradient }}/>
          <div className="mt-0.5 text-[3px] text-text font-medium">标题</div>
        </div>
      )
    case 'vintage':
      return (
        <div className="w-11 h-10 rounded-sm relative" style={{ background: '#d4b896' }}>
          <div className="absolute inset-1.5" style={{ background: photoGradient, filter: 'sepia(0.5)' }}/>
          <div className="absolute inset-0 border border-amber-800/30 rounded-sm pointer-events-none"/>
        </div>
      )
    case 'magazine':
      return (
        <div className="w-9 h-11 bg-white rounded-sm flex flex-col shadow-sm">
          <div className="h-2 border-b border-border flex items-center px-0.5 justify-between">
            <div className="text-[4px] font-display font-bold">PHOTO</div>
            <div className="text-[2.5px] text-text-3 font-mono">ISSUE 01</div>
          </div>
          <div className="flex-1" style={{ background: photoGradient }}/>
          <div className="h-2 border-t border-border px-0.5 py-0.5">
            <div className="text-[3px] text-text">Caption text</div>
          </div>
        </div>
      )
    case 'location':
      return (
        <div className="w-11 h-10 relative">
          <div className="absolute inset-x-0 top-0 h-7" style={{ background: photoGradient }}/>
          <div className="absolute inset-x-0 bottom-0 h-3 bg-black rounded-b-sm flex items-center px-1 justify-between">
            <div className="text-[3.5px] text-white">NIKON</div>
            <div className="text-[3px] text-white flex items-center gap-0.5">
              <svg width="4" height="4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
              北京·故宫
            </div>
          </div>
        </div>
      )
    case 'light-shadow':
      return (
        <div className="w-11 h-9 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-7" style={{ background: photoGradient }}/>
          <div className="absolute inset-x-0 bottom-0 h-2 bg-black flex items-center justify-center">
            <div className="text-[2.8px] text-white/90 font-mono tracking-tight whitespace-nowrap">
              NIKON Z5  50mm F4 1/13s ISO250
            </div>
          </div>
        </div>
      )
    case 'frameless-rounded':
      return (
        <div className="w-11 h-11 bg-[#f5f5f4] relative flex flex-col items-center justify-center p-1">
          <div className="w-8 h-6 rounded-sm overflow-hidden shadow-md" style={{ background: photoGradient }}/>
          <div className="mt-1 flex flex-col items-center gap-0.5">
            <div className="text-[2.5px] text-text font-bold">NIKON Z5</div>
            <div className="text-[2px] text-text-2 font-mono">50mm · f/4 · ISO250</div>
          </div>
        </div>
      )
    case 'white-border':
      return (
        <div className="w-11 h-11 bg-white shadow-md p-1 flex flex-col">
          <div className="flex-1" style={{ background: photoGradient }}/>
          <div className="mt-0.5 flex justify-between items-center">
            <div className="text-[2.5px] text-text font-bold">NIKON Z5</div>
            <div className="text-[2px] text-text-2 font-mono">50mm f/4 ISO250</div>
          </div>
        </div>
      )
    case 'ps-splash':
      return (
        <div className="w-11 h-11 bg-white shadow-md flex p-0.5 gap-0.5">
          <div className="flex-[55%] flex flex-col p-0.5">
            <div className="w-2 h-2 rounded-sm bg-[#001e36] flex items-center justify-center">
              <span className="text-[2.5px] text-[#31a8ff] font-bold">Ps</span>
            </div>
            <div className="mt-0.5 text-[2px] text-text font-bold">Photoshop</div>
            <div className="flex-1 flex flex-col gap-0.5 mt-0.5">
              <div className="text-[1.5px] text-text-2">Camera: NIKON</div>
              <div className="text-[1.5px] text-text-2">ISO: 250</div>
              <div className="text-[1.5px] text-text-2">f/4</div>
            </div>
          </div>
          <div className="flex-[45%] rounded-sm overflow-hidden" style={{ background: photoGradient }}/>
        </div>
      )
    case 'lr-splash':
      return (
        <div className="w-11 h-11 bg-white shadow-md flex p-0.5 gap-0.5">
          <div className="flex-[55%] flex flex-col p-0.5">
            <div className="w-2 h-2 rounded-sm bg-[#1a2535] flex items-center justify-center">
              <span className="text-[2.5px] text-[#0099ff] font-bold">Lr</span>
            </div>
            <div className="mt-0.5 text-[2px] text-text font-bold">Lightroom</div>
            <div className="flex-1 flex flex-col gap-0.5 mt-0.5">
              <div className="text-[1.5px] text-text-2">Camera: NIKON</div>
              <div className="text-[1.5px] text-text-2">ISO: 250</div>
              <div className="text-[1.5px] text-text-2">f/4</div>
            </div>
          </div>
          <div className="flex-[45%] rounded-sm overflow-hidden" style={{ background: photoGradient }}/>
        </div>
      )
    case 'vintage-photo':
      return (
        <div className="w-11 h-9 relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: photoGradient }}/>
          <div className="absolute bottom-1 right-1 text-[3px] font-mono text-[#ff3d00] tracking-widest"
               style={{ textShadow: '0 0 1px #ff3d00, 0 0 2px #ff3d00' }}>
            2025-01-15
          </div>
        </div>
      )
    case 'text-embed':
      return (
        <div className="w-11 h-9 relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: photoGradient }}/>
          <div className="absolute bottom-1 left-1 flex flex-col opacity-60">
            <div className="text-[2px] text-white font-bold">NIKON Z5</div>
            <div className="text-[1.5px] text-white font-mono">50mm f/4 ISO250</div>
            <div className="text-[1.5px] text-white">2025-01-15</div>
          </div>
        </div>
      )
    case 'tiled-watermark':
      return (
        <div className="w-11 h-9 relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: photoGradient }}/>
          <div className="absolute inset-0 flex flex-col gap-1 p-0.5 opacity-25 -rotate-12">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex gap-1">
                {[0, 1, 2].map(j => (
                  <div key={j} className="text-[2px] text-white whitespace-nowrap">Framelet</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )
    default:
      return <div className={photo} style={{ background: photoGradient }}/>
  }
}

// ═══════════════════════════════════════════════════════
// Info Tab
// ═══════════════════════════════════════════════════════
function InfoPanel({ photo }: { photo: PhotoData | null }) {
  if (!photo) return <EmptyState label="先上传一张照片" />
  const { exif, file, image } = photo
  const rows: Array<[string, string | undefined]> = [
    ['文件', file.name],
    ['尺寸', `${image.naturalWidth} × ${image.naturalHeight}`],
    ['大小', `${(file.size / 1024 / 1024).toFixed(2)} MB`],
    ['相机', [exif.make, exif.model].filter(Boolean).join(' ') || undefined],
    ['镜头', exif.lens],
    ['焦距', exif.focalLength ? `${Math.round(exif.focalLength)} mm` : undefined],
    ['光圈', exif.fNumber ? `f/${exif.fNumber}` : undefined],
    ['快门', exif.exposureTime],
    ['ISO',  exif.iso ? `ISO ${exif.iso}` : undefined],
    ['时间', exif.dateTaken],
    ['GPS',  exif.gps ? `${exif.gps.lat.toFixed(4)}, ${exif.gps.lng.toFixed(4)}` : undefined],
  ]
  return (
    <div className="p-5">
      <div className="space-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="font-caption text-text-3 w-10 shrink-0">{k}</span>
            <span className="text-text text-right truncate font-mono text-[11px]">
              {v || <span className="text-text-3">—</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Shared UI primitives
// ═══════════════════════════════════════════════════════
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-caption text-text-3 mb-3">{children}</p>
}

function RangeRow({ label, value, min, max, step, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (v: number) => void
}) {
  const id = `range-${label}`
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor={id} className="text-[12px] text-text font-medium">{label}</label>
        <span className="font-mono text-[11px] text-text-2 tabular-nums">
          {Number.isInteger(step) ? value : value.toFixed(1)}{suffix}
        </span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        aria-label={label}
        onChange={e => onChange(Number(e.target.value))} />
    </div>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const presets = ['#ffffff', '#fafaf9', '#f5f5f4', '#d4b896', '#a8a39d', '#44403c', '#1c1917', '#18181b']
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] text-text">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-text-3 uppercase">{value}</span>
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            aria-label={`${label}颜色选择器`}
            className="w-5 h-5 rounded cursor-pointer bg-transparent border border-border p-0"/>
        </div>
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {presets.map(c => (
          <button key={c} onClick={() => onChange(c)}
            aria-label={`${label} ${getColorName(c)}`}
            className={`aspect-square rounded border transition-all duration-fast min-h-[32px]
              ${value.toLowerCase() === c.toLowerCase() ? 'border-accent scale-110 shadow-card' : 'border-border hover:scale-105'}`}
            style={{ background: c }}/>
        ))}
      </div>
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2 md:py-0.5 min-h-[44px] md:min-h-0">
      <span className="text-[12px] text-text">{label}</span>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 md:w-8 md:h-[18px] rounded-full transition-colors duration-fast ${value ? 'bg-accent' : 'bg-border-strong'}`}>
        <div className={`absolute top-[2px] w-5 h-5 md:w-[14px] md:h-[14px] bg-white rounded-full shadow transition-transform duration-fast
          ${value ? 'translate-x-[21px] md:translate-x-[15px]' : 'translate-x-[2px]'}`}/>
      </button>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="p-6 text-center text-[12px] text-text-3">{label}</div>
}
