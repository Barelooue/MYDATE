import netlifyIdentity from 'netlify-identity-widget'
import { useAuthStore } from '@/stores/authStore'
import type { AuthUser } from '@/types/auth'

export interface NetlifyIdentityUser {
  id: string
  email: string
  user_metadata?: {
    full_name?: string
    username?: string
  }
  token?: string | {
    access_token?: string
  }
}

function getAccessToken(user: NetlifyIdentityUser | null | undefined): string | null {
  if (!user?.token) return null
  if (typeof user.token === 'string') return user.token
  return user.token.access_token ?? null
}

function toAuthUser(user: NetlifyIdentityUser): AuthUser {
  const username =
    user.user_metadata?.username ||
    user.user_metadata?.full_name ||
    user.email.split('@')[0] ||
    user.id

  return {
    id: user.id,
    email: user.email,
    username,
  }
}

function syncSession(user: NetlifyIdentityUser | null | undefined) {
  const accessToken = getAccessToken(user)
  if (!user || !accessToken) {
    useAuthStore.getState().clearSession()
    return
  }
  useAuthStore.getState().setSession(toAuthUser(user), accessToken)
}

let identityReady = false
const identityReadyWaiters: Array<() => void> = []

function markIdentityReady() {
  if (identityReady) return
  identityReady = true
  identityReadyWaiters.splice(0).forEach((resolve) => resolve())
}

export function waitForNetlifyIdentityReady(): Promise<void> {
  if (identityReady) return Promise.resolve()
  return new Promise((resolve) => {
    identityReadyWaiters.push(resolve)
  })
}

export function setupNetlifyIdentityAuth() {
  netlifyIdentity.on('init', (user) => {
    syncSession(user as NetlifyIdentityUser | null)
    markIdentityReady()
  })

  netlifyIdentity.on('login', (user) => {
    syncSession(user as NetlifyIdentityUser)
  })

  netlifyIdentity.on('logout', () => {
    useAuthStore.getState().clearSession()
  })
}

export function openNetlifyLogin() {
  netlifyIdentity.open('login')
}

export function openNetlifySignup() {
  netlifyIdentity.open('signup')
}

export function logoutNetlifyIdentity() {
  netlifyIdentity.logout()
}

export function getNetlifyCurrentUser(): NetlifyIdentityUser | null {
  return netlifyIdentity.currentUser() as NetlifyIdentityUser | null
}

export function hasValidNetlifySession(
  user: AuthUser | null,
  token: string | null,
): boolean {
  if (!user || !token) return false
  const netlifyUser = getNetlifyCurrentUser()
  if (!netlifyUser) return false
  return netlifyUser.id === user.id && getAccessToken(netlifyUser) === token
}
