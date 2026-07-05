import { useAuthStore } from '@/stores/authStore'

import { apiUrl } from '@/lib/apiOrigin'

const API_BASE = apiUrl('/api/analytics')

export type AnalyticsPage =
  | 'task_board'
  | 'calendar'
  | 'ai_scheduler'
  | 'settings'

export async function trackAnalyticsEvent(
  type: 'heartbeat' | 'page_view' | 'feature',
  payload: { page?: AnalyticsPage; name?: string; seconds?: number },
) {
  const token = useAuthStore.getState().token
  if (!token) return

  try {
    await fetch(`${API_BASE}/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type, ...payload }),
    })
  } catch {
    /* 静默失败，不影响用户使用 */
  }
}

export function trackPageView(page: AnalyticsPage) {
  void trackAnalyticsEvent('page_view', { page })
}

export function trackFeature(name: 'ai_schedule' | 'task_create') {
  void trackAnalyticsEvent('feature', { name })
}

export function trackHeartbeat(seconds = 30) {
  void trackAnalyticsEvent('heartbeat', { seconds })
}
