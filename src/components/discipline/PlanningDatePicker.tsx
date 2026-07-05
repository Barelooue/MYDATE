import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, isValid, parseISO } from 'date-fns'
import { useAppStore } from '@/stores/appStore'
import { cn, formatDateKey } from '@/lib/utils'
import {
  formatPlanningDateLabel,
  isTodayDateKey,
  normalizeDisciplineLocks,
} from '@/lib/disciplineMode'

interface PlanningDatePickerProps {
  className?: string
}

export function PlanningDatePicker({ className }: PlanningDatePickerProps) {
  const selectedDate = useAppStore((s) => s.selectedDate)
  const setSelectedDate = useAppStore((s) => s.setSelectedDate)
  const isLocked = useAppStore((s) =>
    Boolean(normalizeDisciplineLocks(s.disciplineLocks)[selectedDate]),
  )

  const dateInputValue = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
    ? selectedDate
    : formatDateKey(new Date())

  function shiftDays(delta: number) {
    const base = parseISO(`${dateInputValue}T12:00:00`)
    if (!isValid(base)) {
      setSelectedDate(formatDateKey(new Date()))
      return
    }
    setSelectedDate(formatDateKey(addDays(base, delta)))
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2',
        className,
      )}
    >
      <span className="text-[10px] text-zinc-500">规划日期</span>
      <button
        type="button"
        onClick={() => shiftDays(-1)}
        className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
        aria-label="前一天"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <input
        type="date"
        value={dateInputValue}
        onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
        className="rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-1 text-sm text-white outline-none focus:border-accent-500/50"
      />
      <button
        type="button"
        onClick={() => shiftDays(1)}
        className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
        aria-label="后一天"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <span className="text-xs text-zinc-400">
        {formatPlanningDateLabel(selectedDate)}
        {isTodayDateKey(selectedDate) && isLocked && (
          <span className="ml-1 text-amber-400">· 已锁定</span>
        )}
      </span>
      <button
        type="button"
        onClick={() => setSelectedDate(formatDateKey(new Date()))}
        className="ml-auto rounded-lg px-2 py-1 text-[10px] text-zinc-400 transition hover:bg-white/10 hover:text-white"
      >
        回到今天
      </button>
    </div>
  )
}
