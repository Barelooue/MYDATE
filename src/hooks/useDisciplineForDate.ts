import { normalizeDisciplineLocks } from '@/lib/disciplineMode'
import { useAppStore } from '@/stores/appStore'

export function useDisciplineForDate(date: string) {
  const disciplineModeEnabled = useAppStore((s) => s.disciplineModeEnabled)
  const lock = useAppStore((s) => normalizeDisciplineLocks(s.disciplineLocks)[date])
  const locked = Boolean(lock)
  const lockPlanForDate = useAppStore((s) => s.lockPlanForDate)
  const isDatePlanLocked = useAppStore((s) => s.isDatePlanLocked)

  return {
    disciplineModeEnabled,
    locked,
    lockedAt: lock?.lockedAt,
    isImmutable: locked,
    lockPlanForDate: () => lockPlanForDate(date),
    isDatePlanLocked: () => isDatePlanLocked(date),
  }
}
