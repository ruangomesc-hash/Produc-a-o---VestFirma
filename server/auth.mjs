import crypto from 'node:crypto'
import { readJsonStore, writeJsonStore } from './storageAdapter.mjs'
import { issueSessionToken, parseSessionToken, useJwtSessions } from './sessionToken.mjs'
import { ensureUsersSeeded, verifyUserPassword } from './users.mjs'

const SESSIONS_STORE = 'sessions.json'
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 14)

async function loadSessions() {
  const data = await readJsonStore(SESSIONS_STORE)
  return typeof data === 'object' && data ? data : {}
}

async function saveSessions(sessions) {
  await writeJsonStore(SESSIONS_STORE, sessions)
}

function purgeExpired(sessions) {
  const now = Date.now()
  for (const [token, row] of Object.entries(sessions)) {
    if (!row || row.expires < now) delete sessions[token]
  }
}

export async function verifyCredentials(username, password) {
  return verifyUserPassword(username, password)
}

export async function createSession(user) {
  if (useJwtSessions()) {
    const token = issueSessionToken(user)
    const expires = Date.now() + SESSION_DAYS * 86400000
    return {
      token,
      user: user.name || user.email,
      email: user.email,
      role: user.role,
      expiresAt: new Date(expires).toISOString(),
    }
  }

  const sessions = await loadSessions()
  purgeExpired(sessions)
  const token = crypto.randomBytes(32).toString('hex')
  const expires = Date.now() + SESSION_DAYS * 86400000
  sessions[token] = {
    user: user.name || user.email,
    email: user.email,
    role: user.role,
    userId: user.id,
    expires,
  }
  await saveSessions(sessions)
  return {
    token,
    user: user.name || user.email,
    email: user.email,
    role: user.role,
    expiresAt: new Date(expires).toISOString(),
  }
}

export async function validateSession(token) {
  if (!token) return null
  if (useJwtSessions()) {
    return parseSessionToken(token)
  }

  const sessions = await loadSessions()
  purgeExpired(sessions)
  const row = sessions[token]
  if (!row || row.expires < Date.now()) {
    if (row) {
      delete sessions[token]
      await saveSessions(sessions)
    }
    return null
  }
  await saveSessions(sessions)
  return row
}

export async function revokeSession(token) {
  if (!token) return
  if (useJwtSessions()) return

  const sessions = await loadSessions()
  delete sessions[token]
  await saveSessions(sessions)
}

export function readBearer(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export async function requireSession(req, res) {
  const token = readBearer(req)
  const row = await validateSession(token)
  if (!row) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() })
    res.end(JSON.stringify({ error: 'Não autenticado' }))
    return null
  }
  return row
}

export async function readJsonBody(req, maxBytes) {
  if (typeof req.body === 'string' && req.body.length > 0) {
    if (req.body.length > maxBytes) throw new Error('Payload too large')
    return req.body
  }
  if (
    req.body &&
    typeof req.body === 'object' &&
    !Buffer.isBuffer(req.body) &&
    !Array.isArray(req.body)
  ) {
    const s = JSON.stringify(req.body)
    if (s.length > maxBytes) throw new Error('Payload too large')
    return s
  }

  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw new Error('Payload too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function loginJsonError(res, status, payload) {
  res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ ok: false, ...payload }))
}

export async function handleLoginApi(req, res, readBody) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return true
  }
  if (req.method !== 'POST') {
    res.writeHead(405, corsHeaders())
    res.end('Method Not Allowed')
    return true
  }

  try {
    const body = await readBody(req)
    let data
    try {
      data = JSON.parse(body)
    } catch {
      loginJsonError(res, 400, {
        code: 'INVALID_JSON',
        error: 'JSON inválido.',
      })
      return true
    }

    const username = String(data.username || data.email || '').trim()
    const password = String(data.password || '')
    if (!username || !password) {
      loginJsonError(res, 400, {
        code: 'AUTH_MISSING_FIELDS',
        error: 'E-mail e senha são obrigatórios.',
      })
      return true
    }

    const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'ruan.gomesc@gmail.com').toLowerCase().trim()
    const adminPwd = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ''
    if (username.toLowerCase() === adminEmail && !adminPwd) {
      loginJsonError(res, 503, {
        code: 'CONFIG_ADMIN_PASSWORD',
        error: 'Senha do administrador não está configurada no servidor.',
        fix: 'Render → Environment → SEED_ADMIN_PASSWORD (ex.: @Vestfirma26!) → Save → Manual Deploy.',
      })
      return true
    }

    const user = await verifyCredentials(username, password)
    if (!user) {
      loginJsonError(res, 401, {
        code: 'AUTH_INVALID',
        error:
          username.toLowerCase() === adminEmail
            ? 'Senha incorreta para o administrador.'
            : 'E-mail ou senha incorretos.',
        fix:
          username.toLowerCase() === adminEmail
            ? 'Confira SEED_ADMIN_PASSWORD no Render (sem aspas extras) e redeploy.'
            : 'Peça um acesso em Usuários ou confira e-mail e senha.',
      })
      return true
    }

    const session = await createSession(user)
    res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(session))
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[vestfirma login]', err)
    const diskHint = /ENOENT|EACCES|EPERM|read-only|Payload/i.test(msg)
    loginJsonError(res, 500, {
      code: 'SERVER_ERROR',
      error: 'Erro interno ao processar login.',
      message: msg,
      fix: diskHint
        ? 'Render → Disks: monte /var/data. Environment: BOARD_DATA_DIR=/var/data, BOARD_DATA_FILE=/var/data/board.json. Redeploy.'
        : 'Render → Logs do serviço. Confira SEED_ADMIN_PASSWORD, REQUIRE_LOGIN=true e Start Command: npm run start:production.',
    })
    return true
  }
}

export async function handleSessionApi(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return true
  }
  if (req.method !== 'GET') {
    res.writeHead(405, corsHeaders())
    res.end('Method Not Allowed')
    return true
  }

  const token = readBearer(req)
  const row = await validateSession(token)
  if (!row) {
    res.writeHead(401, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false }))
    return true
  }

  res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ ok: true, user: row.user, email: row.email || '', role: row.role || '' }))
  return true
}

export async function handleLogoutApi(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return true
  }
  if (req.method !== 'POST') {
    res.writeHead(405, corsHeaders())
    res.end('Method Not Allowed')
    return true
  }

  await revokeSession(readBearer(req))
  res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ ok: true }))
  return true
}
