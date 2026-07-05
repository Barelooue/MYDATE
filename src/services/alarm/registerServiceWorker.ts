/** 注册 Service Worker，提升移动端后台通知可靠性 */
export async function registerAlarmServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (err) {
    console.warn('[Alarm] Service Worker 注册失败:', err)
  }
}
