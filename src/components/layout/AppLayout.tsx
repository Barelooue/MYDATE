import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { format, isValid } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Bell, Calendar, Globe, PictureInPicture2 } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { UserBadge } from '@/components/auth/UserBadge'
import { useAppStore } from '@/stores/appStore'
import { useAnalytics } from '@/hooks/useAnalytics'
import { cn } from '@/lib/utils'
import { formatUtcOffset } from '@/services/timezoneService'
import { useDesktopWidget } from '@/hooks/useDesktopWidget'

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/app': { title: '任务看板', subtitle: '记录与管理每日待办' },
  '/app/calendar': { title: '日历视图', subtitle: '纵览历史与未来安排' },
  '/app/ai-scheduler': { title: 'AI 智能规划', subtitle: '优先级排序 · 黄金时段排程' },
  '/app/settings': { title: '设置 & 闹钟', subtitle: '个性化配置与提醒同步' },
}

export function AppLayout() {
  const location = useLocation()
  useAnalytics()
  const selectedDate = useAppStore((s) => s.selectedDate)
  const settings = useAppStore((s) => s.settings)
  const timezoneInfo = useAppStore((s) => s.timezoneInfo)

  const pageInfo = pageTitles[location.pathname] ?? pageTitles['/app']
  const dateObj = new Date(`${selectedDate}T12:00:00`)
  const formattedDate = format(
    isValid(dateObj) ? dateObj : new Date(),
    'M月d日 EEEE',
    { locale: zhCN },
  )
  const alarmEnabled = settings.alarm?.enabled ?? true
  const { open: widgetOpen, toggle: toggleWidget, pipSupported } = useDesktopWidget()
  const [widgetError, setWidgetError] = useState<string | null>(null)

  async function handleDesktopWidget() {
    try {
      setWidgetError(null)
      await toggleWidget()
    } catch (e) {
      setWidgetError(e instanceof Error ? e.message : '无法打开桌面视图')
    }
  }

  return (
    <div className="relative flex h-full overflow-hidden">
      <div className="ambient-glow" aria-hidden="true" />

      <Sidebar />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Top header bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 px-6 glass-panel-light">
          <div>
            <h2 className="text-lg font-semibold text-white">{pageInfo.title}</h2>
            <p className="text-xs text-zinc-500">{pageInfo.subtitle}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-xl glass-panel-light px-3 py-1.5 sm:flex">
              <Globe className="h-3.5 w-3.5 text-accent-400" />
              <span className="text-xs text-zinc-400">
                {timezoneInfo.city ?? timezoneInfo.timezone}{' '}
                <span className="text-zinc-600">{formatUtcOffset(timezoneInfo.timezone)}</span>
              </span>
            </div>

            <div className="hidden items-center gap-2 rounded-xl glass-panel-light px-3 py-1.5 sm:flex">
              <Calendar className="h-3.5 w-3.5 text-accent-400" />
              <span className="text-xs text-zinc-300">{formattedDate}</span>
            </div>

            <div
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs',
                alarmEnabled
                  ? 'bg-success/10 text-success'
                  : 'bg-white/5 text-zinc-500',
              )}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>{alarmEnabled ? '提醒已开启' : '提醒已关闭'}</span>
            </div>

            <button
              type="button"
              onClick={() => void handleDesktopWidget()}
              title={
                pipSupported
                  ? '打开置顶浮动窗查看今日日程'
                  : '打开小窗查看今日日程（建议使用 Chrome / Edge）'
              }
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs transition',
                widgetOpen
                  ? 'bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/40'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white',
              )}
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {widgetOpen ? '关闭桌面视图' : '桌面小组件'}
              </span>
            </button>

            <div className="rounded-xl glass-panel-light px-2 py-1 sm:px-3 sm:py-1.5">
              <UserBadge size="sm" />
            </div>
          </div>
        </header>

        {widgetError && (
          <p className="shrink-0 border-b border-red-500/20 bg-red-500/10 px-6 py-1.5 text-xs text-red-300">
            {widgetError}
          </p>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mx-auto max-w-6xl"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
