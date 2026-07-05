import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  CalendarDays,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { UserBadge } from '@/components/auth/UserBadge'

const navItems = [
  {
    path: '/app',
    label: '任务看板',
    sublabel: 'Task Board',
    icon: LayoutDashboard,
    gradient: 'from-violet-500/20 to-violet-600/5',
    activeBorder: 'border-violet-500/50',
    activeGlow: 'shadow-violet-500/20',
  },
  {
    path: '/app/calendar',
    label: '日历视图',
    sublabel: 'Calendar',
    icon: CalendarDays,
    gradient: 'from-amber-500/20 to-amber-600/5',
    activeBorder: 'border-amber-500/50',
    activeGlow: 'shadow-amber-500/20',
  },
  {
    path: '/app/ai-scheduler',
    label: 'AI 规划',
    sublabel: 'AI Scheduler',
    icon: Sparkles,
    gradient: 'from-fuchsia-500/20 to-fuchsia-600/5',
    activeBorder: 'border-fuchsia-500/50',
    activeGlow: 'shadow-fuchsia-500/20',
  },
  {
    path: '/app/settings',
    label: '设置 & 闹钟',
    sublabel: 'Settings',
    icon: Settings,
    gradient: 'from-emerald-500/20 to-emerald-600/5',
    activeBorder: 'border-emerald-500/50',
    activeGlow: 'shadow-emerald-500/20',
  },
] as const

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative z-20 flex h-full shrink-0 flex-col glass-panel border-r border-white/5"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/5 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-gold-500 shadow-lg shadow-accent-500/25">
          <Sun className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden"
          >
            <h1 className="text-base font-bold tracking-tight gradient-text">MyDate</h1>
            <p className="text-[10px] text-zinc-500">智能日程管理</p>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/app'}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-all duration-200',
                'hover:bg-white/5',
                isActive && [
                  `bg-gradient-to-r ${item.gradient}`,
                  item.activeBorder,
                  'shadow-lg',
                  item.activeGlow,
                ],
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'bg-white/5 text-zinc-400 group-hover:text-zinc-200',
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                </div>
                {!collapsed && (
                  <div className="min-w-0 overflow-hidden">
                    <p
                      className={cn(
                        'truncate text-sm font-medium',
                        isActive ? 'text-white' : 'text-zinc-300',
                      )}
                    >
                      {item.label}
                    </p>
                    <p className="truncate text-[10px] text-zinc-500">{item.sublabel}</p>
                  </div>
                )}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-accent-400"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User profile */}
      <div className="border-t border-white/5 px-3 py-3">
        {collapsed ? (
          <div className="flex justify-center">
            <UserBadge avatarOnly size="sm" />
          </div>
        ) : (
          <UserBadge showEmail size="sm" />
        )}
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-white/5 p-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">收起导航</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  )
}
