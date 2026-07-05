import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { useAuthStore } from '@/stores/authStore'
import { openNetlifyLogin, openNetlifySignup } from '@/lib/netlifyIdentityAuth'

const actionButtonClass =
  'flex w-full items-center justify-center rounded-xl bg-accent-600 py-3 text-sm font-medium text-white transition hover:bg-accent-500'

export function LoginPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user) {
      navigate('/app', { replace: true })
      return
    }
    openNetlifyLogin()
  }, [user, navigate])

  return (
    <AuthLayout
      title="登录 MyDate"
      subtitle="使用 Netlify Identity 安全登录"
      footer={
        <>
          还没有账号？{' '}
          <Link to="/signup" className="text-accent-400 hover:text-accent-300">
            立即注册
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-center text-xs text-zinc-500">
          登录窗口应已自动弹出；若未出现，请点击下方按钮。
        </p>
        <button
          id="login-btn"
          type="button"
          onClick={() => void openNetlifyLogin()}
          className={actionButtonClass}
        >
          打开登录窗口
        </button>
      </div>
    </AuthLayout>
  )
}

export function SignUpPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user) {
      navigate('/app', { replace: true })
      return
    }
    openNetlifySignup()
  }, [user, navigate])

  return (
    <AuthLayout
      title="注册 MyDate"
      subtitle="使用 Netlify Identity 创建账号"
      footer={
        <>
          已有账号？{' '}
          <Link to="/login" className="text-accent-400 hover:text-accent-300">
            去登录
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-center text-xs text-zinc-500">
          注册窗口应已自动弹出；若未出现，请点击下方按钮。
        </p>
        <button
          id="signup-btn"
          type="button"
          onClick={() => void openNetlifySignup()}
          className={actionButtonClass}
        >
          打开注册窗口
        </button>
      </div>
    </AuthLayout>
  )
}
