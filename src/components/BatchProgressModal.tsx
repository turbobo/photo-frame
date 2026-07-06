import type { BatchProgress } from '../utils/batchExport'

interface Props {
  progress: BatchProgress
  onCancel: () => void
  templateName?: string
  format?: string
  quality?: number
}

export default function BatchProgressModal({
  progress,
  onCancel,
  templateName,
  format,
  quality,
}: Props) {
  const { current, total, currentName, completedCount, failedCount, startedAt } = progress
  const done = completedCount + failedCount
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const isComplete = done >= total && total > 0

  let eta = ''
  if (done > 0 && done < total) {
    const elapsed = Date.now() - startedAt
    const remaining = Math.round((elapsed / done) * (total - done) / 1000)
    eta = remaining >= 60
      ? `${Math.floor(remaining / 60)}分${remaining % 60}秒`
      : `${remaining}秒`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-xl shadow-elev border border-border w-full max-w-[360px] overflow-hidden">
        {/* 头部：标题 + 当前文件 */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isComplete && (
                <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-text border-t-transparent animate-spin" />
              )}
              {isComplete && failedCount === 0 && (
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
              {isComplete && failedCount > 0 && (
                <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="8" x2="12" y2="13" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
              )}
              <h3 className="text-[14px] font-semibold text-text">
                {isComplete
                  ? failedCount === 0
                    ? '导出完成'
                    : '导出完成（部分失败）'
                  : '批量导出中'}
              </h3>
            </div>
            <span className="text-[20px] font-semibold text-text tabular-nums">
              {pct}%
            </span>
          </div>
          {currentName && !isComplete && (
            <p className="text-[11px] text-text-2 mt-2 truncate font-mono" title={currentName}>
              {currentName}
            </p>
          )}
        </div>

        {/* 进度条 */}
        <div className="px-5 py-4">
          <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                isComplete
                  ? failedCount === 0
                    ? 'bg-green-500'
                    : 'bg-amber-500'
                  : 'bg-text'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-text-2 font-mono tabular-nums">
              {done} / {total}
            </span>
            {eta && !isComplete && (
              <span className="text-[10px] text-text-3">
                剩余 {eta}
              </span>
            )}
            {isComplete && (
              <span className={`text-[10px] font-medium ${
                failedCount === 0 ? 'text-green-600' : 'text-amber-600'
              }`}>
                {failedCount === 0 ? '全部成功' : `${completedCount} 成功 · ${failedCount} 失败`}
              </span>
            )}
          </div>
        </div>

        {/* 导出摘要 */}
        <div className="px-5 pb-4">
          <div className="bg-canvas rounded-lg p-3 space-y-1.5">
            {templateName && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-2">模板</span>
                <span className="text-text font-medium">{templateName}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-text-2">格式</span>
              <span className="text-text font-medium font-mono">
                {format?.toUpperCase() || 'JPG'}
                {format !== 'png' && quality && (
                  <span className="text-text-3 ml-1">({Math.round(quality * 100)}%)</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-text-2">数量</span>
              <span className="text-text font-medium font-mono">{total} 张</span>
            </div>
          </div>
        </div>

        {/* 失败详情 */}
        {failedCount > 0 && isComplete && (
          <div className="px-5 pb-4">
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <div className="font-medium mb-1">⚠️ {failedCount} 个文件处理失败</div>
              <div className="text-[10px] text-amber-600">
                可能原因：文件格式不支持、文件损坏、内存不足
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="px-5 pb-5">
          <button
            onClick={onCancel}
            className={`w-full py-2 rounded-lg text-[12px] font-medium transition-colors ${
              isComplete
                ? 'btn-primary'
                : 'btn-outline'
            }`}>
            {isComplete ? '关闭' : '取消导出'}
          </button>
        </div>
      </div>
    </div>
  )
}
