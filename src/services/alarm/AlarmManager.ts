import type { Task } from '@/types'
import type {
  AlarmManagerConfig,
  AlarmPayload,
  NativeAlarmBridge,
  ScheduledAlarmRecord,
} from '@/services/alarm/types'
import {
  WebAlarmProvider,
  detectNativeBridge,
  loadAlarms,
} from '@/services/alarm/WebAlarmProvider'
import { localDateTimeToUtc } from '@/services/timezoneService'

/**
 * AlarmManager — singleton facade over platform alarm providers.
 *
 * Usage (unchanged when swapping to native):
 *   alarmManager.initialize({ soundEnabled: true, ... })
 *   alarmManager.scheduleFromTask(task, timezone)
 *   alarmManager.start()
 */
class AlarmManager {
  private provider: NativeAlarmBridge = new WebAlarmProvider()
  private config: AlarmManagerConfig = {
    enabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
  }

  initialize(config: Partial<AlarmManagerConfig>) {
    this.config = { ...this.config, ...config }
    const native = detectNativeBridge()
    if (native) {
      this.provider = native
      console.info(`[AlarmManager] Native bridge detected: ${native.platform}`)
    } else {
      this.provider = new WebAlarmProvider()
      console.info('[AlarmManager] Using WebAlarmProvider (Notification + Audio + Vibration)')
    }
  }

  getPlatform() {
    return this.provider.platform
  }

  async requestPermissions() {
    return this.provider.requestPermissions()
  }

  getPermissionStatus() {
    return this.provider.getPermissionStatus()
  }

  buildDeepLink(taskId: string, fireAtUtc: string, title: string): string {
    return `mydate://alarm?task=${encodeURIComponent(taskId)}&at=${encodeURIComponent(fireAtUtc)}&title=${encodeURIComponent(title)}`
  }

  async scheduleFromTask(task: Task, timezone: string): Promise<string | null> {
    if (!this.config.enabled || !task.alarmEnabled) return null

    const fireAtUtc =
      task.alarmAtUtc ??
      (task.alarmTime
        ? localDateTimeToUtc(task.date, task.alarmTime, timezone)
        : null)

    if (!fireAtUtc) return null

    const payload: AlarmPayload = {
      id: `alarm-${task.id}`,
      taskId: task.id,
      title: task.title,
      body: `📋 ${task.title} — 该开始了！`,
      fireAtUtc,
      timezone,
      soundEnabled: this.config.soundEnabled,
      vibrationEnabled: this.config.vibrationEnabled,
      deepLink: this.buildDeepLink(task.id, fireAtUtc, task.title),
    }

    return this.provider.scheduleAlarm(payload)
  }

  async cancelForTask(taskId: string) {
    await this.provider.cancelAllForTask(taskId)
  }

  start(onFire?: (alarm: ScheduledAlarmRecord) => void) {
    if (!this.config.enabled) return
    this.provider.startPolling(onFire ?? (() => {}))
  }

  stop() {
    this.provider.stopPolling()
  }

  testAlarm() {
    this.provider.fireNow({
      title: 'MyDate 测试闹钟',
      body: '闹钟声音与震动测试成功！',
      soundEnabled: this.config.soundEnabled,
      vibrationEnabled: this.config.vibrationEnabled,
    })
  }

  getPendingCount(): number {
    const now = Date.now()
    return loadAlarms().filter(
      (a) => !a.fired && new Date(a.fireAtUtc).getTime() > now,
    ).length
  }

  exportSyncPayload(): ScheduledAlarmRecord[] {
    return loadAlarms().filter((a) => !a.fired)
  }

  exportForNativeSync(): string {
    return this.provider.exportForNativeSync(this.exportSyncPayload())
  }
}

export const alarmManager = new AlarmManager()

/** @deprecated Use alarmManager — kept for gradual migration */
export {
  alarmManager as default,
}
