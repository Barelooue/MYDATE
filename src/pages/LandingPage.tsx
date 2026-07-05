import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarDays, Sparkles, Sun } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { UserBadge } from '@/components/auth/UserBadge'
import { enterAppWithSession } from '@/lib/netlifyIdentityAuth'

export function LandingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [ready, setReady] = useState(useAuthStore.persist.hasHydrated())

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setReady(true)
      return
    }
    return useAuthStore.persist.onFinishHydration(() => setReady(true))
  }, [])

  const isLoggedIn = ready && !!user

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      <div className="ambient-glow" aria-hidden="true" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-gold-500 shadow-lg shadow-accent-500/25">
            <Sun className="h-5 w-5 text-white" />
          </div>
          <span className="text-sm font-semibold text-zinc-300">MyDate</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isLoggedIn ? (
            <>
              <UserBadge showEmail className="hidden sm:flex" />
              <button
                id="enter-app-btn"
                type="button"
                onClick={() => void enterAppWithSession().then((ok) => ok && navigate('/app'))}
                className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-500"
              >
                进入应用
              </button>
            </>
          ) : (
            <>
              <button
                id="login-btn"
                type="button"
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/5"
              >
                Log in
              </button>
              <button
                id="signup-btn"
                type="button"
                className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-500"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
            <span className="gradient-text">MyDate</span>
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
            智能日程与任务管理，帮你记录每一天、规划每一刻。
            AI 辅助排程、日历纵览、闹钟提醒，让自律变得更简单。
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-16 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {[
            { icon: CalendarDays, title: '日历视图', desc: '纵览过去与未来的安排' },
            { icon: Sparkles, title: 'AI 规划', desc: '智能排序与黄金时段排程' },
            { icon: Sun, title: '闹钟提醒', desc: '到点通知，不错过重要事项' },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl glass-panel-light px-5 py-4 text-left"
            >
              <item.icon className="mb-2 h-5 w-5 text-accent-400" />
              <p className="text-sm font-medium text-zinc-200">{item.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  )
}
