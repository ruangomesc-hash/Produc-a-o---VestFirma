import type { SessionProfile } from './userRoles'
import {
  loginFailureTitle,
  parseLoginHttpFailure,
  type ApiErrorPayload,
  type LoginFailure,
} from './loginErrors'
import {
  getApiBase,
  initRuntimeConfig,
  requiresLogin as runtimeRequiresLogin,
} from './runtimeConfig'

const TOKEN_KEY = 'vestfirma_auth_token'

/** Cópia em memória — evita race entre login e primeiro GET /board se sessionStorage atrasar. */
let memoryToken: string | null = null

/** Após login, ignorar logout automático por 401 “fantasma” (remount / requisição antiga). */
let authGraceUntil = 0

/** Incrementa a cada login/logout para ignorar 401 de requisições antigas (Strict Mode / remount). */
let authGeneration = 0

export function getAuthGeneration(): number {
  return authGeneration
}

function bumpAuthGeneration(): number {
  authGeneration += 1
  return authGeneration
}

export type LoginResult =
  | { ok: true; profile: SessionProfile }
  | ({ ok: false } & LoginFailure)

function apiPath(segment: string): string {
  const clean = segment.replace(/\.php$/i, '').replace(/^\//, '')
  return `/${clean}`
}

export function requiresLogin(): boolean {
  return runtimeRequiresLogin()
}

export async function ensureAuthConfigReady(): Promise<void> {
  await initRuntimeConfig()
}

export function markLoginGrace(ms = 10_000): void {
  authGraceUntil = Date.now() + ms
}

export function getSessionToken(): string | null {
  if (memoryToken) return memoryToken
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setSessionToken(token: string): void {
  const trimmed = token.trim()
  memoryToken = trimmed
  try {
    sessionStorage.setItem(TOKEN_KEY, trimmed)
  } catch {
    /* memória ainda vale nesta aba */
  }
  bumpAuthGeneration()
  markLoginGrace()
}

export function clearSessionToken(): void {
  memoryToken = null
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function authHeaders(): Record<string, string> {
  const token = getSessionToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function notifyUnauthorized(): void {
  if (Date.now() < authGraceUntil) return
  clearSessionToken()
  bumpAuthGeneration()
  window.dispatchEvent(new CustomEvent('vestfirma:unauthorized'))
}

/** GET /session sem deslogar — usado para confirmar 401 antes de expulsar o usuário. */
export async function probeSessionProfile(): Promise<SessionProfile | null> {
  await initRuntimeConfig()
  const base = getApiBase()
  const token = getSessionToken()
  if (!base || !token) return null

  try {
    const res = await fetch(`${base}${apiPath('session')}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      ok?: boolean
      user?: string
      email?: string
      role?: string
      userId?: string
    }
    if (!data.ok) return null
    return parseProfile(data)
  } catch {
    return null
  }
}

let logoutConfirmQueue: Promise<void> | null = null

/** Só desloga se /api/session também não reconhecer o token. */
export function requestAuthFailureLogout(_reason?: string): void {
  if (Date.now() < authGraceUntil) return
  if (logoutConfirmQueue) return
  logoutConfirmQueue = (async () => {
    try {
      const still = await probeSessionProfile()
      if (still) return
      notifyUnauthorized()
    } finally {
      logoutConfirmQueue = null
    }
  })()
}

function parseProfile(data: {
  user?: string
  email?: string
  role?: string
  userId?: string
}): SessionProfile {
  return {
    user: data.user || data.email || 'Usuário',
    email: data.email || '',
    role: (data.role as SessionProfile['role']) || 'vendedor',
    userId: data.userId || undefined,
  }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  await initRuntimeConfig()
  const base = getApiBase()
  if (!base) {
    return {
      ok: false,
      code: 'CONFIG',
      error: 'API não configurada no front (VITE_API_BASE / vestfirma-config.json).',
      fix: 'Em produção, vestfirma-config.json na raiz com "apiBase": "/api".',
    }
  }

  const loginId = email.trim()
  const requestUrl = `${base}${apiPath('login')}`

  try {
    const res = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: loginId, password }),
    })

    const rawBody = await res.text()
    let json: ApiErrorPayload = {}
    if (rawBody.trim()) {
      try {
        json = JSON.parse(rawBody) as ApiErrorPayload
      } catch {
        json = {}
      }
    }

    if (!res.ok) {
      const failure = parseLoginHttpFailure(res, requestUrl, rawBody, json)
      return { ok: false, ...failure }
    }

    const data = json as ApiErrorPayload & {
      token?: string
      user?: string
      email?: string
      role?: string
      userId?: string
    }

    if (!data.token) {
      return {
        ok: false,
        code: 'NO_TOKEN',
        error: 'Login respondeu OK, mas sem token de sessão.',
        fix: 'API desatualizada — redeploy e teste POST /api/login.',
        detail: rawBody.slice(0, 180),
        httpStatus: res.status,
        requestUrl,
      }
    }

    setSessionToken(data.token)
    return { ok: true, profile: parseProfile(data) }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      code: 'NETWORK',
      error: 'Não foi possível contactar a API de login.',
      fix: 'Verifique internet e se /api/health abre no navegador.',
      detail,
      requestUrl,
    }
  }
}

export { loginFailureTitle }

export async function logout(): Promise<void> {
  const base = getApiBase()
  const token = getSessionToken()
  clearSessionToken()
  bumpAuthGeneration()
  if (!base || !token) return

  try {
    await fetch(`${base}${apiPath('logout')}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    /* ignore */
  }
}

export async function fetchSessionProfile(): Promise<SessionProfile | null> {
  await initRuntimeConfig()
  if (!requiresLogin()) return null
  const base = getApiBase()
  const token = getSessionToken()
  if (!base || !token) return null

  const authGen = getAuthGeneration()

  try {
    const res = await fetch(`${base}${apiPath('session')}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...authHeaders() },
    })
    if (res.status === 401) {
      if (authGen === getAuthGeneration()) {
        clearSessionToken()
        bumpAuthGeneration()
      }
      return null
    }
    if (!res.ok) return null
    const data = (await res.json()) as {
      ok?: boolean
      user?: string
      email?: string
      role?: string
      userId?: string
    }
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

export function handleAuthResponse(status: number, requestGeneration?: number): void {
  if (status !== 401) return
  if (requestGeneration != null && requestGeneration !== getAuthGeneration()) return
  if (!getSessionToken()) return
  requestAuthFailureLogout('api-401')
}

/** Erros que indicam sessão inválida — não confundir com falha 500/rede ao carregar o quadro. */
export function isAuthSessionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const m = err.message.toLowerCase()
  return (
    m.includes('sessão expirada') ||
    m.includes('acesso negado') ||
    m.includes('login necessário') ||
    m.includes('não autenticado') ||
    m.includes('exige login')
  )
}

export type { SessionProfile }
