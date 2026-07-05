import {
  canPlayWebAudioAlarm,
  fireAlarmNotification,
} from '@/services/alarm/notificationAlarm'
import type {
  AlarmPayload,
  AlarmPlatform,
  NativeAlarmBridge,
  ScheduledAlarmRecord,
} from '@/services/alarm/types'

const STORAGE_KEY = 'mydate-alarms-v2'

declare global {
  interface Window {
    /** Electron preload bridge — inject in future desktop build */
    mydateElectron?: NativeAlarmBridge
    /** Capacitor / React Native WebView bridge */
    MyDateNative?: {
      scheduleExactAlarm(payload: AlarmPayload): Promise<string>
      cancelAlarm(alarmId: string): Promise<void>
      requestNotificationPermission(): Promise<boolean>
    }
  }
}

function loadAlarms(): ScheduledAlarmRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAlarms(alarms: ScheduledAlarmRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms))
}

/** Web Audio API — dual-tone alarm pattern simulating classic alarm clock */
class AlarmSoundEngine {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  playAlarmPattern(durationMs = 8000) {
    const ctx = this.getContext()
    const start = ctx.currentTime
    const end = start + durationMs / 1000

    let t = start
    while (t < end) {
      this.playBeep(ctx, t, 880, 0.18)
      this.playBeep(ctx, t + 0.22, 660, 0.18)
      t += 0.55
    }
  }

  private playBeep(ctx: AudioContext, when: number, freq: number, dur: number) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(0.28, when + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(when)
    osc.stop(when + dur + 0.05)
  }

  stop() {
    void this.ctx?.close()
    this.ctx = null
  }
}

const soundEngine = new AlarmSoundEngine()
let pollTimer: ReturnType<typeof setInterval> | null = null
let ringing = false

async function fireAlarmEffects(
  title: string,
  body: string,
  sound: boolean,
  vibrate: boolean,
) {
  if (ringing) return
  ringing = true

  await fireAlarmNotification({
    title,
    body,
    soundEnabled: sound,
    vibrationEnabled: vibrate,
  })

  if (sound && canPlayWebAudioAlarm()) {
    soundEngine.playAlarmPattern()
  }

  setTimeout(() => {
    ringing = false
  }, 8000)
}

/**
 * WebAlarmProvider — current production implementation.
 * Mobile: system notification sound + vibrate; desktop: + Web Audio.
 */
export class WebAlarmProvider implements NativeAlarmBridge {
  readonly platform: AlarmPlatform = 'web'

  async scheduleAlarm(payload: AlarmPayload): Promise<string> {
    const alarms = loadAlarms().filter((a) => a.id !== payload.id)
    const record: ScheduledAlarmRecord = { ...payload, fired: false, platform: 'web' }
    alarms.push(record)
    saveAlarms(alarms)
    return payload.id
  }

  async cancelAlarm(alarmId: string): Promise<void> {
    saveAlarms(loadAlarms().filter((a) => a.id !== alarmId))
  }

  async cancelAllForTask(taskId: string): Promise<void> {
    saveAlarms(loadAlarms().filter((a) => a.taskId !== taskId))
  }

  async requestPermissions(): Promise<boolean> {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    return (await Notification.requestPermission()) === 'granted'
  }

  getPermissionStatus() {
    if (!('Notification' in window)) return 'unsupported' as const
    return Notification.permission
  }

  startPolling(onFire: (alarm: ScheduledAlarmRecord) => void) {
    if (pollTimer) return
    pollTimer = setInterval(() => {
      const now = Date.now()
      const alarms = loadAlarms()
      let changed = false
      for (const alarm of alarms) {
        if (alarm.fired) continue
        if (now >= new Date(alarm.fireAtUtc).getTime()) {
          alarm.fired = true
          changed = true
          fireAlarmEffects(
            alarm.title,
            alarm.body ?? '任务提醒时间到！',
            alarm.soundEnabled,
            alarm.vibrationEnabled,
          )
          onFire(alarm)
        }
      }
      if (changed) saveAlarms(alarms)
    }, 5_000)
  }

  stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    soundEngine.stop()
  }

  fireNow(payload: Pick<AlarmPayload, 'title' | 'body' | 'soundEnabled' | 'vibrationEnabled'>) {
    fireAlarmEffects(
      payload.title,
      payload.body ?? '测试闹钟',
      payload.soundEnabled,
      payload.vibrationEnabled,
    )
  }

  exportForNativeSync(alarms: ScheduledAlarmRecord[]): string {
    return JSON.stringify(
      alarms.map((a) => ({
        ...a,
        nativeHint: 'Replace WebAlarmProvider with platform bridge at packaging time',
      })),
      null,
      2,
    )
  }

  getPendingAlarms(): ScheduledAlarmRecord[] {
    const now = Date.now()
    return loadAlarms().filter((a) => !a.fired && new Date(a.fireAtUtc).getTime() > now)
  }
}

/** Detect native bridge injected by Electron / Capacitor shell */
export function detectNativeBridge(): NativeAlarmBridge | null {
  if (window.mydateElectron) return window.mydateElectron
  if (window.MyDateNative) {
    return {
      platform: 'android',
      scheduleAlarm: (p) => window.MyDateNative!.scheduleExactAlarm(p),
      cancelAlarm: (id) => window.MyDateNative!.cancelAlarm(id),
      cancelAllForTask: async (taskId) => {
        const pending = loadAlarms().filter((a) => a.taskId === taskId)
        await Promise.all(pending.map((a) => window.MyDateNative!.cancelAlarm(a.id)))
      },
      requestPermissions: () => window.MyDateNative!.requestNotificationPermission(),
      getPermissionStatus: () =>
        Notification.permission === 'granted' ? 'granted' : 'default',
      startPolling: () => {},
      stopPolling: () => {},
      fireNow: () => {},
      exportForNativeSync: (alarms) => JSON.stringify(alarms, null, 2),
    }
  }
  return null
}

export { loadAlarms, saveAlarms }
