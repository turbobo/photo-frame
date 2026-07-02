import type { TemplateConfig } from '../types'

interface Props {
  config: TemplateConfig
  onChange: (c: TemplateConfig) => void
}

const PRESET_COLORS = ['#ffffff', '#f5f5f5', '#111111', '#1c1c1e', '#0f172a', '#fefdf7', '#f97316', '#38bdf8']

export default function TemplateEditor({ config, onChange }: Props) {
  const patch = (p: Partial<TemplateConfig>) => onChange({ ...config, ...p })

  return (
    <div className="p-4 space-y-5 fade-in">
      {/* 边距 */}
      <Field label="边距" value={`${config.padding}%`}>
        <input
          type="range" min={0} max={20} step={0.5}
          value={config.padding}
          onChange={e => patch({ padding: Number(e.target.value) })}
          className="w-full"/>
      </Field>

      {/* 字号 */}
      <Field label="字号" value={`${config.fontSize.toFixed(1)}%`}>
        <input
          type="range" min={1} max={5} step={0.1}
          value={config.fontSize}
          onChange={e => patch({ fontSize: Number(e.target.value) })}
          className="w-full"/>
      </Field>

      {/* 圆角 */}
      <Field label="圆角" value={`${config.radius}px`}>
        <input
          type="range" min={0} max={80} step={1}
          value={config.radius}
          onChange={e => patch({ radius: Number(e.target.value) })}
          className="w-full"/>
      </Field>

      {/* 背景色 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-slate-400">背景</span>
          <input
            type="color" value={config.bgColor}
            onChange={e => patch({ bgColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer bg-transparent border border-slate-700"/>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {PRESET_COLORS.map(c => (
            <button key={c}
              onClick={() => patch({ bgColor: c })}
              className={`h-6 rounded border transition-all ${config.bgColor === c ? 'ring-2 ring-sky-400 border-transparent scale-110' : 'border-slate-700'}`}
              style={{ background: c }}/>
          ))}
        </div>
      </div>

      {/* 文字色 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-slate-400">文字</span>
          <input
            type="color" value={config.textColor}
            onChange={e => patch({ textColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer bg-transparent border border-slate-700"/>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-4 space-y-3">
        <Toggle label="显示品牌 Logo" value={config.showLogo} onChange={v => patch({ showLogo: v })}/>
        <Toggle label="显示 EXIF" value={config.showExif} onChange={v => patch({ showExif: v })}/>
        <Toggle label="卡片阴影" value={config.shadow} onChange={v => patch({ shadow: v })}/>
      </div>

      {/* 自定义文字 */}
      <div>
        <p className="text-[12px] text-slate-400 mb-1.5">自定义文字（覆盖默认）</p>
        <input
          type="text"
          value={config.customText}
          onChange={e => patch({ customText: e.target.value })}
          placeholder="如 摄影师 / 地点 / 日期"
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-[13px] text-slate-200 outline-none focus:border-sky-500 transition-colors"/>
      </div>
    </div>
  )
}

function Field({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-slate-400">{label}</span>
        <span className="text-[12px] font-mono text-sky-400">{value}</span>
      </div>
      {children}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-slate-300">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-sky-500' : 'bg-slate-700'}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`}/>
      </button>
    </div>
  )
}
