import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackHeartbeat, trackPageView, type AnalyticsPage } from '@/services/analyticsService'
import { useAuthStore } from '@/stores/authStore'

const PATH_TO_PAGE: Record<string, AnalyticsPage> = {
  '/app': 'task_board',
  '/app/calendar': 'calendar',
  '/app/ai-scheduler': 'ai_scheduler',
  '/app/settings': 'settings',
}

/** 静默采集使用数据（用户无感知，仅管理员后台可见） */
export function useAnalytics() {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) return
    const page = PATH_TO_PAGE[location.pathname]
    if (page) trackPageView(page)
  }, [location.pathname, token])

  useEffect(() => {
    if (!token) return

    const sendBeat = () => {
      if (document.visibilityState === 'visible') {
        trackHeartbeat(30)
      }
    }

    sendBeat()
    const timer = window.setInterval(sendBeat, 30_000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') sendBeat()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [token])
}
