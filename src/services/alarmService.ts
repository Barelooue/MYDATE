/**
 * @deprecated Import from '@/services/alarm' instead.
 * Thin re-export layer for backward compatibility.
 */
import type { Task } from '@/types'
import type { ScheduledAlarmRecord } from '@/services/alarm/types'
import { alarmManager } from '@/services/alarm/AlarmManager'

export { alarmManager }

export async function requestNotificationPermission() {
  return alarmManager.requestPermissions()
}

export function isNotificationSupported() {
  return alarmManager.getPermissionStatus() !== 'unsupported'
}

export function getNotificationPermission() {
  return alarmManager.getPermissionStatus()
}

export function getPendingAlarms() {
  return alarmManager.exportSyncPayload()
}

export function startAlarmPoller(onFire?: (alarm: ScheduledAlarmRecord) => void) {
  alarmManager.start(onFire)
}

export function stopAlarmPoller() {
  alarmManager.stop()
}

export function exportAlarmForSync(task: Task) {
  return {
    platform: alarmManager.getPlatform(),
    taskId: task.id,
    title: task.title,
    date: task.date,
    time: task.alarmTime ?? '',
    fireAtUtc: task.alarmAtUtc ?? '',
    deepLink: task.alarmAtUtc
      ? alarmManager.buildDeepLink(task.id, task.alarmAtUtc, task.title)
      : '',
  }
}

export function scheduleTaskAlarm(task: Task) {
  const tz = task.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  void alarmManager.scheduleFromTask(task, tz)
  return null
}

export function cancelTaskAlarm(taskId: string) {
  void alarmManager.cancelForTask(taskId)
}
