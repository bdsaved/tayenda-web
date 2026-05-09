import type { UserResponse } from './api'

const TOKEN_KEY = 'tayenda.operator.token'
const USER_KEY = 'tayenda.operator.user'

export function getStoredToken() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): UserResponse | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(USER_KEY)
  if (!value) return null
  try {
    return JSON.parse(value) as UserResponse
  } catch {
    return null
  }
}

export function storeSession(token: string, user: UserResponse) {
  window.localStorage.setItem(TOKEN_KEY, token)
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export function isLoggedIn() {
  return Boolean(getStoredToken())
}
