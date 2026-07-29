import crypto from 'node:crypto'

const SESSION_DAYS = Number(process.env.SESSION_DAYS || 14)

function sessionSecret() {
  const raw =
    process.env.SESSION_SECRET ||
    process.env.SEED_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    'vestfirma-session-secret'
  return String(raw).trim()
}

/** Sessão stateless — Vercel/Render (sem sessions.json). */
export function useJwtSessions() {
  return (
    process.env.VERCEL === '1' ||
    process.env.RENDER === 'true' ||
    process.env.SESSION_MODE === 'jwt'
  )
}

export function issueSessionToken(user) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400
  const payload = {
    user: user.name || user.email,
    email: user.email,
    role: user.role,
    userId: user.id,
    exp,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function parseSessionToken(token) {
  if (!token || typeof token !== 'string') return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null

  let data
  try {
    data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!data?.exp || data.exp < Math.floor(Date.now() / 1000)) return null

  return {
    user: data.user,
    email: data.email,
    role: data.role,
    userId: data.userId,
    expires: data.exp * 1000,
  }
}
