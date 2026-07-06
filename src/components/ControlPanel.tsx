import { useState, useEffect, useRef } from 'react'
import type { PhotoData, TemplateConfig } from '../types'
import { TEMPLATES, TEMPLATE_GROUPS } from '../templates'
import { FONT_FAMILIES, TEXT_VARIABLES } from '../utils/fonts'
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
}

type Tab = 'style' | 'info'

const BATCH_ACCEPT = '.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.cr2,.cr3,.nef,.arw,.raf,.rw2,.orf,.pef,.dng,.rwl,image/*'

export default function ControlPanel({ photo, config, onChange, logo, loading }: Props) {
  const [tab, setTab] = useState<Tab>('style')

  // 导出状态
  const [size, setSize] = useState('orig')
  const [format, setFormat] = useState('jpeg')
  const [quality, setQuality] = useState(0.92)
  const [busy, setBusy] = useState(false)

  // 批量导出状态
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const batchAbortRef = useRef<AbortController | null>(null)
  const batchInputRef = useRef<HTMLInputElement>(null)

  // 预设状态
  const [presets, setPresets] = useState<TemplatePreset[]>([])
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  // 加载预设列表（仅客户端）
  useEffect(() => {
    setPresets(loadPresets())
  }, [])

  const handleSelectPreset = (preset: TemplatePreset) => {
    onChange(preset.config)
    setActivePresetId(preset.id)
  }

  const handleSavePreset = () => {
    if (typeof window === 'undefined') return
    const name = window.prompt('保存预设名称', `我的预设 ${presets.filter(p => !p.official).length + 1}`)
    if (!name?.trim()) return
    const newPreset = savePreset(name.trim(), config)
    setPresets(loadPresets())
    setActivePresetId(newPreset.id)
  }

  const handleDeletePreset = () => {
    if (!activePresetId) return
    const preset = presets.find(p => p.id === activePresetId)
    if (!preset) return
    if (preset.official) {
      if (typeof window !== 'undefined') {
        window.alert('官方预设不可删除')
      }
      return
    }
    if (typeof window !== 'undefined' && !window.confirm(`删除预设「${preset.name}」？`)) return
    deletePreset(activePresetId)
    setPresets(loadPresets())
    setActivePresetId(null)
  }

  const patch = (p: Partial<TemplateConfig>) => onChange({ ...config, ...p })

  const handleInsertVariable = (varKey: string) => {
    const current = config.customText || ''
    const sep = current && !current.endsWith(' ') ? ' ' : ''
    patch({ customText: current + sep + `{${varKey}}` })
  }

  const handleRemoveVariable = (index: number) => {
    const tokens = parseCustomTextTokens(config.customText)
    tokens.splice(index, 1)
    patch({ customText: tokens.join(' ') })
  }

  const handleBatchExport = async (files: File[]) => {
    if (!files.length) return
    const limit = detectDeviceLimit()
    const capped = files.slice(0, limit)
    if (files.length > limit && typeof window !== 'undefined') {
      window.alert(`当前设备最多支持 ${limit} 张，已自动截取前 ${limit} 张`)
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

      if (result.failedCount > 0 && typeof window !== 'undefined') {
        window.alert(
          `批量导出完成：${result.completedCount} 成功，${result.failedCount} 失败\n` +
          result.failures.map(f => `• ${f.name}: ${f.reason}`).join('\n')
        )
      }
    } catch (err) {
      console.error('batch export failed:', err)
      if (typeof window !== 'undefined') {
        window.alert(`批量导出失败: ${err instanceof Error ? err.message : String(err)}`)
      }
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
        if (typeof window !== 'undefined') {
          window.alert('生成图片失败，请重试')
        }
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
      // 使用 dispatchEvent + MouseEvent 代替 HTMLElement.click()
      // 兼容性更好，Chrome 120+ 不会静默阻止
      a.dispatchEvent(new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
      }))
      // 下载触发后立即清理，避免内存泄漏和重复下载
      setTimeout(() => {
        try { document.body.removeChild(a) } catch {}
        URL.revokeObjectURL(url)
      }, 100)
    } catch (err) {
      console.error('handleExport failed:', err)
      if (typeof window !== 'undefined') {
        window.alert(`下载失败: ${err instanceof Error ? err.message : String(err)}`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col md:h-full">
      {/* Tabs */}
      <div className="px-4 md:px-6 pt-4 md:pt-5 pb-3 md:pb-4 border-b border-border shrink-0">
        <div className="segment w-full">
          <button data-active={tab === 'style'} onClick={() => setTab('style')}>样式</button>
          <button data-active={tab === 'info'}  onClick={() => setTab('info')}>信息</button>
        </div>
      </div>

      {/* Content */}
      <div className="md:flex-1 md:overflow-y-auto">
        {tab === 'style' && <StylePanel
          config={config}
          onChange={patch}
          quality={quality}
          setQuality={setQuality}
          format={format}
          presets={presets}
          activePresetId={activePresetId}
          onSelectPreset={handleSelectPreset}
          onSavePreset={handleSavePreset}
          onDeletePreset={handleDeletePreset}
          onClosePreset={() => setActivePresetId(null)}
          onInsertVariable={handleInsertVariable}
          onRemoveVariable={handleRemoveVariable}
        />}
        {tab === 'info'   && <InfoPanel photo={photo} />}
      </div>

      {/* ─── 常驻导出栏（sticky footer）─── */}
      <div className="shrink-0 border-t border-border bg-surface px-4 md:px-5 py-3 md:py-4 space-y-3">
        {/* 格式 */}
        <div className="flex items-center gap-2">
          <span className="font-caption text-text-3 w-10 shrink-0">格式</span>
          <div className="segment flex-1">
            {FORMATS.map(f => (
              <button key={f.key} data-active={format === f.key}
                onClick={() => setFormat(f.key)}
                className="flex-1">{f.label}</button>
            ))}
          </div>
        </div>

        {/* 尺寸 */}
        <div className="flex items-center gap-2">
          <span className="font-caption text-text-3 w-10 shrink-0">尺寸</span>
          <div className="segment flex-1">
            {SIZE_OPTIONS.map(o => (
              <button key={o.key} data-active={size === o.key}
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
          <span className="ml-auto text-[10px] text-text-3 font-mono">
            ≤ {detectDeviceLimit()} 张
          </span>
        </button>
        {photo && (
          <p className="text-[10px] text-text-3 text-center mt-2">
            提示：建议先用当前照片预览模板效果
          </p>
        )}
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

/** 根据预设配置生成简短效果描述（用于下拉选项） */
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
// Style Tab
// ═══════════════════════════════════════════════════════
function StylePanel({
  config, onChange, quality, setQuality, format,
  presets, activePresetId, onSelectPreset, onSavePreset, onDeletePreset, onClosePreset,
  onInsertVariable, onRemoveVariable,
}: {
  config: TemplateConfig
  onChange: (p: Partial<TemplateConfig>) => void
  quality: number
  setQuality: (v: number) => void
  format: string
  presets: TemplatePreset[]
  activePresetId: string | null
  onSelectPreset: (preset: TemplatePreset) => void
  onSavePreset: () => void
  onDeletePreset: () => void
  onClosePreset: () => void
  onInsertVariable: (varKey: string) => void
  onRemoveVariable: (index: number) => void
}) {
  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-7">
      {/* ─── 预设（Presets）─── 浅蓝强调 + 水平布局 */}
      <section className="p-3 md:p-4 rounded-xl border border-blue-200 bg-blue-50/50">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[13px] font-semibold text-text flex items-center gap-1.5">
            <span className="text-blue-500">💾</span>
            <span>预设</span>
            <span
              title="预设 = 一键应用整套配置（模板 + 字体 + 文字 + 颜色），保存后可复用"
              className="w-3.5 h-3.5 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold flex items-center justify-center cursor-help">
              ?
            </span>
          </h3>
          <span className="text-[10px] text-blue-500/70 font-mono font-semibold">{presets.length} 个</span>
        </div>
        <p className="text-[9px] text-blue-700/70 mb-2 leading-relaxed">
          一键应用整套配置 · 微调后可另存为新预设
        </p>
        {/* 水平布局：下拉（含关闭按钮） + 保存 + 删除 */}
        <div className="flex gap-1.5 items-stretch">
          <div className="relative flex-1 min-w-0">
            <select
              value={activePresetId ?? ''}
              onChange={e => {
                const id = e.target.value
                if (!id) {
                  // 选择 placeholder 时关闭预设高亮（不改 config）
                  onClosePreset()
                  return
                }
                const preset = presets.find(p => p.id === id)
                if (preset) onSelectPreset(preset)
              }}
              className="w-full px-2 py-1.5 pr-7 bg-surface border border-blue-200 rounded-md text-[11px] text-text outline-none focus:border-blue-400 transition-colors duration-fast"
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
            {/* 关闭预设按钮：仅在有激活预设时显示 */}
            {activePresetId && (
              <button
                type="button"
                onClick={() => onClosePreset()}
                title="关闭预设高亮（不改当前配置）"
                className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center text-[10px] font-bold leading-none transition-colors duration-fast">
                ×
              </button>
            )}
          </div>
          <button
            onClick={onSavePreset}
            title="保存当前配置为预设"
            className="px-2 py-1.5 text-[11px] rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors duration-fast whitespace-nowrap">
            + 保存
          </button>
          <button
            onClick={onDeletePreset}
            disabled={!activePresetId}
            title="删除所选预设"
            className="px-2 py-1.5 text-[11px] rounded-md border border-blue-200 text-text-2 hover:border-red-400 hover:text-red-500 transition-colors duration-fast disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
            删除
          </button>
        </div>
        {/* 激活预设效果预览卡片 */}
        {activePresetId && (() => {
          const active = presets.find(p => p.id === activePresetId)
          if (!active) return null
          const tpl = TEMPLATES.find(t => t.id === active.config.id)
          const fontLabel = FONT_FAMILIES.find(f => f.key === active.config.fontFamily)?.label || '宋体'
          return (
            <div className="mt-2 p-2 rounded-md bg-surface/70 border border-blue-200/50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-2">模板</span>
                <span className="text-[11px] text-text font-medium">
                  {tpl?.icon} {tpl?.name}
                </span>
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
                          {varDef?.icon ? `${varDef.icon} ${varDef.label}` : (varKey || token)}
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

      {/* ─── 模板（Templates）─── 白色中性 + 竖排网格 */}
      <section className="p-3 md:p-4 rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[13px] font-semibold text-text flex items-center gap-1.5">
            <span className="text-orange-500">🎨</span>
            <span>模板</span>
            <span
              title="模板 = 视觉结构（边框/布局/装饰），可叠加右侧参数微调"
              className="w-3.5 h-3.5 rounded-full bg-orange-100 text-orange-600 text-[9px] font-bold flex items-center justify-center cursor-help">
              ?
            </span>
          </h3>
          <span className="text-[10px] text-orange-500/70 font-mono font-semibold">{TEMPLATES.length} 个</span>
        </div>
        <p className="text-[9px] text-orange-700/70 mb-3 leading-relaxed">
          仅切换视觉结构 · 右侧参数可继续微调
        </p>
        <TemplateGrid selectedId={config.id} onSelect={id => onChange({ id } as any)} />
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
        <div className="grid grid-cols-5 gap-1.5">
          {FONT_FAMILIES.map(f => {
            const isActive = (config.fontFamily || 'noto-serif') === f.key
            // 预览文本：汉字 + 字母 + 数字，体现字体风格差异
            const sample = f.key === 'jetbrains' ? 'F/2.8'
              : f.key === 'wenkai' ? '签名'
              : f.key === 'noto-serif' ? '宋 Aa'
              : f.key === 'noto-sans' ? '黑 Aa'
              : 'Aa 1'
            return (
              <button key={f.key}
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

      {/* Custom text */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <SectionLabel>自定义文字</SectionLabel>
          <span className="text-[9px] text-text-3">点击下方标签添加</span>
        </div>
        {(() => {
          const tokens = parseCustomTextTokens(config.customText)
          const addedKeys = new Set(tokens.map(t => t.match(/^\{(.+)\}$/)?.[1]).filter(Boolean))
          return (<>
            <div className="w-full min-h-[38px] px-2 py-1.5 bg-canvas border border-border rounded-md flex flex-wrap gap-1.5 items-center">
              {tokens.length === 0
                ? <span className="text-[11px] text-text-3">暂未添加</span>
                : tokens.map((token, i) => {
                    const varKey = token.match(/^\{(.+)\}$/)?.[1]
                    const varDef = varKey ? TEXT_VARIABLES.find(v => v.key === varKey) : null
                    return (
                      <span key={`${token}-${i}`}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 text-[11px] text-text font-mono">
                        {varDef?.icon && <span className="text-[10px]">{varDef.icon}</span>}
                        <span>{varDef?.label || varKey || token}</span>
                        <button type="button"
                          onClick={() => onRemoveVariable(i)}
                          className="ml-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] text-text-3 hover:bg-red-100 hover:text-red-500 transition-colors duration-fast leading-none">
                          ×
                        </button>
                      </span>
                    )
                  })
              }
            </div>
            <p className="text-[9px] text-text-3 mt-1 mb-2 leading-relaxed">
              自动替换为照片实际拍摄信息
            </p>
            <div className="flex flex-wrap gap-1">
              {TEXT_VARIABLES.map(v => {
                const added = addedKeys.has(v.key)
                return (
                  <button
                    key={v.key}
                    onClick={() => onInsertVariable(v.key)}
                    title={`${added ? '再次插入' : '插入'}${v.label}（示例：${v.sample}）`}
                    className={`px-1.5 py-1 text-[10px] rounded border transition-colors duration-fast
                      ${added
                        ? 'border-accent/30 bg-accent/5 text-accent'
                        : 'border-border bg-surface text-text-2 hover:border-accent hover:bg-canvas-soft hover:text-text'}`}>
                    <span className="mr-0.5">{v.icon}</span>
                    <span>{v.label}</span>
                  </button>
                )
              })}
            </div>
          </>)
        })()}
      </section>

      {/* Location (only for location template) */}
      {config.id === 'location' && (
        <section>
          <SectionLabel>地点名</SectionLabel>
          <input
            type="text"
            value={config.locationName || ''}
            onChange={e => onChange({ locationName: e.target.value })}
            placeholder="如 北京·故宫 / 上海·外滩"
            className="w-full px-3 py-2 bg-canvas border border-border rounded-md text-[12px] text-text placeholder:text-text-3 outline-none focus:border-accent transition-colors duration-fast"/>
        </section>
      )}

      {/* Vintage-photo: timestamp position + color */}
      {config.id === 'vintage-photo' && (
        <>
          <section>
            <SectionLabel>时间戳位置</SectionLabel>
            <div className="grid grid-cols-3 gap-1 p-1 bg-canvas rounded-md">
              {([0, 1, 2, 3, 4, 5, 6, 7, 8] as const).map(p => (
                <button key={p}
                  onClick={() => onChange({ timestampPosition: p })}
                  className={`aspect-square rounded text-[10px] transition-all duration-fast
                    ${config.timestampPosition === p
                      ? 'bg-accent text-surface shadow-card'
                      : 'bg-surface text-text-3 border border-border hover:border-text-3'}`}>
                  {p + 1}
                </button>
              ))}
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>时间戳颜色</SectionLabel>
              <input
                type="color"
                value={config.timestampColor || '#ff3d00'}
                onChange={e => onChange({ timestampColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border border-border p-0"/>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {['#ff3d00', '#ff6b35', '#ffcc00', '#00ff88', '#00aaff', '#ff00aa'].map(c => (
                <button key={c}
                  onClick={() => onChange({ timestampColor: c })}
                  className={`aspect-square rounded border transition-all duration-fast
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
            <div className="segment w-full">
              <button data-active={config.embedLayout === 'v'}
                onClick={() => onChange({ embedLayout: 'v' })}
                className="flex-1">垂直</button>
              <button data-active={config.embedLayout === 'h'}
                onClick={() => onChange({ embedLayout: 'h' })}
                className="flex-1">水平</button>
            </div>
          </section>
          <section>
            <SectionLabel>位置（9 宫格）</SectionLabel>
            <div className="grid grid-cols-3 gap-1 p-1 bg-canvas rounded-md">
              {([0, 1, 2, 3, 4, 5, 6, 7, 8] as const).map(p => (
                <button key={p}
                  onClick={() => onChange({ embedPosition: p })}
                  className={`aspect-square rounded text-[10px] transition-all duration-fast
                    ${config.embedPosition === p
                      ? 'bg-accent text-surface shadow-card'
                      : 'bg-surface text-text-3 border border-border hover:border-text-3'}`}>
                  {p + 1}
                </button>
              ))}
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
              placeholder="如 Photo Frame / 摄影师名字"
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
// Template grid (4 columns of minimal thumbnails)
// ═══════════════════════════════════════════════════════
function TemplateGrid({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-3">
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
                  onClick={() => onSelect(t.id)}
                  className={`rounded-lg border transition-all duration-fast overflow-hidden
                    ${selectedId === t.id
                      ? 'border-accent bg-surface shadow-card ring-2 ring-accent/10'
                      : 'border-border bg-surface hover:border-text-3 hover:shadow-card'
                    }`}
                  title={t.name + ' · ' + t.desc}>
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

// Template thumbnail — larger preview area + embedded name + hint
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

// Pure visual preview of each template (no labels, just the aesthetic)
function TemplatePreview({ id }: { id: string }) {
  // 模拟照片：渐变色块
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
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
          </div>
          <div className="flex-1 mx-1.5" style={{ background: photoGradient }}/>
          <div className="flex justify-around py-0.5">
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
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
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
          </div>
          <div className="mx-1.5 h-5" style={{ background: photoGradient }}/>
          <div className="flex justify-around px-0.5">
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
            <div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/>
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
            <div className="text-[4px]">📕</div>
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
            <div className="text-[3px] text-white">📍 北京·故宫</div>
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
                  <div key={j} className="text-[2px] text-white whitespace-nowrap">Photo Frame</div>
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
    <div className="p-4 md:p-6">
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
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12px] text-text font-medium">{label}</span>
        <span className="font-mono text-[11px] text-text-2 tabular-nums">
          {Number.isInteger(step) ? value : value.toFixed(1)}{suffix}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
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
            className="w-5 h-5 rounded cursor-pointer bg-transparent border border-border p-0"/>
        </div>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {presets.map(c => (
          <button key={c} onClick={() => onChange(c)}
            className={`aspect-square rounded border transition-all duration-fast
              ${value.toLowerCase() === c.toLowerCase() ? 'border-accent scale-110 shadow-card' : 'border-border hover:scale-105'}`}
            style={{ background: c }}/>
        ))}
      </div>
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[12px] text-text">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-8 h-[18px] rounded-full transition-colors duration-fast ${value ? 'bg-accent' : 'bg-border-strong'}`}>
        <div className={`absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full shadow transition-transform duration-fast
          ${value ? 'translate-x-[15px]' : 'translate-x-[2px]'}`}/>
      </button>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="p-6 text-center text-[12px] text-text-3">{label}</div>
}
