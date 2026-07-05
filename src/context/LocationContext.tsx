import React, { createContext, useCallback, useContext, useMemo } from 'react'
import { useLiveGpsWeather, type LiveGpsWeatherState } from '@/hooks/useLiveGpsWeather'

interface LocationContextType extends LiveGpsWeatherState {
  refreshLocation: () => Promise<void>
}

const LocationContext = createContext<LocationContextType | undefined>(undefined)

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const live = useLiveGpsWeather()

  const refreshLocation = useCallback(async () => {
    // 由 useLiveGpsWeather 持续 watchPosition 持续更新
  }, [])

  const value = useMemo(
    () => ({ ...live, refreshLocation }),
    [
      live.condition,
      live.temp,
      live.location,
      live.latitude,
      live.longitude,
      live.loading,
      live.gpsReady,
      live.error,
      refreshLocation,
    ],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocation(): LocationContextType {
  const context = useContext(LocationContext)
  if (!context) {
    return {
      condition: '',
      temp: 22,
      location: '正在获取 GPS...',
      latitude: null,
      longitude: null,
      loading: true,
      gpsReady: false,
      error: null,
      refreshLocation: async () => {},
    }
  }
  return context
}
