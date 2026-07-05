import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { checkIsAdmin } from '@/services/adminService'

export function AdminRoute() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (!token || !user) {
      setAllowed(false)
      setReady(true)
      return
    }

    let cancelled = false
    void checkIsAdmin(token).then((isAdmin) => {
      if (!cancelled) {
        setAllowed(isAdmin)
        setReady(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [token, user])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-400" />
      </div>
    )
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  if (!allowed) {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
