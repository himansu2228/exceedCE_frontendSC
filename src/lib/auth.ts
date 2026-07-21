const AUTH_STORAGE_KEY = 'exceedce-authenticated'
const AUTH_SESSION_KEY = 'exceedce-authenticated-session'
const AUTH_ACTIVITY_KEY = 'exceedce-last-activity'
const AUTH_USER_STORAGE_KEY = 'exceedce-auth-user'

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000

const DEFAULT_PROD_API_ORIGIN = 'https://scexceedceapi.cognitiev.com'

function getApiBase(): string {
  const requestedApiOrigin = (
    (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
    (import.meta.env.DEV ? 'http://localhost:3000' : DEFAULT_PROD_API_ORIGIN)
  )

  const isLocalhostOrigin = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(requestedApiOrigin)
  const rawApiOrigin = !import.meta.env.DEV && isLocalhostOrigin
    ? DEFAULT_PROD_API_ORIGIN
    : requestedApiOrigin

  const apiOrigin = rawApiOrigin.replace(/\/+$/, '')
  return apiOrigin ? `${apiOrigin}/api` : '/api'
}

export interface DashboardAuthUser {
  id: number
  username: string
  state: string
}

function nowMs(): number {
  return Date.now()
}

function isTimedOut(storage: Storage): boolean {
  const raw = storage.getItem(AUTH_ACTIVITY_KEY)

  if (!raw) {
    return true
  }

  const lastActivity = Number(raw)

  if (!Number.isFinite(lastActivity)) {
    return true
  }

  return nowMs() - lastActivity > SESSION_TIMEOUT_MS
}

function clearStorage(storage: Storage): void {
  storage.removeItem(AUTH_STORAGE_KEY)
  storage.removeItem(AUTH_ACTIVITY_KEY)
  storage.removeItem(AUTH_USER_STORAGE_KEY)
}

function writeAuth(storage: Storage, user?: DashboardAuthUser): void {
  storage.setItem(AUTH_STORAGE_KEY, 'true')
  storage.setItem(AUTH_ACTIVITY_KEY, String(nowMs()))
  if (user) {
    storage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))
  }
}

function getActiveStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  const localActive = window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
  const sessionActive = window.sessionStorage.getItem(AUTH_SESSION_KEY) === 'true'

  if (localActive) {
    return window.localStorage
  }

  if (sessionActive) {
    return window.sessionStorage
  }

  return null
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const localActive = window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true'

  if (localActive) {
    if (isTimedOut(window.localStorage)) {
      clearStorage(window.localStorage)
      return false
    }

    return true
  }

  const sessionActive = window.sessionStorage.getItem(AUTH_SESSION_KEY) === 'true'

  if (sessionActive) {
    if (isTimedOut(window.sessionStorage)) {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY)
      window.sessionStorage.removeItem(AUTH_ACTIVITY_KEY)
      return false
    }

    return true
  }

  return false
}

export async function signIn(username: string, password: string, remember = true): Promise<boolean> {
  const inputUsername = username.trim()
  const inputPassword = password

  if (!inputUsername || !inputPassword) {
    return false
  }

  let user: DashboardAuthUser | null = null
  try {
    const response = await fetch(`${getApiBase()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: inputUsername, password: inputPassword }),
    })

    if (!response.ok) {
      return false
    }

    const payload = await response.json() as { success?: boolean; user?: DashboardAuthUser }
    if (!payload.success || !payload.user) {
      return false
    }

    user = payload.user
  } catch {
    return false
  }

  if (typeof window !== 'undefined') {
    clearStorage(window.localStorage)
    window.sessionStorage.removeItem(AUTH_SESSION_KEY)
    window.sessionStorage.removeItem(AUTH_ACTIVITY_KEY)
    window.sessionStorage.removeItem(AUTH_USER_STORAGE_KEY)

    if (remember) {
      writeAuth(window.localStorage, user || undefined)
    } else {
      window.sessionStorage.setItem(AUTH_SESSION_KEY, 'true')
      window.sessionStorage.setItem(AUTH_ACTIVITY_KEY, String(nowMs()))
      if (user) {
        window.sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))
      }
    }
  }

  return true
}

export function touchAuthSession(): void {
  if (typeof window === 'undefined') {
    return
  }

  if (!isAuthenticated()) {
    return
  }

  const storage = getActiveStorage()

  if (!storage) {
    return
  }

  storage.setItem(AUTH_ACTIVITY_KEY, String(nowMs()))
}

export function signOut(): void {
  if (typeof window === 'undefined') {
    return
  }

  clearStorage(window.localStorage)
  window.sessionStorage.removeItem(AUTH_SESSION_KEY)
  window.sessionStorage.removeItem(AUTH_ACTIVITY_KEY)
}
