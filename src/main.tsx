import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { alarmManager } from '@/services/alarm'
import { useAppStore, resyncAllAlarms } from '@/stores/appStore'
// 💡 引入你刚刚创建的位置上下文管理器
import { LocationProvider } from '@/context/LocationContext'
import { startWidgetSync } from '@/lib/widgetSync'
import { registerAlarmServiceWorker } from '@/services/alarm/registerServiceWorker'

startWidgetSync()
void registerAlarmServiceWorker()

/** Bootstrap AlarmManager + resync persisted alarms after hydration */
function AppBootstrap() {
  const settings = useAppStore((s) => s.settings)
  const tasks = useAppStore((s) => s.tasks)
  const timezoneInfo = useAppStore((s) => s.timezoneInfo)
  const syncDisciplineModeForCalendarDay = useAppStore(
    (s) => s.syncDisciplineModeForCalendarDay,
  )

  useEffect(() => {
    const runSync = () => syncDisciplineModeForCalendarDay()
    if (useAppStore.persist.hasHydrated()) {
      runSync()
    } else {
      useAppStore.persist.onFinishHydration(runSync)
    }
    const interval = window.setInterval(runSync, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') runSync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [syncDisciplineModeForCalendarDay])

  useEffect(() => {
    alarmManager.initialize({
      enabled: settings.alarm.enabled,
      soundEnabled: settings.alarm.soundEnabled,
      vibrationEnabled: settings.alarm.vibrationEnabled,
    })
    resyncAllAlarms(tasks, timezoneInfo.timezone)
    alarmManager.start()
    return () => alarmManager.stop()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — once on mount

  useEffect(() => {
    alarmManager.initialize({
      enabled: settings.alarm.enabled,
      soundEnabled: settings.alarm.soundEnabled,
      vibrationEnabled: settings.alarm.vibrationEnabled,
    })
  }, [settings.alarm.enabled, settings.alarm.soundEnabled, settings.alarm.vibrationEnabled])

  // 💡 在这里用 LocationProvider 把 App 包起来
  return (
    <LocationProvider>
      <App />
    </LocationProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBootstrap />
  </StrictMode>,
)