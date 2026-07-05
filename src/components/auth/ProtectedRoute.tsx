import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { fetchCurrentUser } from '@/services/authService'

export function ProtectedRoute() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const clearSession = useAuthStore((s) => s.clearSession)
  const [ready, setReady] = useState(useAuthStore.persist.hasHydrated())
  const [validating, setValidating] = useState(true)

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setReady(true)
      return
    }
    return useAuthStore.persist.onFinishHydration(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready) return

    if (!token || !user) {
      setValidating(false)
      return
    }

    let cancelled = false
    void fetchCurrentUser(token).then((remoteUser) => {
      if (cancelled) return
      if (!remoteUser) clearSession()
      setValidating(false)
    })

    return () => {
      cancelled = true
    }
  }, [ready, token, user, clearSession])

  if (!ready || validating) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-400" />
      </div>
    )
  }

  if (!user || !token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
