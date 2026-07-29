import type { SessionProfile } from './userRoles'

const TOKEN_KEY = 'vestfirma_auth_token'

export type LoginResult =
  | { ok: true; profile: SessionProfile }
  | { ok: false; error: string }

function apiBase(): string | null {
  const raw = import.meta.env.VITE_API_BASE?.trim()
  if (!raw) return null
  return raw.replace(/\/$/, '')
}

function apiPath(file: string): string {
  return file.startsWith('/') ? file : `/${file}`
}

export function requiresLogin(): boolean {
  if (!apiBase()) return false
  const flag = import.meta.env.VITE_REQUIRE_LOGIN?.trim().toLowerCase()
  return flag === 'true' || flag === '1'
}

export function getSessionToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setSessionToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearSessionToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

export function authHeaders(): Record<string, string> {
  const token = getSessionToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function notifyUnauthorized(): void {
  clearSessionToken()
  window.dispatchEvent(new CustomEvent('vestfirma:unauthorized'))
}

function parseProfile(data: {
  user?: string
  email?: string
  role?: string
}): SessionProfile {
  return {
    user: data.user || data.email || 'Usuário',
    email: data.email || '',
    role: (data.role as SessionProfile['role']) || 'vendedor',
  }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const base = apiBase()
  if (!base) {
    return { ok: false, error: 'API não configurada' }
  }

  const loginId = email.trim()

  try {
    const res = await fetch(`${base}${apiPath('login.php')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: loginId, password }),
    })

    const data = (await res.json().catch(() => ({}))) as {
      token?: string
      user?: string
      email?: string
      role?: string
      error?: string
    }

    if (!res.ok) {
      return { ok: false, error: data.error || 'E-mail ou senha incorretos' }
    }

    if (!data.token) {
      return { ok: false, error: 'Resposta inválida do servidor' }
    }

    setSessionToken(data.token)
    return { ok: true, profile: parseProfile(data) }
  } catch {
    return { ok: false, error: 'Não foi possível conectar ao servidor' }
  }
}

export async function logout(): Promise<void> {
  const base = apiBase()
  const token = getSessionToken()
  clearSessionToken()
  if (!base || !token) return

  try {
    await fetch(`${base}${apiPath('logout.php')}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    /* ignore */
  }
}

export async function fetchSessionProfile(): Promise<SessionProfile | null> {
  if (!requiresLogin()) return null
  const base = apiBase()
  const token = getSessionToken()
  if (!base || !token) return null

  try {
    const res = await fetch(`${base}${apiPath('session.php')}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...authHeaders() },
    })
    if (res.status === 401) {
      clearSessionToken()
      return null
    }
    if (!res.ok) return null
    const data = (await res.json()) as { ok?: boolean; user?: string; email?: string; role?: string }
    if (!data.ok) return null
    return parseProfile(data)
  } catch {
    return null
  }
}

export async function verifySession(): Promise<boolean> {
  const profile = await fetchSessionProfile()
  return profile !== null
}

export function handleAuthResponse(status: number): void {
  if (status === 401) notifyUnauthorized()
}

export type { SessionProfile }
