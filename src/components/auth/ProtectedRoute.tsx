import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export function ProtectedRoute() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const [ready, setReady] = useState(useAuthStore.persist.hasHydrated())

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setReady(true)
      return
    }
    return useAuthStore.persist.onFinishHydration(() => setReady(true))
  }, [])

  if (!ready) {
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
