/** 是否为手机 / 平板等触摸设备 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const coarsePointer =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: coarse)').matches === true
  return mobileUa || coarsePointer
}

export function supportsVibration(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

export function supportsNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** 移动端浏览器通常无法在后台播放 Web Audio，应优先用系统通知音 */
export function shouldUseNotificationSound(): boolean {
  return isMobileDevice()
}

export function getAlarmCapabilityHint(): string {
  if (!isMobileDevice()) {
    return '桌面端可使用 Web Audio 模拟闹钟铃声；请开启浏览器通知权限。'
  }
  if (!supportsVibration()) {
    return '当前浏览器不支持震动。建议开启通知权限，到点将使用系统通知音提醒。'
  }
  return '手机浏览器无法读取系统闹钟铃声。可选：① 系统通知音 + 振动 ② 仅振动（无声）③ 添加到主屏幕后提醒更稳定。'
}
