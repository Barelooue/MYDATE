import type { AdminDashboard } from '@/types/admin'
import { apiUrl } from '@/lib/apiOrigin'

export async function checkIsAdmin(token: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/admin/check'), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = (await res.json()) as { ok: boolean; isAdmin?: boolean }
    return res.ok && !!data.isAdmin
  } catch {
    return false
  }
}

export async function fetchAdminDashboard(token: string): Promise<AdminDashboard> {
  const res = await fetch(apiUrl('/api/admin/dashboard'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await res.json()) as {
    ok: boolean
    message?: string
    dashboard?: AdminDashboard
  }
  if (!res.ok || !data.ok || !data.dashboard) {
    throw new Error(data.message ?? '加载管理后台失败')
  }
  return data.dashboard
}
