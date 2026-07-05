import { parseTimeToMinutes } from '@/lib/utils'

/** 时间轴轨道固定像素高度（父级须设相同 height，否则 % 高度会按内容撑开导致重叠） */
export const TIMELINE_TRACK_HEIGHT_PX = 1200

/** 块高度低于此值时使用单行极简样式（避免文字溢出背景） */
export const TIMELINE_COMPACT_HEIGHT_PX = 28

export interface TimelineBlockInput {
  taskId: string
  startTime: string
  endTime: string
  isMeal?: boolean
}

export interface TimelineBlockLayout {
  taskId: string
  top: string
  height: string
  left: string
  width: string
}

function toTrackPx(
  startMinutes: number,
  endMinutes: number,
  daySpanMinutes: number,
): { top: string; height: string } {
  const span = Math.max(daySpanMinutes, 1)
  const topPx = (startMinutes / span) * TIMELINE_TRACK_HEIGHT_PX
  const bottomPx = (endMinutes / span) * TIMELINE_TRACK_HEIGHT_PX
  const heightPx = Math.max(1, bottomPx - topPx)
  return {
    top: `${topPx}px`,
    height: `${heightPx}px`,
  }
}

function layoutTasksInLanes(
  items: Array<{ taskId: string; start: number; end: number }>,
  daySpanMinutes: number,
): TimelineBlockLayout[] {
  const laneEnds: number[] = []
  const placed: Array<{ taskId: string; start: number; end: number; lane: number }> = []

  for (const item of items) {
    let lane = laneEnds.findIndex((end) => end <= item.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(item.end)
    } else {
      laneEnds[lane] = item.end
    }
    placed.push({ taskId: item.taskId, start: item.start, end: item.end, lane })
  }

  const laneCount = Math.max(laneEnds.length, 1)
  const gapPct = laneCount > 1 ? 0.6 : 0
  const colWidth = (100 - gapPct * (laneCount - 1)) / laneCount

  return placed.map((p) => {
    const { top, height } = toTrackPx(p.start, p.end, daySpanMinutes)
    return {
      taskId: p.taskId,
      top,
      height,
      left: `${p.lane * (colWidth + gapPct)}%`,
      width: `${colWidth}%`,
    }
  })
}

/**
 * 三餐全宽；任务按时间泳道分列。位置用像素计算，避免 % 高度在父级无固定高度时塌陷重叠。
 */
export function layoutTimelineBlocks(
  blocks: TimelineBlockInput[],
  dayStartMinutes: number,
  daySpanMinutes: number,
): TimelineBlockLayout[] {
  if (daySpanMinutes <= 0) return []

  const parsed = blocks
    .map((b) => {
      const start = parseTimeToMinutes(b.startTime) - dayStartMinutes
      const end = parseTimeToMinutes(b.endTime) - dayStartMinutes
      return {
        taskId: b.taskId,
        isMeal: b.isMeal ?? b.taskId.startsWith('meal-'),
        start: Math.max(0, start),
        end: Math.max(end, start + 1),
      }
    })
    .filter((b) => b.end > b.start)

  const meals = parsed.filter((b) => b.isMeal)
  const tasks = parsed.filter((b) => !b.isMeal)

  const mealLayouts: TimelineBlockLayout[] = meals.map((m) => {
    const { top, height } = toTrackPx(m.start, m.end, daySpanMinutes)
    return {
      taskId: m.taskId,
      top,
      height,
      left: '0%',
      width: '100%',
    }
  })

  const taskLayouts = layoutTasksInLanes(tasks, daySpanMinutes)

  return [...mealLayouts, ...taskLayouts]
}
