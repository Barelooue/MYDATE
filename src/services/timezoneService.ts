import type { Task, TimezoneInfo } from '@/types'

/** Resolve device IANA timezone via Intl API */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

export function getTimezoneOffsetMinutes(timezone: string, date = new Date()): number {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
  const local = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
  return (local.getTime() - utc.getTime()) / 60_000
}

export function formatUtcOffset(timezone: string): string {
  const offset = getTimezoneOffsetMinutes(timezone)
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Convert local date + HH:mm in a given IANA timezone → ISO UTC string.
 * Uses iterative offset correction for DST edge cases.
 */
export function localDateTimeToUtc(date: string, time: string, timezone: string): string {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi, 0))

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(guess)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)

  const localAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  const target = Date.UTC(y, mo - 1, d, h, mi, 0)
  const corrected = new Date(guess.getTime() + (target - localAsUtc))
  return corrected.toISOString()
}

export function utcToLocalParts(isoUtc: string, timezone: string): { date: string; time: string } {
  const d = new Date(isoUtc)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

export function convertTaskToTimezone(task: Task, fromTz: string, toTz: string): Partial<Task> {
  if (fromTz === toTz) return { timezone: toTz }

  const patch: Partial<Task> = { timezone: toTz }

  if (task.alarmAtUtc) {
    const local = utcToLocalParts(task.alarmAtUtc, toTz)
    patch.date = local.date
    patch.alarmTime = local.time
  } else if (task.alarmTime) {
    const utc = localDateTimeToUtc(task.date, task.alarmTime, fromTz)
    patch.alarmAtUtc = utc
    const local = utcToLocalParts(utc, toTz)
    patch.date = local.date
    patch.alarmTime = local.time
  }

  if (task.scheduledStart && task.scheduledEnd) {
    const startUtc = localDateTimeToUtc(task.date, task.scheduledStart, fromTz)
    const endUtc = localDateTimeToUtc(task.date, task.scheduledEnd, fromTz)
    const startLocal = utcToLocalParts(startUtc, toTz)
    const endLocal = utcToLocalParts(endUtc, toTz)
    patch.date = startLocal.date
    patch.scheduledStart = startLocal.time
    patch.scheduledEnd = endLocal.time
  }

  return patch
}

export function migrateAllTasksTimezone(
  tasks: Task[],
  fromTz: string,
  toTz: string,
): Task[] {
  if (fromTz === toTz) return tasks
  return tasks.map((t) => ({
    ...t,
    ...convertTaskToTimezone(t, fromTz, toTz),
    updatedAt: new Date().toISOString(),
  }))
}

export interface GeolocationResult {
  latitude: number
  longitude: number
  timezone: string
  city?: string
  region?: string
  country?: string
}

/** 逆地理编码为中文地名（市/区 + 街道或社区） */
export async function reverseGeocodePlaceName(
  latitude: number,
  longitude: number,
): Promise<string | undefined> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=zh-CN`,
    { headers: { 'User-Agent': 'MyDate-Scheduler/1.0' } },
  )
  if (!res.ok) return undefined

  const data = await res.json()
  const addr = data.address
  if (!addr) return undefined

  const city =
    addr.city ?? addr.town ?? addr.county ?? addr.district ?? addr.municipality
  const area = addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? addr.road
  const region = addr.state ?? addr.province

  const parts = [city, area].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  if (region && city) return `${region} ${city}`
  return region ?? city
}

/** Browser geolocation + Nominatim reverse geocoding + Intl timezone */
export async function detectLocationAndTimezone(): Promise<GeolocationResult> {
  const timezone = getDeviceTimezone()

  if (!navigator.geolocation) {
    return { latitude: 0, longitude: 0, timezone }
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    })
  })

  const { latitude, longitude } = position.coords
  let city: string | undefined
  let region: string | undefined
  let country: string | undefined

  try {
    const placeName = await reverseGeocodePlaceName(latitude, longitude)
    if (placeName) {
      city = placeName
    }
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=zh-CN`,
      { headers: { 'User-Agent': 'MyDate-Scheduler/1.0' } },
    )
    if (res.ok) {
      const data = await res.json()
      const addr = data.address
      city = city ?? addr?.city ?? addr?.town ?? addr?.county
      region = addr?.state ?? addr?.province
      country = addr?.country_code?.toUpperCase()
    }
  } catch {
    /* geocoding optional */
  }

  return { latitude, longitude, timezone, city, region, country }
}

export function buildDefaultTimezoneInfo(): TimezoneInfo {
  return {
    timezone: getDeviceTimezone(),
    source: 'device',
  }
}

export function formatTimezoneLabel(info: TimezoneInfo): string {
  const offset = formatUtcOffset(info.timezone)
  const place = [info.city, info.region, info.country].filter(Boolean).join(', ')
  return place ? `${place} (${info.timezone}, ${offset})` : `${info.timezone} (${offset})`
}
