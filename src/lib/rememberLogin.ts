import type { RememberedLogin } from '@/types/auth'

const STORAGE_KEY = 'mydate-remember-login'

export function loadRememberedLogin(): RememberedLogin | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as RememberedLogin
    if (!data.username || !data.password) return null
    return data
  } catch {
    return null
  }
}

export function saveRememberedLogin(username: string, password: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ username, password }))
}

export function clearRememberedLogin() {
  localStorage.removeItem(STORAGE_KEY)
}
