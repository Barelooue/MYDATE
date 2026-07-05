import { buildWidgetPayload, publishWidgetPayload } from '@/lib/widgetBridge'
import { useAppStore } from '@/stores/appStore'

let started = false
let lastPayloadKey = ''

function publishIfChanged() {
  const s = useAppStore.getState()
  const payload = buildWidgetPayload({
    selectedDate: s.selectedDate,
    lastScheduleResult: s.lastScheduleResult,
    tasks: Array.isArray(s.tasks) ? s.tasks : [],
  })
  const key = JSON.stringify(payload)
  if (key === lastPayloadKey) return
  lastPayloadKey = key
  publishWidgetPayload(payload)
}

/** 主应用 hydration 完成后同步日程到 localStorage，供桌面小组件读取 */
export function startWidgetSync() {
  if (started) return
  started = true

  const begin = () => {
    publishIfChanged()
    useAppStore.subscribe(publishIfChanged)
  }

  if (useAppStore.persist.hasHydrated()) {
    begin()
  } else {
    useAppStore.persist.onFinishHydration(begin)
  }
}
