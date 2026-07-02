import { TEMPLATES } from '../templates'
import type { TemplateId } from '../types'

interface Props {
  selectedId: TemplateId
  onSelect: (id: TemplateId) => void
}

export default function TemplateSelector({ selectedId, onSelect }: Props) {
  return (
    <div className="p-3 space-y-2">
      <div className="px-2 pt-1 pb-2">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">模板</p>
      </div>
      {TEMPLATES.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`w-full text-left px-3 py-3 rounded-xl border transition-all
            ${selectedId === t.id
              ? 'border-sky-400/60 bg-sky-500/10 shadow-inner shadow-sky-500/10'
              : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
            }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{t.icon}</span>
            <span className={`text-[13px] font-medium ${selectedId === t.id ? 'text-sky-300' : 'text-slate-200'}`}>
              {t.name}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">{t.desc}</p>
        </button>
      ))}
    </div>
  )
}
