import type { Task } from '@/types'
import { formatDateKey } from '@/lib/utils'

export interface DisciplineLock {
  lockedAt: string
}

export const DISCIPLINE_LOCK_MSG =
  '今日计划已锁定（自律模式）：仅可标记完成，无法修改、删除或重新规划。'

export const DISCIPLINE_CANNOT_DISABLE_TODAY_MSG =
  '自律模式已在今日开启，当天内不可手动关闭，将于次日 0 点自动关闭。'

/** 开启当日不可再关闭自律模式（按自然日，非开启后 24 小时） */
export function isDisciplineDisableBlockedToday(enabledOnDate: string | null): boolean {
  if (!enabledOnDate) return false
  return enabledOnDate === getTodayDateKey()
}

/** 开启日已过自然日 0 点 → 自律模式应自动关闭（保留历史日期的计划锁定） */
export function isDisciplineModeExpiredForCalendarDay(
  enabled: boolean,
  enabledOnDate: string | null,
): boolean {
  if (!enabled) return false
  if (!enabledOnDate) return true
  return enabledOnDate < getTodayDateKey()
}

export function applyDisciplineCalendarDaySync<
  T extends {
    disciplineModeEnabled: boolean
    disciplineModeEnabledOnDate: string | null
    disciplineLocks: Record<string, DisciplineLock> | null | undefined
  },
>(state: T): T {
  if (!isDisciplineModeExpiredForCalendarDay(state.disciplineModeEnabled, state.disciplineModeEnabledOnDate)) {
    return state
  }
  return {
    ...state,
    disciplineModeEnabled: false,
    disciplineModeEnabledOnDate: null,
    disciplineLocks: pruneFutureDisciplineLocks(state.disciplineLocks),
  }
}

/** 锁定后仅允许更新任务状态，且不可从「已完成」改回待办 */
export function canPatchTaskWhenLocked(patch: Partial<Task>, task: Task): boolean {
  const keys = Object.keys(patch) as (keyof Task)[]
  if (keys.length === 0) return false
  if (keys.some((k) => k !== 'status')) return false
  if (patch.status === 'pending' && task.status === 'completed') return false
  if (patch.status && !['pending', 'in-progress', 'completed'].includes(patch.status)) {
    return false
  }
  return true
}

export function normalizeDisciplineLocks(
  locks: Record<string, DisciplineLock> | null | undefined,
): Record<string, DisciplineLock> {
  if (!locks || typeof locks !== 'object') return {}
  return locks
}

export function isPlanLocked(
  locks: Record<string, DisciplineLock> | null | undefined,
  date: string,
): boolean {
  return Boolean(normalizeDisciplineLocks(locks)[date])
}

export function getTodayDateKey(): string {
  return formatDateKey(new Date())
}

export function isTodayDateKey(dateKey: string): boolean {
  return dateKey === getTodayDateKey()
}

export function isFutureDateKey(dateKey: string): boolean {
  return dateKey > getTodayDateKey()
}

/** 自律模式下仅允许锁定「今天」 */
export function canLockDateUnderDiscipline(
  dateKey: string,
  disciplineEnabled: boolean,
): boolean {
  if (!disciplineEnabled) return true
  return isTodayDateKey(dateKey)
}

export function shouldAutoLockOnApply(
  resultDate: string,
  disciplineEnabled: boolean,
): boolean {
  return disciplineEnabled && isTodayDateKey(resultDate)
}

export function pruneFutureDisciplineLocks(
  locks: Record<string, DisciplineLock> | null | undefined,
): Record<string, DisciplineLock> {
  const today = getTodayDateKey()
  return Object.fromEntries(
    Object.entries(normalizeDisciplineLocks(locks)).filter(([date]) => date <= today),
  )
}

export function formatPlanningDateLabel(dateKey: string): string {
  if (isTodayDateKey(dateKey)) return '今天'
  const d = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateKey
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

export function formatLockedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
