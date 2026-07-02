import { useState } from 'react'
import type { PhotoData, TemplateConfig } from '../types'
import { TEMPLATES, TEMPLATE_GROUPS } from '../templates'
import { renderFrame } from '../utils/canvas'

interface Props {
  photo: PhotoData | null
  config: TemplateConfig
  onChange: (c: TemplateConfig) => void
  logo: HTMLImageElement | null
  onReplace?: (f: File) => void
  loading?: boolean
}

type Tab = 'style' | 'info'

export default function ControlPanel({ photo, config, onChange, logo, onReplace, loading }: Props) {
  const [tab, setTab] = useState<Tab>('style')

  // 导出状态（独立于 tab，跨 tab 保持）
  const [size, setSize] = useState('orig')
  const [format, setFormat] = useState('jpeg')
  const [quality, setQuality] = useState(0.92)
  const [busy, setBusy] = useState(false)

  const patch = (p: Partial<TemplateConfig>) => onChange({ ...config, ...p })

  const handleExport = async () => {
    if (!photo) return
    setBusy(true)
    try {
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

  return (
    <div className="flex flex-col md:h-full">
      {/* Tabs */}
      <div className="px-4 md:px-6 pt-4 md:pt-5 pb-3 md:pb-4 border-b border-border shrink-0">
        <div className="segment w-full">
          <button data-active={tab === 'style'} onClick={() => setTab('style')}>样式</button>
          <button data-active={tab === 'info'}  onClick={() => setTab('info')}>信息</button>
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
      <div className="md:flex-1 md:overflow-y-auto">
        {tab === 'style' && <StylePanel config={config} onChange={patch} quality={quality} setQuality={setQuality} format={format} />}
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
      </div>
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

// ═══════════════════════════════════════════════════════
// Style Tab
// ═══════════════════════════════════════════════════════
function StylePanel({
  config, onChange, quality, setQuality, format,
}: {
  config: TemplateConfig
  onChange: (p: Partial<TemplateConfig>) => void
  quality: number
  setQuality: (v: number) => void
  format: string
}) {
  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-7">
      {/* Templates grid */}
      <section>
        <SectionLabel>模板</SectionLabel>
        <TemplateGrid selectedId={config.id} onSelect={id => onChange({ id } as any)} />
      </section>

      {/* Dimensions */}
      <section className="space-y-4">
        <SectionLabel>尺寸</SectionLabel>

        <RangeRow label="边距" value={config.padding} min={2} max={20} step={0.5}
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

      {/* Quality (only for lossy formats) */}
      {format !== 'png' && (
        <section>
          <RangeRow label="质量" value={Math.round(quality * 100)} min={50} max={100} step={2}
            suffix="%" onChange={v => setQuality(v / 100)} />
        </section>
      )}

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
            <div className="grid grid-cols-2 gap-2">
              {items.map(t => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className={`relative rounded-lg border transition-all duration-fast group overflow-hidden
                    ${selectedId === t.id
                      ? 'border-accent bg-surface shadow-card ring-2 ring-accent/10'
                      : 'border-border bg-surface hover:border-text-3 hover:shadow-card'
                    }`}
                  title={t.name + ' · ' + t.desc}>
                  <TemplateThumb id={t.id} selected={selectedId === t.id} />
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
function TemplateThumb({ id, selected }: { id: string; selected: boolean }) {
  const meta: Record<string, { name: string; hint: string }> = {
    minimal:  { name: '极简',     hint: '白/黑边 + 底部小字' },
    polaroid: { name: '拍立得',   hint: '经典上下等宽白边' },
    film:     { name: '胶片',     hint: '黑框齿孔 + 编号' },
    exif:     { name: '参数栏',   hint: 'Logo + 光圈快门 ISO' },
    insta:    { name: '社交卡片', hint: '毛玻璃 + 圆角 + 阴影' },
    leica:    { name: '徕卡栏',   hint: '底部黑栏 + 红点 + 型号' },
    'red-dot':{ name: '红点水印', hint: '右下角悬浮红点 + 参数' },
    dazz:     { name: 'Dazz 胶卷',hint: '135 胶卷边框 + 日期印字' },
    instax:   { name: 'Instax',   hint: '真实拍立得比例 + 大留白' },
    xhs:      { name: '小红书',   hint: '3:4 白底卡片 + 标题描述' },
    vintage:  { name: '复古纸相框', hint: '牛皮纸纹理 + 做旧边' },
    magazine: { name: '杂志封面', hint: '顶部大标题 + 底部 caption' },
    location: { name: '地理水印', hint: 'Logo + 型号 + 📍地名' },
  }
  const m = meta[id] || { name: id, hint: '' }

  return (
    <div className="flex flex-col">
      {/* Preview area (4:3 aspect) */}
      <div className="aspect-[4/3] w-full relative flex items-center justify-center bg-canvas-soft">
        <TemplatePreview id={id} />
      </div>
      {/* Name + hint */}
      <div className="px-2 py-1.5 bg-surface">
        <div className={`text-[11px] font-medium truncate ${selected ? 'text-text' : 'text-text-2'}`}>
          {m.name}
        </div>
        <div className="text-[9px] text-text-3 truncate leading-tight">
          {m.hint}
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
