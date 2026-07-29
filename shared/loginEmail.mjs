/**
 * E-mail de login VestFirma: aceita formato clássico (a@b.com) e domínio interno (a@vestfirma).
 */

export function normalizeLoginEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function isValidLoginEmail(email) {
  const norm = normalizeLoginEmail(email)
  if (!norm || norm.length > 254) return false
  const at = norm.indexOf('@')
  if (at < 1 || at === norm.length - 1) return false

  const local = norm.slice(0, at)
  const domain = norm.slice(at + 1)
  if (local.length > 64 || domain.length > 253) return false
  if (/\s/.test(norm)) return false
  if (
    local.startsWith('.') ||
    local.endsWith('.') ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    local.includes('..') ||
    domain.includes('..')
  ) {
    return false
  }

  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i.test(domain)) {
    return false
  }
  return true
}

export const LOGIN_EMAIL_HINT =
  'Use nome@dominio.com ou login interno como nome@vestfirma'
