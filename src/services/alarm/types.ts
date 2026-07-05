/**
 * AlarmManager — Native Bridge Service
 * =====================================
 * Unified alarm abstraction layer. Currently backed by Web APIs;
 * designed for one-line swap to platform-native implementations.
 *
 * Future integration map:
 * ┌─────────────┬──────────────────────────────────────────────────┐
 * │ Platform    │ Replace WebAlarmProvider with                    │
 * ├─────────────┼──────────────────────────────────────────────────┤
 * │ Electron    │ ipcRenderer.invoke('alarm:schedule', payload)    │
 * │ Android     │ window.MyDateNative.scheduleExactAlarm(...)      │
 * │ iOS         │ window.webkit.messageHandlers.alarm.postMessage  │
 * │ Windows     │ WinRT AppNotification + AlarmApplicationManager  │
 * │ macOS       │ UNUserNotificationCenter + NSTimer bridge        │
 * └─────────────┴──────────────────────────────────────────────────┘
 */

export type AlarmPlatform = 'web' | 'electron' | 'android' | 'ios' | 'windows' | 'macos'

export interface AlarmPayload {
  id: string
  taskId: string
  title: string
  body?: string
  /** ISO-8601 UTC instant */
  fireAtUtc: string
  /** IANA timezone for display / native OS formatting */
  timezone: string
  soundEnabled: boolean
  vibrationEnabled: boolean
  /** Deep link for native clients: mydate://alarm?... */
  deepLink: string
}

export interface ScheduledAlarmRecord extends AlarmPayload {
  fired: boolean
  platform: AlarmPlatform
}

export interface NativeAlarmBridge {
  readonly platform: AlarmPlatform
  scheduleAlarm(payload: AlarmPayload): Promise<string>
  cancelAlarm(alarmId: string): Promise<void>
  cancelAllForTask(taskId: string): Promise<void>
  requestPermissions(): Promise<boolean>
  getPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported'
  startPolling(onFire: (alarm: ScheduledAlarmRecord) => void): void
  stopPolling(): void
  /** Trigger alarm immediately (test / snooze dismiss) */
  fireNow(payload: Pick<AlarmPayload, 'title' | 'body' | 'soundEnabled' | 'vibrationEnabled'>): void
  exportForNativeSync(alarms: ScheduledAlarmRecord[]): string
}

export interface AlarmManagerConfig {
  soundEnabled: boolean
  vibrationEnabled: boolean
  enabled: boolean
}
