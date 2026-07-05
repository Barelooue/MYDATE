import {
  isMobileDevice,
  shouldUseNotificationSound,
  supportsVibration,
} from '@/lib/deviceCapabilities'

export interface AlarmEffectOptions {
  title: string
  body: string
  soundEnabled: boolean
  vibrationEnabled: boolean
  tag?: string
}

/** vibrate 在 Service Worker / 部分移动端可用，但 TS 标准 NotificationOptions 未声明 */
type AlarmNotificationOptions = NotificationOptions & {
  vibrate?: number | number[]
}

function buildNotificationOptions(options: AlarmEffectOptions): AlarmNotificationOptions {
  return {
    body: options.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: options.tag ?? 'mydate-alarm',
    vibrate: options.vibrationEnabled
      ? [500, 200, 500, 200, 800, 200, 1000]
      : undefined,
    silent: !options.soundEnabled,
    requireInteraction: true,
  }
}

async function showViaServiceWorker(options: AlarmEffectOptions): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const controller = navigator.serviceWorker.controller
    if (controller) {
      controller.postMessage({
        type: 'SHOW_ALARM',
        payload: options,
      })
      return true
    }
    if (reg.showNotification) {
      await reg.showNotification(options.title, buildNotificationOptions(options))
      return true
    }
  } catch {
    /* fallback below */
  }
  return false
}

function showDirectNotification(options: AlarmEffectOptions): boolean {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false
  try {
    const n = new Notification(options.title, buildNotificationOptions(options))
    n.onclick = () => {
      window.focus()
      n.close()
    }
    return true
  } catch {
    return false
  }
}

export function triggerVibration(vibrationEnabled: boolean, vibrationOnly = false) {
  if (!vibrationEnabled || !supportsVibration()) return
  const pattern = vibrationOnly
    ? [800, 300, 800, 300, 800, 300, 1200, 400, 1200]
    : [400, 150, 400, 150, 400, 150, 600]
  navigator.vibrate(pattern)
}

/** 移动端优先系统通知音；桌面端可叠加 Web Audio */
export async function fireAlarmNotification(options: AlarmEffectOptions): Promise<void> {
  const payload = {
    ...options,
    title: `⏰ ${options.title}`,
  }

  const viaSw = await showViaServiceWorker(payload)
  if (!viaSw) showDirectNotification(payload)

  if (options.vibrationEnabled) {
    triggerVibration(true, options.soundEnabled === false && isMobileDevice())
  }
}

export function canPlayWebAudioAlarm(): boolean {
  return !shouldUseNotificationSound()
}
