import type { TimezoneInfo } from '@/types'
import { reverseGeocodePlaceName } from '@/services/timezoneService'

export interface GpsCoords {
  latitude: number
  longitude: number
}

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000,
}

/** 持续监听浏览器 GPS，返回取消函数 */
export function watchLiveGeolocation(
  onUpdate: (coords: GpsCoords) => void,
  onError?: (error: GeolocationPositionError) => void,
): () => void {
  if (!navigator.geolocation) {
    onError?.({
      code: 2,
      message: '当前环境不支持 GPS',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError)
    return () => {}
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      })
    },
    (err) => onError?.(err),
    WATCH_OPTIONS,
  )

  return () => navigator.geolocation.clearWatch(watchId)
}

/** 单次获取当前 GPS（用于手动刷新） */
export function getCurrentGps(): Promise<GpsCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前环境不支持 GPS'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (err) => reject(new Error(err.message || '定位失败')),
      WATCH_OPTIONS,
    )
  })
}

export function formatCoordsLabel(lat: number, lng: number): string {
  return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`
}

export function formatTimezoneLocationLabel(info: Pick<TimezoneInfo, 'city' | 'region'>): string {
  const parts = [info.city, info.region].filter(Boolean)
  return parts.join(' ') || ''
}

/** 坐标变化超过约 50m 才重新逆地理编码，避免频繁请求 */
export function coordsChangedSignificantly(
  prev: GpsCoords | null,
  next: GpsCoords,
  thresholdDeg = 0.0005,
): boolean {
  if (!prev) return true
  return (
    Math.abs(prev.latitude - next.latitude) > thresholdDeg ||
    Math.abs(prev.longitude - next.longitude) > thresholdDeg
  )
}

export async function resolvePlaceName(latitude: number, longitude: number): Promise<string> {
  try {
    const name = await reverseGeocodePlaceName(latitude, longitude)
    if (name) return name
  } catch {
    /* optional */
  }
  return formatCoordsLabel(latitude, longitude)
}
