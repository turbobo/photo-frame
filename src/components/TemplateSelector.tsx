import { TEMPLATES, TEMPLATE_GROUPS } from '../templates'
import type { TemplateId } from '../types'

interface Props {
  selectedId: TemplateId
  onSelect: (id: TemplateId) => void
}

export default function TemplateSelector({ selectedId, onSelect }: Props) {
  return (
    <div className="p-3 space-y-4">
      <div className="px-2 pt-1 pb-1">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          模板 · {TEMPLATES.length} 种
        </p>
      </div>

      {TEMPLATE_GROUPS.map(group => {
        const groupTemplates = TEMPLATES.filter(t => t.group === group.id)
        if (groupTemplates.length === 0) return null
        return (
          <div key={group.id}>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
              {group.name}
            </p>
            <div className="space-y-1.5">
              {groupTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all
                    ${selectedId === t.id
                      ? 'border-sky-400/60 bg-sky-500/10 shadow-inner shadow-sky-500/10'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
                    }`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-base">{t.icon}</span>
                    <span className={`text-[12px] font-medium ${selectedId === t.id ? 'text-sky-300' : 'text-slate-200'}`}>
                      {t.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
