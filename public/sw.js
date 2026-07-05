/* MyDate — 后台通知 Service Worker（配合任务闹钟） */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        return clients[0].focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})

/** 主线程到点后可委托 SW 弹出通知（移动端系统通知音更可靠） */
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'SHOW_ALARM') return

  const { title, body, soundEnabled, vibrationEnabled, tag } = data.payload ?? {}
  const vibrate = vibrationEnabled
    ? [500, 200, 500, 200, 800, 200, 1000]
    : undefined

  event.waitUntil(
    self.registration.showNotification(title ?? '任务提醒', {
      body: body ?? '该开始了！',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: tag ?? 'mydate-alarm',
      vibrate,
      silent: !soundEnabled,
      requireInteraction: true,
      data: { url: '/' },
    }),
  )
})
