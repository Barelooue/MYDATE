import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import {
  coordsChangedSignificantly,
  formatCoordsLabel,
  formatTimezoneLocationLabel,
  getCurrentGps,
  resolvePlaceName,
  watchLiveGeolocation,
  type GpsCoords,
} from '@/services/locationService'
import { clearStaleWeatherCache, fetchLiveWeather } from '@/services/weatherService'

/** 后台静默刷新间隔（1 秒） */
const WEATHER_POLL_MS = 1_000
const STORE_SYNC_DEBOUNCE_MS = 5_000
/** 定期清理天气内存缓存 */
const CACHE_CLEANUP_MS = 10 * 60 * 1000

export interface LiveGpsWeatherState {
  condition: string
  temp: number
  location: string
  latitude: number | null
  longitude: number | null
  /** 仅首次加载时为 true，后台刷新不触发 UI 加载态 */
  loading: boolean
  gpsReady: boolean
  error: string | null
}

const initialState: LiveGpsWeatherState = {
  condition: '',
  temp: 22,
  location: '正在获取 GPS...',
  latitude: null,
  longitude: null,
  loading: true,
  gpsReady: false,
  error: null,
}

function readCoordsFromStore(): GpsCoords | null {
  const tz = useAppStore.getState().timezoneInfo
  return tz.latitude != null && tz.longitude != null
    ? { latitude: tz.latitude, longitude: tz.longitude }
    : null
}

/**
 * 持续 watchPosition + 每秒静默拉取和风实时天气，并同步到全局 timezoneInfo。
 * 后台刷新不显示「加载中」，始终展示最近一次成功获取的天气。
 */
export function useLiveGpsWeather(): LiveGpsWeatherState {
  const setTimezoneInfo = useAppStore((s) => s.setTimezoneInfo)

  const [state, setState] = useState<LiveGpsWeatherState>(() => {
    const timezoneInfo = useAppStore.getState().timezoneInfo
    const label = formatTimezoneLocationLabel(timezoneInfo)
    const hasCoords =
      timezoneInfo.latitude != null && timezoneInfo.longitude != null
    return {
      ...initialState,
      location: label || initialState.location,
      latitude: timezoneInfo.latitude ?? null,
      longitude: timezoneInfo.longitude ?? null,
      gpsReady: hasCoords,
      loading: !hasCoords,
    }
  })

  const coordsRef = useRef<GpsCoords | null>(readCoordsFromStore())
  const placeNameRef = useRef(
    formatTimezoneLocationLabel(useAppStore.getState().timezoneInfo) || '',
  )
  const lastStoreSyncRef = useRef(0)
  const geocodeInFlightRef = useRef(false)
  const weatherAbortRef = useRef<AbortController | null>(null)
  const hasWeatherRef = useRef(false)
  const pullInFlightRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const syncStore = (coords: GpsCoords, placeName: string) => {
      const now = Date.now()
      if (now - lastStoreSyncRef.current < STORE_SYNC_DEBOUNCE_MS) return
      lastStoreSyncRef.current = now

      const prev = useAppStore.getState().timezoneInfo
      setTimezoneInfo({
        ...prev,
        latitude: coords.latitude,
        longitude: coords.longitude,
        city: placeName.split(' ')[0] || prev.city,
        region: prev.region,
        source: 'auto',
      })
    }

    const applyCoords = async (coords: GpsCoords, forceGeocode = false) => {
      const prevCoords = coordsRef.current
      const shouldGeocode =
        forceGeocode || coordsChangedSignificantly(prevCoords, coords)
      coordsRef.current = coords

      if (shouldGeocode) {
        if (!geocodeInFlightRef.current) {
          geocodeInFlightRef.current = true
          try {
            const name = await resolvePlaceName(coords.latitude, coords.longitude)
            if (!cancelled && name) {
              placeNameRef.current = name
              syncStore(coords, name)
            }
          } finally {
            geocodeInFlightRef.current = false
          }
        }
      }

      const label =
        placeNameRef.current || formatCoordsLabel(coords.latitude, coords.longitude)

      if (!cancelled) {
        setState((prev) => {
          if (
            prev.latitude === coords.latitude &&
            prev.longitude === coords.longitude &&
            prev.location === label &&
            prev.gpsReady &&
            !prev.error
          ) {
            return prev
          }
          return {
            ...prev,
            latitude: coords.latitude,
            longitude: coords.longitude,
            location: label,
            gpsReady: true,
            error: null,
            loading: hasWeatherRef.current ? false : prev.loading,
          }
        })
      }
    }

    const pullWeather = async () => {
      const coords = coordsRef.current
      if (!coords || pullInFlightRef.current) return

      pullInFlightRef.current = true
      weatherAbortRef.current?.abort()
      const controller = new AbortController()
      weatherAbortRef.current = controller

      const label =
        placeNameRef.current ||
        formatCoordsLabel(coords.latitude, coords.longitude)

      try {
        const weather = await fetchLiveWeather(
          coords.latitude,
          coords.longitude,
          label,
          { signal: controller.signal },
        )
        if (cancelled || controller.signal.aborted) return

        hasWeatherRef.current = true
        setState((prev) => {
          if (
            prev.condition === weather.condition &&
            prev.temp === weather.temp &&
            prev.location === weather.locationLabel &&
            !prev.loading &&
            !prev.error
          ) {
            return prev
          }
          return {
            ...prev,
            condition: weather.condition,
            temp: weather.temp,
            location: weather.locationLabel,
            loading: false,
            gpsReady: true,
            error: null,
          }
        })
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        const msg = err instanceof Error ? err.message : '天气更新失败'
        console.warn('[weather] 后台刷新失败（保留上次数据）:', msg)
        if (!hasWeatherRef.current) {
          setState((prev) => ({
            ...prev,
            loading: false,
            condition: prev.condition || `⚠️ ${msg}`,
            error: msg,
          }))
        }
      } finally {
        pullInFlightRef.current = false
      }
    }

    const stopWatch = watchLiveGeolocation(
      (coords) => {
        void applyCoords(coords)
      },
      (err) => {
        if (cancelled) return
        const msg =
          err.code === 1
            ? '请允许浏览器定位权限'
            : err.message || 'GPS 定位失败'
        setState((prev) => {
          if (prev.error === msg && prev.gpsReady === false) return prev
          return {
            ...prev,
            loading: hasWeatherRef.current ? false : prev.loading,
            gpsReady: false,
            error: msg,
          }
        })
      },
    )

    void getCurrentGps()
      .then((coords) => applyCoords(coords, true))
      .catch(() => {
        /* watchPosition 会继续尝试 */
      })

    void pullWeather()
    const weatherTimer = window.setInterval(() => {
      void pullWeather()
    }, WEATHER_POLL_MS)

    const cacheTimer = window.setInterval(() => {
      clearStaleWeatherCache()
    }, CACHE_CLEANUP_MS)

    const onHostUpdated = () => {
      void pullWeather()
    }
    window.addEventListener('qweather-host-updated', onHostUpdated)

    return () => {
      cancelled = true
      weatherAbortRef.current?.abort()
      stopWatch()
      window.clearInterval(weatherTimer)
      window.clearInterval(cacheTimer)
      window.removeEventListener('qweather-host-updated', onHostUpdated)
    }
  }, [setTimezoneInfo])

  return state
}
