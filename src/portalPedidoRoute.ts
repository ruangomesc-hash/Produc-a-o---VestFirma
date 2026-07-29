const PORTAL_HASHES = new Set(['novo-pedido', 'portal-pedido'])
const PREVIEW_FESTA_HASHES = new Set(['preview-festa', 'novo-pedido/preview-festa'])

function normalizePath(pathname: string): string {
  const path = pathname.replace(/\/$/, '') || '/'
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || ''
  if (base && base !== '/' && path.startsWith(base)) {
    return path.slice(base.length) || '/'
  }
  return path
}

/** Só para editar/visualizar a celebração “VENDEDOR VENDE!” */
export function isPortalFestaPreviewRoute(): boolean {
  const hash = window.location.hash.replace(/^#/, '').split('?')[0]
  if (PREVIEW_FESTA_HASHES.has(hash) || hash.endsWith('/preview-festa')) return true

  const path = normalizePath(window.location.pathname)
  if (path === '/novo-pedido/preview-festa' || path.endsWith('/novo-pedido/preview-festa')) {
    return true
  }

  return new URLSearchParams(window.location.search).get('preview') === 'festa'
}

/** Página dedicada ao vendedor cadastrar pedidos (URL compartilhável). */
export function isPortalPedidoRoute(): boolean {
  if (isPortalFestaPreviewRoute()) return false

  const hash = window.location.hash.replace(/^#/, '').split('?')[0]
  if (PORTAL_HASHES.has(hash)) return true

  const path = normalizePath(window.location.pathname)
  if (path === '/novo-pedido' || path.endsWith('/novo-pedido')) return true

  return false
}

export function portalPedidoSharePath(): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  return `${base}novo-pedido`
}

export function portalFestaPreviewSharePath(): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  return `${base}novo-pedido/preview-festa`
}

/** URL absoluta para link e QR code. */
export function portalPedidoHref(): string {
  const path = portalPedidoSharePath()
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${window.location.origin}${normalized}`
}

/** Preview fixo da tela de festa (desenvolvimento / ajuste visual). */
export function portalFestaPreviewHref(): string {
  const path = portalFestaPreviewSharePath()
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${window.location.origin}${normalized}`
}
