/**
 * Configuração do site no ar (editável no FTP em vestfirma-config.json).
 * Em dev usa só variáveis VITE_* do .env.development.
 */

export type RuntimeConfig = {
  requireLogin: boolean
  apiBase: string | null
  serverRequireLogin: boolean
  originalImageUploads: boolean
  version: string
  ready: boolean
}

let state: RuntimeConfig = {
  requireLogin: false,
  apiBase: null,
  serverRequireLogin: false,
  originalImageUploads: false,
  version: '',
  ready: false,
}

function fromBuildEnv(): Pick<RuntimeConfig, 'requireLogin' | 'apiBase'> {
  const apiRaw = import.meta.env.VITE_API_BASE?.trim()
  const apiBase = apiRaw ? apiRaw.replace(/\/$/, '') : null
  const flag = import.meta.env.VITE_REQUIRE_LOGIN?.trim().toLowerCase()
  const requireLogin = flag === 'true' || flag === '1'
  return { requireLogin, apiBase }
}

function configUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? `${base}vestfirma-config.json` : `${base}/vestfirma-config.json`
}

function healthUrl(apiBase: string): string {
  return `${apiBase.replace(/\/$/, '')}/health`
}

export function getRuntimeConfig(): RuntimeConfig {
  return state
}

export function getApiBase(): string | null {
  return state.apiBase
}

/** Tela de login e bloqueio do app antes de autenticar. */
export function requiresLogin(): boolean {
  if (!state.ready) return false
  return state.requireLogin || state.serverRequireLogin
}

export function isRemoteSyncEnabled(): boolean {
  return getApiBase() !== null
}

export async function initRuntimeConfig(): Promise<RuntimeConfig> {
  if (state.ready) return state

  const env = fromBuildEnv()
  let requireLogin = env.requireLogin
  let apiBase = env.apiBase
  let version = ''
  let serverRequireLogin = false
  let originalImageUploads = false

  if (import.meta.env.PROD) {
    try {
      const res = await fetch(configUrl(), { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as {
          requireLogin?: boolean
          apiBase?: string
          version?: string
        }
        if (typeof json.requireLogin === 'boolean') requireLogin = json.requireLogin
        if (typeof json.apiBase === 'string' && json.apiBase.trim()) {
          apiBase = json.apiBase.trim().replace(/\/$/, '')
        }
        if (typeof json.version === 'string') version = json.version
      }
    } catch {
      /* usa env do build */
    }
  }

  if (apiBase) {
    try {
      const res = await fetch(healthUrl(apiBase), {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const json = (await res.json()) as { requireLogin?: boolean; originalImageUploads?: boolean }
        originalImageUploads = json.originalImageUploads === true
        if (json.requireLogin === true) {
          serverRequireLogin = true
          requireLogin = true
        }
      }
    } catch {
      /* API offline */
    }
  }

  state = {
    requireLogin,
    apiBase,
    serverRequireLogin,
    originalImageUploads,
    version,
    ready: true,
  }
  return state
}

/** Não usar cópia local quando o servidor exige login. */
export function blockLocalFallbackWhenProtected(): boolean {
  return state.serverRequireLogin || state.requireLogin
}
