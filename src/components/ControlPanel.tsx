import { useState } from 'react'
import type { PhotoData, TemplateConfig } from '../types'
import { TEMPLATES, TEMPLATE_GROUPS } from '../templates'

interface Props {
  photo: PhotoData | null
  config: TemplateConfig
  onChange: (c: TemplateConfig) => void
  logo: HTMLImageElement | null
  onReplace?: (f: File) => void
  loading?: boolean
}

type Tab = 'style' | 'info' | 'export'

export default function ControlPanel({ photo, config, onChange, logo, onReplace, loading }: Props) {
  const [tab, setTab] = useState<Tab>('style')

  const patch = (p: Partial<TemplateConfig>) => onChange({ ...config, ...p })

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="segment w-full">
          <button data-active={tab === 'style'}  onClick={() => setTab('style')}>样式</button>
          <button data-active={tab === 'info'}   onClick={() => setTab('info')}>信息</button>
          <button data-active={tab === 'export'} onClick={() => setTab('export')}>导出</button>
          {onReplace && (
            <button
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.cr2,.cr3,.nef,.arw,.raf,.rw2,.orf,.pef,.dng,image/*'
                input.onchange = e => {
                  const f = (e.target as HTMLInputElement).files?.[0]
                  if (f) onReplace(f)
                }
                input.click()
              }}
              className="ml-auto text-text-3 hover:text-text"
              title="更换照片"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/>
                <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/>
                <polyline points="3 22 3 16 9 16"/>
                <polyline points="21 2 21 8 15 8"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'style' && <StylePanel config={config} onChange={patch} />}
        {tab === 'info'   && <InfoPanel photo={photo} />}
        {tab === 'export' && <ExportPanel photo={photo} config={config} logo={logo} />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Style Tab
// ═══════════════════════════════════════════════════════
function StylePanel({ config, onChange }: { config: TemplateConfig; onChange: (p: Partial<TemplateConfig>) => void }) {
  return (
    <div className="p-6 space-y-7">
      {/* Templates grid */}
      <section>
        <SectionLabel>模板</SectionLabel>
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

      {/* Toggles */}
      <section className="space-y-2">
        <SectionLabel>选项</SectionLabel>
        <ToggleRow label="品牌 Logo" value={config.showLogo} onChange={v => onChange({ showLogo: v })} />
        <ToggleRow label="EXIF 信息" value={config.showExif} onChange={v => onChange({ showExif: v })} />
        <ToggleRow label="卡片阴影" value={config.shadow} onChange={v => onChange({ shadow: v })} />
      </section>

      {/* Custom text */}
      <section>
        <SectionLabel>自定义文字</SectionLabel>
        <input
          type="text"
          value={config.customText}
          onChange={e => onChange({ customText: e.target.value })}
          placeholder="摄影师 · 地点 · 日期"
          className="w-full px-3 py-2 bg-canvas border border-border rounded-md text-[12px] text-text placeholder:text-text-3 outline-none focus:border-accent transition-colors duration-fast"/>
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
            <p className="font-caption text-text-3 mb-2">{group.name}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {items.map(t => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className={`relative aspect-square rounded-md border transition-all duration-fast group
                    ${selectedId === t.id
                      ? 'border-accent bg-surface shadow-card'
                      : 'border-border bg-canvas hover:border-text-3'
                    }`}
                  title={t.name + ' · ' + t.desc}>
                  {/* Miniature preview illustration */}
                  <TemplateThumb id={t.id} />
                  {/* Name */}
                  <div className="absolute inset-x-0 bottom-0 text-[9px] py-0.5 text-center truncate bg-white/80 backdrop-blur">
                    <span className={selectedId === t.id ? 'text-text font-medium' : 'text-text-2'}>
                      {t.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Minimalist thumbnail — stylized abstract illustration of each template
function TemplateThumb({ id }: { id: string }) {
  const common = 'absolute inset-0 flex items-center justify-center'
  switch (id) {
    case 'minimal':
      return <div className={common}><div className="w-6 h-4 bg-border rounded-sm"/></div>
    case 'polaroid':
      return <div className={common}><div className="w-5 h-6 bg-white border border-border rounded-sm"><div className="w-3 h-3 bg-border mt-1 mx-auto"/></div></div>
    case 'film':
      return <div className={common}><div className="w-7 h-5 bg-black rounded-sm relative"><div className="absolute inset-x-0 top-0.5 h-0.5 bg-white/30"/><div className="absolute inset-x-0 bottom-0.5 h-0.5 bg-white/30"/></div></div>
    case 'exif':
      return <div className={common}><div className="w-6 h-5 bg-border rounded-sm relative"><div className="absolute bottom-0 inset-x-0 h-1.5 bg-black rounded-b-sm"/></div></div>
    case 'insta':
      return <div className={common}><div className="w-6 h-6 bg-white border border-border rounded-md shadow-sm"/></div>
    case 'leica':
      return <div className={common}><div className="w-6 h-5 bg-border rounded-sm relative"><div className="absolute bottom-0 inset-x-0 h-1.5 bg-black rounded-b-sm flex items-center justify-start pl-0.5"><div className="w-0.5 h-0.5 rounded-full bg-red-500"/></div></div></div>
    case 'red-dot':
      return <div className={common}><div className="w-5 h-4 bg-border rounded-sm relative"><div className="absolute bottom-0 right-0 w-1 h-1 rounded-full bg-red-500 m-0.5"/></div></div>
    case 'dazz':
      return <div className={common}><div className="w-6 h-5 bg-black rounded-sm relative flex flex-col justify-between py-0.5"><div className="flex justify-around"><div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/><div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/><div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/></div><div className="w-3 h-2 bg-border mx-auto rounded-sm"/><div className="flex justify-around"><div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/><div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/><div className="w-0.5 h-0.5 bg-white/40 rounded-sm"/></div></div></div>
    case 'instax':
      return <div className={common}><div className="w-5 h-6 bg-white border border-border rounded-sm"><div className="w-3 h-3 bg-border mt-0.5 mx-auto"/><div className="w-4 h-1 border-t border-border mt-1 mx-auto"/></div></div>
    case 'xhs':
      return <div className={common}><div className="w-5 h-6 bg-white border border-border rounded-md shadow-sm relative"><div className="absolute top-0.5 left-0.5 text-[5px] text-red-500">📕</div></div></div>
    case 'vintage':
      return <div className={common}><div className="w-6 h-5 rounded-sm border border-amber-700/40" style={{background:'#d4b896'}}><div className="w-4 h-3 bg-border/70 mx-auto mt-1"/></div></div>
    case 'magazine':
      return <div className={common}><div className="w-5 h-6 bg-white border border-border rounded-sm flex flex-col"><div className="h-1 border-b border-border flex items-center justify-center text-[4px] font-bold text-text-3">P</div><div className="flex-1 bg-border/50 m-0.5"/><div className="h-1 border-t border-border"/></div></div>
    case 'location':
      return <div className={common}><div className="w-6 h-5 bg-border rounded-sm relative"><div className="absolute bottom-0 inset-x-0 h-1.5 bg-black rounded-b-sm flex items-center justify-end pr-0.5 text-[5px]">📍</div></div></div>
    default:
      return <div className={common}><div className="w-6 h-4 bg-border rounded-sm"/></div>
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
    <div className="p-6">
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
// Export Tab
// ═══════════════════════════════════════════════════════
import { renderFrame } from '../utils/canvas'

const SIZE_OPTIONS = [
  { key: 'orig', label: '原图', longEdge: 0 },
  { key: '3840', label: '4K', longEdge: 3840 },
  { key: '2048', label: '2K', longEdge: 2048 },
  { key: '1080', label: '1080', longEdge: 1080 },
]
const FORMATS = [
  { key: 'jpeg', label: 'JPG', mime: 'image/jpeg' },
  { key: 'png',  label: 'PNG', mime: 'image/png' },
  { key: 'webp', label: 'WebP', mime: 'image/webp' },
]

function ExportPanel({ photo, config, logo }: { photo: PhotoData | null; config: TemplateConfig; logo: HTMLImageElement | null }) {
  const [size, setSize] = useState('orig')
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
        const s = opt.longEdge / Math.max(source.width, source.height)
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
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ext = format === 'jpeg' ? 'jpg' : format
      const base = photo.originalName.replace(/\.[^.]+$/, '')
      a.href = url; a.download = `${base}-${config.id}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } finally { setBusy(false) }
  }

  if (!photo) return <EmptyState label="先上传一张照片" />

  return (
    <div className="p-6 space-y-6">
      <section>
        <SectionLabel>尺寸</SectionLabel>
        <div className="segment w-full">
          {SIZE_OPTIONS.map(o => (
            <button key={o.key} data-active={size === o.key}
              onClick={() => setSize(o.key)}
              className="flex-1">{o.label}</button>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>格式</SectionLabel>
        <div className="segment w-full">
          {FORMATS.map(f => (
            <button key={f.key} data-active={format === f.key}
              onClick={() => setFormat(f.key)}
              className="flex-1">{f.label}</button>
          ))}
        </div>
      </section>

      {format !== 'png' && (
        <section>
          <RangeRow label="质量" value={Math.round(quality * 100)} min={50} max={100} step={2}
            suffix="%" onChange={v => setQuality(v / 100)} />
        </section>
      )}

      <button
        onClick={handleExport}
        disabled={busy}
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
            下载 {format.toUpperCase()}
          </>
        )}
      </button>
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
  const presets = ['#ffffff', '#f5f5f5', '#fafaf9', '#1c1917', '#18181b', '#0f172a', '#d4b896', '#f97316']
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
