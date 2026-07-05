import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Clock,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { fetchAdminDashboard } from '@/services/adminService'
import type { AdminDashboard } from '@/types/admin'
import { cn } from '@/lib/utils'

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Users
  label: string
  value: string | number
  sub?: string
  accent: string
}) {
  return (
    <div className="rounded-2xl glass-panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn('rounded-lg p-2', accent)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

function BarChart<T extends object>({
  items,
  valueKey,
  labelKey,
  unit = '',
}: {
  items: T[]
  valueKey: keyof T
  labelKey: keyof T
  unit?: string
}) {
  const max = Math.max(
    ...items.map((i) => Number((i as Record<string, unknown>)[valueKey as string]) || 0),
    1,
  )

  return (
    <div className="flex h-48 items-end gap-2">
      {items.map((item, idx) => {
        const rec = item as Record<string, unknown>
        const value = Number(rec[valueKey as string]) || 0
        const height = Math.max((value / max) * 100, value > 0 ? 8 : 2)
        return (
          <div key={idx} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-[10px] text-zinc-400">
              {value}
              {unit}
            </span>
            <div
              className="w-full rounded-t-lg bg-gradient-to-t from-accent-600 to-accent-400 transition-all"
              style={{ height: `${height}%` }}
            />
            <span className="text-[10px] text-zinc-500">{String(rec[labelKey as string])}</span>
          </div>
        )
      })}
    </div>
  )
}

export function AdminDashboardPage() {
  const token = useAuthStore((s) => s.token)
  const [data, setData] = useState<AdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      setData(await fetchAdminDashboard(token))
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const maxPageCount = Math.max(...(data?.pageTotals.map((p) => p.count) ?? [1]), 1)

  return (
    <div className="min-h-full bg-surface-950">
      <div className="ambient-glow" aria-hidden="true" />

      <header className="relative z-10 border-b border-white/5 px-6 py-4 glass-panel-light">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/app"
              className="rounded-lg border border-white/10 p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-white">MyDate 管理后台</h1>
              <p className="text-xs text-zinc-500">用户不可见 · 仅管理员可访问</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            刷新
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-6">
        {loading && !data && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent-400" />
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        )}

        {data && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={Users}
                label="注册用户"
                value={data.summary.registeredCount}
                sub={`已追踪 ${data.summary.trackedUsers} 人`}
                accent="bg-violet-600/30"
              />
              <StatCard
                icon={Activity}
                label="今日活跃"
                value={data.summary.activeToday}
                sub="今日有使用行为的用户"
                accent="bg-emerald-600/30"
              />
              <StatCard
                icon={Clock}
                label="累计使用"
                value={`${data.summary.totalHours}h`}
                sub="所有用户在线时长合计"
                accent="bg-amber-600/30"
              />
              <StatCard
                icon={BarChart3}
                label="今日登录"
                value={data.last7Days.at(-1)?.logins ?? 0}
                sub="今日登录次数"
                accent="bg-fuchsia-600/30"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl glass-panel p-5">
                <h2 className="mb-4 text-sm font-semibold text-zinc-200">近 7 日活跃用户</h2>
                <BarChart
                  items={data.last7Days}
                  valueKey="activeUsers"
                  labelKey="label"
                  unit="人"
                />
              </section>

              <section className="rounded-2xl glass-panel p-5">
                <h2 className="mb-4 text-sm font-semibold text-zinc-200">近 7 日使用时长（分钟）</h2>
                <BarChart
                  items={data.last7Days}
                  valueKey="totalMinutes"
                  labelKey="label"
                />
              </section>
            </div>

            <section className="rounded-2xl glass-panel p-5">
              <h2 className="mb-4 text-sm font-semibold text-zinc-200">功能页面访问分布</h2>
              <div className="space-y-3">
                {data.pageTotals.map((page) => (
                  <div key={page.key}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-zinc-300">{page.label}</span>
                      <span className="text-zinc-500">{page.count} 次</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-600 to-gold-500"
                        style={{ width: `${(page.count / maxPageCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl glass-panel p-5">
              <h2 className="mb-4 text-sm font-semibold text-zinc-200">用户明细</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-zinc-500">
                      <th className="pb-2 pr-4 font-medium">用户名</th>
                      <th className="pb-2 pr-4 font-medium">邮箱</th>
                      <th className="pb-2 pr-4 font-medium">登录次数</th>
                      <th className="pb-2 pr-4 font-medium">使用时长</th>
                      <th className="pb-2 pr-4 font-medium">最常用页面</th>
                      <th className="pb-2 font-medium">最后活跃</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-zinc-500">
                          暂无使用数据，用户登录并使用应用后会自动记录
                        </td>
                      </tr>
                    ) : (
                      data.users.map((u) => (
                        <tr key={u.userId} className="border-b border-white/5 text-zinc-300">
                          <td className="py-3 pr-4 font-medium text-white">{u.username}</td>
                          <td className="py-3 pr-4">{u.email}</td>
                          <td className="py-3 pr-4">{u.loginCount}</td>
                          <td className="py-3 pr-4">{u.totalMinutes} 分钟</td>
                          <td className="py-3 pr-4">{u.topPage}</td>
                          <td className="py-3 text-zinc-500">
                            {u.lastSeen
                              ? format(new Date(u.lastSeen), 'M月d日 HH:mm', { locale: zhCN })
                              : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
