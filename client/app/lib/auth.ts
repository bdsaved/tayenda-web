import type { UserResponse } from './api'

const TOKEN_KEY = 'tayenda.operator.token'
const USER_KEY = 'tayenda.operator.user'
const EXPIRED_KEY = 'tayenda.operator.session-expired'

function storage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function getStoredToken() {
  return storage('local')?.getItem(TOKEN_KEY) ?? null
}

export function getStoredUser(): UserResponse | null {
  const value = storage('local')?.getItem(USER_KEY)
  if (!value) return null
  try {
    return JSON.parse(value) as UserResponse
  } catch {
    return null
  }
}

export function storeSession(token: string, user: UserResponse) {
  const local = storage('local')
  local?.setItem(TOKEN_KEY, token)
  local?.setItem(USER_KEY, JSON.stringify(user))
}

export function storeUser(user: UserResponse) {
  storage('local')?.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  const local = storage('local')
  local?.removeItem(TOKEN_KEY)
  local?.removeItem(USER_KEY)
}

export function isLoggedIn() {
  return Boolean(getStoredToken())
}

/** Flag read once by the login page to explain why the user landed there. */
export function markSessionExpired() {
  storage('session')?.setItem(EXPIRED_KEY, '1')
}

export function consumeSessionExpired() {
  const session = storage('session')
  const expired = session?.getItem(EXPIRED_KEY) === '1'
  session?.removeItem(EXPIRED_KEY)
  return expired
}
