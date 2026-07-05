export interface AdminDashboardSummary {
  registeredCount: number
  trackedUsers: number
  activeToday: number
  totalHours: number
}

export interface AdminPageTotal {
  key: string
  label: string
  count: number
}

export interface AdminDailyStat {
  date: string
  label: string
  activeUsers: number
  totalMinutes: number
  logins: number
}

export interface AdminUserRow {
  userId: string
  username: string
  email: string
  loginCount: number
  totalMinutes: number
  lastSeen: string
  topPage: string
  pageViews: Record<string, number>
  features: Record<string, number>
}

export interface AdminDashboard {
  summary: AdminDashboardSummary
  pageTotals: AdminPageTotal[]
  last7Days: AdminDailyStat[]
  users: AdminUserRow[]
}
