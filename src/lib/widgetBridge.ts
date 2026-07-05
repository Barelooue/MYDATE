import type { AIScheduleResult, ScheduledBlock, Task } from '@/types'
import { parseTimeToMinutes } from '@/lib/utils'
import { isMealBlock } from '@/lib/mealSchedule'

export const WIDGET_STORAGE_KEY = 'mydate-widget-payload-v1'
export const WIDGET_PREFS_KEY = 'mydate-widget-prefs-v1'

export type WidgetBlockKind = 'meal' | 'pinned' | 'task'

export interface WidgetBlock {
  id: string
  title: string
  startTime: string
  endTime: string
  kind: WidgetBlockKind
}

export interface WidgetPayload {
  date: string
  dateLabel: string
  summary?: string
  blocks: WidgetBlock[]
  updatedAt: number
}

export interface WidgetPrefs {
  /** 用户选择保留小组件偏好（下次进入可提示恢复） */
  keepOnDesktop: boolean
}

const defaultPrefs: WidgetPrefs = { keepOnDesktop: false }

export function isDocumentPipSupported(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window
}

export function readWidgetPrefs(): WidgetPrefs {
  try {
    const raw = localStorage.getItem(WIDGET_PREFS_KEY)
    if (!raw) return defaultPrefs
    return { ...defaultPrefs, ...(JSON.parse(raw) as WidgetPrefs) }
  } catch {
    return defaultPrefs
  }
}

export function writeWidgetPrefs(prefs: Partial<WidgetPrefs>) {
  const next = { ...readWidgetPrefs(), ...prefs }
  localStorage.setItem(WIDGET_PREFS_KEY, JSON.stringify(next))
}

function blockKind(block: ScheduledBlock): WidgetBlockKind {
  if (block.blockType === 'meal' || isMealBlock(block)) return 'meal'
  if (block.isPinned) return 'pinned'
  return 'task'
}

function formatDateLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateKey
  return d.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  })
}

export function buildWidgetPayload(input: {
  selectedDate: string
  lastScheduleResult: AIScheduleResult | null
  tasks: Task[]
}): WidgetPayload {
  const { selectedDate, lastScheduleResult, tasks } = input
  let blocks: WidgetBlock[] = []
  let summary: string | undefined

  if (lastScheduleResult?.date === selectedDate && lastScheduleResult.blocks.length > 0) {
    blocks = lastScheduleResult.blocks.map((b) => ({
      id: b.taskId,
      title: b.title,
      startTime: b.startTime,
      endTime: b.endTime,
      kind: blockKind(b),
    }))
    summary = lastScheduleResult.summary
  } else {
    blocks = tasks
      .filter((t) => t.date === selectedDate && t.scheduledStart && t.scheduledEnd)
      .sort(
        (a, b) =>
          parseTimeToMinutes(a.scheduledStart!) - parseTimeToMinutes(b.scheduledStart!),
      )
      .map((t) => ({
        id: t.id,
        title: t.title,
        startTime: t.scheduledStart!,
        endTime: t.scheduledEnd!,
        kind: 'task' as const,
      }))
  }

  return {
    date: selectedDate,
    dateLabel: formatDateLabel(selectedDate),
    summary,
    blocks,
    updatedAt: Date.now(),
  }
}

export function publishWidgetPayload(payload: WidgetPayload) {
  localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(payload))
  window.dispatchEvent(new CustomEvent('mydate-widget-update', { detail: payload }))
}

export function readWidgetPayload(): WidgetPayload | null {
  try {
    const raw = localStorage.getItem(WIDGET_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as WidgetPayload
  } catch {
    return null
  }
}

export function subscribeWidgetPayload(listener: (payload: WidgetPayload | null) => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === WIDGET_STORAGE_KEY) listener(readWidgetPayload())
  }
  const onCustom = () => listener(readWidgetPayload())

  window.addEventListener('storage', onStorage)
  window.addEventListener('mydate-widget-update', onCustom)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('mydate-widget-update', onCustom)
  }
}

/** 将主页面样式复制到 PiP / 弹窗子窗口 */
export function copyDocumentStyles(targetWindow: Window) {
  const targetHead = targetWindow.document.head
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    targetHead.appendChild(node.cloneNode(true))
  })
}
