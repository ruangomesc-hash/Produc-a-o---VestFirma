const TOKEN_KEY = 'vestfirma_auth_token'

export type LoginResult =
  | { ok: true; user: string }
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

export async function login(username: string, password: string): Promise<LoginResult> {
  const base = apiBase()
  if (!base) {
    return { ok: false, error: 'API não configurada' }
  }

  try {
    const res = await fetch(`${base}${apiPath('login.php')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    })

    const data = (await res.json().catch(() => ({}))) as {
      token?: string
      user?: string
      error?: string
    }

    if (!res.ok) {
      return { ok: false, error: data.error || 'Usuário ou senha incorretos' }
    }

    if (!data.token) {
      return { ok: false, error: 'Resposta inválida do servidor' }
    }

    setSessionToken(data.token)
    return { ok: true, user: data.user || username.trim() }
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

export async function verifySession(): Promise<boolean> {
  if (!requiresLogin()) return true
  const base = apiBase()
  const token = getSessionToken()
  if (!base || !token) return false

  try {
    const res = await fetch(`${base}${apiPath('session.php')}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...authHeaders() },
    })
    if (res.status === 401) {
      clearSessionToken()
      return false
    }
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return Boolean(data.ok)
  } catch {
    return false
  }
}

export function handleAuthResponse(status: number): void {
  if (status === 401) notifyUnauthorized()
}
