import type { TaskPriority } from '@/types'

/**
 * Eisenhower Matrix + Time Urgency Weight Model
 *
 * Score = W1 × Importance + W2 × Urgency + W3 × TimePressure
 *
 * - Importance (1-5): user-defined task significance
 * - Urgency (1-5): user-defined deadline pressure
 * - TimePressure: derived from estimated duration vs remaining day hours
 */
const WEIGHTS = {
  importance: 0.4,
  urgency: 0.35,
  timePressure: 0.25,
} as const

export function classifyPriority(importance: number, urgency: number): TaskPriority {
  const highImportance = importance >= 4
  const highUrgency = urgency >= 4

  if (highImportance && highUrgency) return 'urgent-important'
  if (highImportance) return 'important'
  if (highUrgency) return 'urgent'
  return 'low'
}

export function computeTimePressure(
  estimatedMinutes: number,
  remainingMinutesInDay: number,
): number {
  if (remainingMinutesInDay <= 0) return 5
  const ratio = estimatedMinutes / remainingMinutesInDay
  if (ratio >= 0.5) return 5
  if (ratio >= 0.3) return 4
  if (ratio >= 0.15) return 3
  if (ratio >= 0.05) return 2
  return 1
}

export function computeTaskScore(
  importance: number,
  urgency: number,
  estimatedMinutes: number,
  remainingMinutesInDay: number,
): number {
  const timePressure = computeTimePressure(estimatedMinutes, remainingMinutesInDay)
  return (
    importance * WEIGHTS.importance +
    urgency * WEIGHTS.urgency +
    timePressure * WEIGHTS.timePressure
  )
}

export function getPriorityLabel(priority: TaskPriority): string {
  const labels: Record<TaskPriority, string> = {
    'urgent-important': '紧急且重要',
    important: '重要不紧急',
    urgent: '紧急不重要',
    low: '低优先级',
  }
  return labels[priority]
}

export function getPriorityColor(priority: TaskPriority): string {
  const colors: Record<TaskPriority, string> = {
    'urgent-important': 'text-danger',
    important: 'text-accent-400',
    urgent: 'text-warning',
    low: 'text-zinc-400',
  }
  return colors[priority]
}

export function getScoreReason(
  importance: number,
  urgency: number,
  estimatedMinutes: number,
): string {
  const parts: string[] = []
  if (importance >= 4) parts.push('高重要性')
  if (urgency >= 4) parts.push('时间紧迫')
  if (estimatedMinutes >= 120) parts.push('耗时较长，建议优先安排')
  if (parts.length === 0) parts.push('常规任务')
  return parts.join(' · ')
}
