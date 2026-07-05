import type { AuthSession } from '@/types/auth'
import { apiUrl } from '@/lib/apiOrigin'

const API_BASE = apiUrl('/api/auth')

interface ApiResult {
  ok: boolean
  message: string
  devCode?: string
  setupToken?: string
  email?: string
  token?: string
  user?: AuthSession['user']
}

async function parseApiResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text.trim()) {
    throw new Error(
      import.meta.env.PROD
        ? '认证服务未响应：请确认服务器已启动 API 服务（npm run start:auth）且 Nginx 已配置 /api/ 反代'
        : '认证服务未响应，请刷新页面后重试',
    )
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('认证服务返回异常')
  }
}

async function postJson<T extends ApiResult>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('无法连接认证服务')
  }

  const data = await parseApiResponse<T>(res)
  if (!res.ok || !data.ok) {
    throw new Error(data.message || '请求失败')
  }
  return data
}

export async function sendVerificationCode(
  email: string,
): Promise<{ message: string; devCode?: string }> {
  const data = await postJson<ApiResult>('/send-code', { email })
  return { message: data.message, devCode: data.devCode }
}

export async function verifyEmailForRegister(
  email: string,
  code: string,
): Promise<{ setupToken: string; email: string; message: string }> {
  const data = await postJson<ApiResult>('/verify-email', { email, code })
  if (!data.setupToken || !data.email) throw new Error('验证响应无效')
  return { setupToken: data.setupToken, email: data.email, message: data.message }
}

export async function completeRegister(input: {
  setupToken: string
  username: string
  password: string
  confirmPassword: string
}): Promise<AuthSession> {
  const data = await postJson<ApiResult>('/complete-register', input)
  if (!data.token || !data.user) throw new Error('注册响应无效')
  return { token: data.token, user: data.user }
}

export async function loginWithPassword(
  username: string,
  password: string,
): Promise<AuthSession> {
  const data = await postJson<ApiResult>('/login', { username, password })
  if (!data.token || !data.user) throw new Error('登录响应无效')
  return { token: data.token, user: data.user }
}

export async function fetchCurrentUser(token: string): Promise<AuthSession['user'] | null> {
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseApiResponse<ApiResult>(res)
    if (!res.ok || !data.ok || !data.user) return null
    return data.user
  } catch {
    return null
  }
}

export async function logoutOnServer(token: string | null): Promise<void> {
  if (!token) return
  try {
    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    /* ignore */
  }
}
