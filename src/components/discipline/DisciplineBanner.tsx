import { CalendarDays, Lock, Shield } from 'lucide-react'
import {
  formatLockedAt,
  formatPlanningDateLabel,
  isFutureDateKey,
  isTodayDateKey,
} from '@/lib/disciplineMode'

interface DisciplineBannerProps {
  planningDate: string
  locked: boolean
  disciplineEnabled: boolean
  lockedAt?: string
  onLock?: () => void
  canLock?: boolean
}

export function DisciplineBanner({
  planningDate,
  locked,
  disciplineEnabled,
  lockedAt,
  onLock,
  canLock,
}: DisciplineBannerProps) {
  if (!disciplineEnabled && !locked) return null

  const dateLabel = formatPlanningDateLabel(planningDate)
  const viewingFuture = isFutureDateKey(planningDate)

  if (locked) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1 text-xs leading-relaxed text-amber-100">
          <p className="font-semibold text-amber-200">
            自律模式 · {dateLabel}计划已锁定
          </p>
          <p className="mt-1 text-amber-100/90">
            该日任务内容与时间不可再改，请按计划执行；你仍可在看板中勾选「已完成」。
            {viewingFuture ? null : (
              <span className="block mt-1 text-amber-200/80">
                可在日历或下方切换日期，继续规划之后几天。
              </span>
            )}
            {lockedAt && (
              <span className="block mt-1 text-amber-200/70">
                锁定于 {formatLockedAt(lockedAt)}
              </span>
            )}
          </p>
        </div>
      </div>
    )
  }

  if (viewingFuture) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3">
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
        <p className="text-xs leading-relaxed text-teal-100">
          <span className="font-semibold text-teal-200">正在规划 {dateLabel}</span>
          <span className="text-teal-100/90">
            {' '}
            — 未来日期可自由添加任务与 AI 排程。自律模式仅限制「今天」锁定后的计划不可改。
          </span>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
        <p className="text-xs leading-relaxed text-violet-100">
          <span className="font-semibold text-violet-200">自律模式已开启</span>
          <span className="text-violet-100/90">
            {' '}
            — 今日内不可手动关闭（次日 0 点自动关闭）。仅「今天」同步或锁定后不可再改；之后几天可在日历中点选后继续规划。
          </span>
        </p>
      </div>
      {canLock && onLock && isTodayDateKey(planningDate) && (
        <button
          type="button"
          onClick={onLock}
          className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500"
        >
          锁定今日计划
        </button>
      )}
    </div>
  )
}
