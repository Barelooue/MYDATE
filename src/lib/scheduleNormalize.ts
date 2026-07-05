import type { ScheduledBlock } from '@/types'
import { isMealBlock } from '@/lib/mealSchedule'
import { minutesToTime, parseTimeToMinutes } from '@/lib/utils'

export const FULL_DAY_START_MINUTES = 0
export const FULL_DAY_END_MINUTES = 24 * 60

export interface PinnedTaskSlot {
  taskId: string
  startTime: string
  durationMinutes: number
}

export function formatTimelineLabel(totalMinutes: number): string {
  if (totalMinutes >= FULL_DAY_END_MINUTES) return '24:00'
  return minutesToTime(Math.max(0, totalMinutes))
}

interface TimeRange {
  start: number
  end: number
}

function overlapsRange(start: number, end: number, range: TimeRange): boolean {
  return start < range.end && end > range.start
}

function buildReservations(
  meals: ScheduledBlock[],
  pinned: PinnedTaskSlot[],
): TimeRange[] {
  const ranges: TimeRange[] = meals.map((m) => ({
    start: parseTimeToMinutes(m.startTime),
    end: parseTimeToMinutes(m.endTime),
  }))

  for (const pin of pinned) {
    const start = parseTimeToMinutes(pin.startTime)
    ranges.push({
      start,
      end: Math.min(start + pin.durationMinutes, FULL_DAY_END_MINUTES),
    })
  }

  return ranges.sort((a, b) => a.start - b.start)
}

function placeWithoutReservations(
  cursor: number,
  duration: number,
  reservations: TimeRange[],
  gap: number,
): { start: number; end: number } {
  let start = cursor
  let end = start + duration
  let adjusted = true

  while (adjusted) {
    adjusted = false
    for (const slot of reservations) {
      if (overlapsRange(start, end, slot)) {
        start = slot.end + gap
        end = start + duration
        adjusted = true
      }
    }
  }

  return {
    start: Math.min(start, FULL_DAY_END_MINUTES - 1),
    end: Math.min(end, FULL_DAY_END_MINUTES - 1),
  }
}

function applyPinnedSlots(
  blocks: ScheduledBlock[],
  pinnedSlots: PinnedTaskSlot[],
): ScheduledBlock[] {
  const pinMap = new Map(pinnedSlots.map((p) => [p.taskId, p]))

  return blocks.map((block) => {
    const pin = pinMap.get(block.taskId)
    if (!pin) return block

    const start = parseTimeToMinutes(pin.startTime)
    const end = Math.min(start + pin.durationMinutes, FULL_DAY_END_MINUTES - 1)
    return {
      ...block,
      blockType: 'task',
      isPinned: true,
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      reason: block.reason ? `${block.reason}（固定时段）` : '固定时段',
    }
  })
}

/**
 * 固定任务保持用户时间；其余任务顺序填充并绕开三餐与固定时段。
 */
export function sequentializeScheduleBlocks(
  blocks: ScheduledBlock[],
  wakeTime: string,
  taskDurations: Map<string, number>,
  mealBlocks: ScheduledBlock[] = [],
  pinnedSlots: PinnedTaskSlot[] = [],
): ScheduledBlock[] {
  const taskOnly = blocks.filter((b) => !isMealBlock(b))
  if (taskOnly.length === 0) return []

  const pinMap = new Map(pinnedSlots.map((p) => [p.taskId, p]))
  const meals = mealBlocks.filter(isMealBlock)
  const reservations = buildReservations(meals, pinnedSlots)

  const pinnedBlocks = applyPinnedSlots(
    taskOnly.filter((b) => pinMap.has(b.taskId)),
    pinnedSlots,
  )

  const flexBlocks = taskOnly.filter((b) => !pinMap.has(b.taskId))

  const wakeMinutes = parseTimeToMinutes(wakeTime || '07:00')
  const breakfastEnd = meals.find((m) => m.taskId === 'meal-breakfast')
    ? parseTimeToMinutes(meals.find((m) => m.taskId === 'meal-breakfast')!.endTime)
    : wakeMinutes + 60

  let cursor = Math.max(breakfastEnd + 10, wakeMinutes + 30)
  const gap = 10

  const ordered = [...flexBlocks].sort(
    (a, b) => b.score - a.score || parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
  )

  const flexPlaced = ordered.map((block) => {
    const fromTask = taskDurations.get(block.taskId)
    let duration =
      fromTask && fromTask > 0
        ? fromTask
        : parseTimeToMinutes(block.endTime) - parseTimeToMinutes(block.startTime)
    if (duration <= 0) duration = 30

    const { start, end } = placeWithoutReservations(cursor, duration, reservations, gap)
    cursor = Math.min(end + gap, FULL_DAY_END_MINUTES)

    return {
      ...block,
      blockType: 'task' as const,
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
    }
  })

  return [...pinnedBlocks, ...flexPlaced].sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
  )
}
