const REDIRECT_HASHES = new Set(['redirect'])

function normalizePath(pathname: string): string {
  const path = pathname.replace(/\/$/, '') || '/'
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || ''
  if (base && base !== '/' && path.startsWith(base)) {
    return path.slice(base.length) || '/'
  }
  return path
}

/** Página dedicada ao redirect WhatsApp (URL compartilhável /redirect). */
export function isRedirectRoute(): boolean {
  const hash = window.location.hash.replace(/^#/, '').split('?')[0]
  if (REDIRECT_HASHES.has(hash)) return true

  const path = normalizePath(window.location.pathname)
  return path === '/redirect' || path.endsWith('/redirect')
}

export function redirectSharePath(): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  return `${base}redirect`
}

export function redirectHref(): string {
  const path = redirectSharePath()
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${window.location.origin}${normalized}`
}
