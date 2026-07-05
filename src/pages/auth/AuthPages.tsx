import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import {
  completeRegister,
  loginWithPassword,
  sendVerificationCode,
  verifyEmailForRegister,
} from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import {
  clearRememberedLogin,
  loadRememberedLogin,
  saveRememberedLogin,
} from '@/lib/rememberLogin'
import {
  getPasswordValidationError,
  PASSWORD_INVALID_MESSAGE,
  PASSWORD_POLICY_HINT,
} from '@/lib/passwordPolicy'
import { cn } from '@/lib/utils'

const COOLDOWN_SEC = 60

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white outline-none transition focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/30'

export function LoginPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const user = useAuthStore((s) => s.user)

  const remembered = loadRememberedLogin()
  const [username, setUsername] = useState(remembered?.username ?? '')
  const [password, setPassword] = useState(remembered?.password ?? '')
  const [remember, setRemember] = useState(!!remembered)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) navigate('/app', { replace: true })
  }, [user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password) {
      setError('请输入用户名和密码')
      return
    }
    setSubmitting(true)
    try {
      const session = await loginWithPassword(username.trim(), password)
      if (remember) {
        saveRememberedLogin(username.trim(), password)
      } else {
        clearRememberedLogin()
      }
      setSession(session.user, session.token)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="登录 MyDate"
      subtitle="使用用户名和密码登录"
      footer={
        <>
          还没有账号？{' '}
          <Link to="/signup" className="text-accent-400 hover:text-accent-300">
            立即注册
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label htmlFor="username" className="mb-1.5 block text-xs text-zinc-400">
            用户名
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="你的用户名"
              className={cn(inputClass, 'pl-10 pr-3')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs text-zinc-400">
            密码
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="你的密码"
              className={cn(inputClass, 'pl-10 pr-10')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded border-white/20 bg-white/5 accent-accent-500"
          />
          记住密码
        </label>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 py-3 text-sm font-medium text-white transition hover:bg-accent-500 disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          登录
        </button>
      </form>
    </AuthLayout>
  )
}

export function SignUpPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const user = useAuthStore((s) => s.user)

  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [devCode, setDevCode] = useState<string | null>(null)

  useEffect(() => {
    if (user) navigate('/app', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  async function handleSendCode() {
    setError(null)
    setMessage(null)
    setDevCode(null)
    if (!email.trim()) {
      setError('请输入邮箱地址')
      return
    }
    setSending(true)
    try {
      const result = await sendVerificationCode(email.trim())
      setMessage(result.message)
      if (result.devCode) setDevCode(result.devCode)
      setCooldown(COOLDOWN_SEC)
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !code.trim()) {
      setError('请填写邮箱和验证码')
      return
    }
    setSubmitting(true)
    try {
      const result = await verifyEmailForRegister(email.trim(), code.trim())
      setSetupToken(result.setupToken)
      setMessage(result.message)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCompleteRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password || !confirmPassword) {
      setError('请填写用户名和密码')
      return
    }
    const passwordError = getPasswordValidationError(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    const confirmPolicyError = getPasswordValidationError(confirmPassword)
    if (confirmPolicyError && confirmPolicyError !== '请输入密码') {
      setError(confirmPolicyError)
      return
    }
    setSubmitting(true)
    try {
      const session = await completeRegister({
        setupToken,
        username: username.trim(),
        password,
        confirmPassword,
      })
      setSession(session.user, session.token)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败')
    } finally {
      setSubmitting(false)
    }
  }

  const passwordPolicyError =
    step === 2 && password ? getPasswordValidationError(password) : null
  const showPasswordPolicyError =
    passwordPolicyError !== null && passwordPolicyError !== '请输入密码'

  return (
    <AuthLayout
      title="注册 MyDate"
      subtitle={step === 1 ? '第一步：验证邮箱' : '第二步：设置用户名和密码'}
      footer={
        <>
          已有账号？{' '}
          <Link to="/login" className="text-accent-400 hover:text-accent-300">
            去登录
          </Link>
        </>
      }
    >
      {step === 1 ? (
        <form onSubmit={(e) => void handleVerifyEmail(e)} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs text-zinc-400">
              邮箱地址
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={cn(inputClass, 'pl-10 pr-3')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="code" className="mb-1.5 block text-xs text-zinc-400">
              邮箱验证码
            </label>
            <div className="flex gap-2">
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6 位验证码"
                className={cn(inputClass, 'min-w-0 flex-1 px-3')}
              />
              <button
                type="button"
                disabled={sending || cooldown > 0}
                onClick={() => void handleSendCode()}
                className={cn(
                  'shrink-0 rounded-xl px-4 py-2.5 text-xs font-medium transition',
                  cooldown > 0 || sending
                    ? 'cursor-not-allowed bg-white/5 text-zinc-500'
                    : 'bg-white/10 text-zinc-200 hover:bg-white/15',
                )}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : cooldown > 0 ? (
                  `${cooldown}s`
                ) : (
                  '获取验证码'
                )}
              </button>
            </div>
          </div>

          {message && <p className="text-xs text-success">{message}</p>}
          {devCode && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-300">
              本地测试验证码：<span className="font-mono font-bold">{devCode}</span>
              <br />
              <span className="text-amber-400/80">
                未配置发信邮箱，此码不会发到邮件。请在项目 .env.local 配置 SMTP 后重启 npm run dev。
              </span>
            </p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 py-3 text-sm font-medium text-white transition hover:bg-accent-500 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            下一步：设置账号
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void handleCompleteRegister(e)} className="space-y-4">
          <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-400">
            已验证邮箱：<span className="text-zinc-200">{email}</span>
          </p>

          <div>
            <label htmlFor="username" className="mb-1.5 block text-xs text-zinc-400">
              用户名
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="2-20 位，用于下次登录"
                className={cn(inputClass, 'pl-10 pr-3')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" className="mb-1.5 block text-xs text-zinc-400">
              密码
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8-12 位，含大小写+数字或符号"
                className={cn(inputClass, 'pl-10 pr-10')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500">{PASSWORD_POLICY_HINT}</p>
            {showPasswordPolicyError && (
              <p className="mt-1.5 text-xs text-danger">{PASSWORD_INVALID_MESSAGE}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-xs text-zinc-400">
              确认密码
            </label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              className={cn(inputClass, 'px-3')}
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl border border-white/10 py-3 text-sm text-zinc-300 transition hover:bg-white/5"
            >
              上一步
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-600 py-3 text-sm font-medium text-white transition hover:bg-accent-500 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              完成注册
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
