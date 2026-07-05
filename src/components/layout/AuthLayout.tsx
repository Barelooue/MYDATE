import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sun } from 'lucide-react'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      <div className="ambient-glow" aria-hidden="true" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-gold-500 shadow-lg shadow-accent-500/25">
            <Sun className="h-5 w-5 text-white" />
          </div>
          <span className="text-sm font-semibold gradient-text">MyDate</span>
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md rounded-2xl glass-panel p-8 shadow-2xl shadow-black/30"
        >
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
          </div>

          {children}

          {footer && <div className="mt-6 text-center text-sm text-zinc-500">{footer}</div>}
        </motion.div>
      </main>
    </div>
  )
}
