import type { BatchProgress } from '../utils/batchExport'

interface Props {
  progress: BatchProgress
  onCancel: () => void
}

export default function BatchProgressModal({ progress, onCancel }: Props) {
  const { current, total, currentName, completedCount, failedCount, startedAt } = progress
  const done = completedCount + failedCount
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  let eta = ''
  if (done > 0 && done < total) {
    const elapsed = Date.now() - startedAt
    const remaining = Math.round((elapsed / done) * (total - done) / 1000)
    eta = remaining >= 60
      ? `约 ${Math.floor(remaining / 60)} 分 ${remaining % 60} 秒`
      : `约 ${remaining} 秒`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-surface rounded-xl shadow-elev w-[340px] p-5 space-y-4">
        <div>
          <h3 className="text-[14px] font-medium text-text">批量导出中</h3>
          <p className="text-[11px] text-text-2 mt-0.5 truncate" title={currentName}>
            {currentName}
          </p>
        </div>

        <div>
          <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-accent h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] text-text-2 font-mono tabular-nums">
              {done} / {total}
            </span>
            {eta && (
              <span className="text-[10px] text-text-3">{eta}</span>
            )}
          </div>
        </div>

        {failedCount > 0 && (
          <div className="text-[11px] text-amber-600 bg-amber-50 rounded-md px-2.5 py-1.5">
            {failedCount} 个文件处理失败
          </div>
        )}

        <button
          onClick={onCancel}
          className="btn-outline w-full py-2 rounded-md text-[12px] font-medium">
          取消
        </button>
      </div>
    </div>
  )
}
