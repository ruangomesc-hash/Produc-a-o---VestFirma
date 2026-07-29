import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const SESSIONS_FILE =
  process.env.SESSIONS_FILE || path.join(ROOT, 'data', 'sessions.json')

const ADMIN_USER = process.env.ADMIN_USER || 'vestfirma'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'vestfirma-dev-change-me'
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 14)

async function loadSessions() {
  try {
    const raw = await fs.readFile(SESSIONS_FILE, 'utf8')
    const data = JSON.parse(raw)
    return typeof data === 'object' && data ? data : {}
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return {}
    }
    return {}
  }
}

async function saveSessions(sessions) {
  await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true })
  const tmp = `${SESSIONS_FILE}.tmp`
  await fs.writeFile(tmp, JSON.stringify(sessions, null, 2), 'utf8')
  await fs.rename(tmp, SESSIONS_FILE)
}

function purgeExpired(sessions) {
  const now = Date.now()
  for (const [token, row] of Object.entries(sessions)) {
    if (!row || row.expires < now) delete sessions[token]
  }
}

export function verifyCredentials(username, password) {
  return username === ADMIN_USER && password === ADMIN_PASSWORD
}

export async function createSession() {
  const sessions = await loadSessions()
  purgeExpired(sessions)
  const token = crypto.randomBytes(32).toString('hex')
  const expires = Date.now() + SESSION_DAYS * 86400000
  sessions[token] = { user: ADMIN_USER, expires }
  await saveSessions(sessions)
  return {
    token,
    user: ADMIN_USER,
    expiresAt: new Date(expires).toISOString(),
  }
}

export async function validateSession(token) {
  if (!token) return null
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
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw new Error('Payload too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
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

  const body = await readBody(req)
  let data
  try {
    data = JSON.parse(body)
  } catch {
    res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'JSON inválido' }))
    return true
  }

  const username = String(data.username || '').trim()
  const password = String(data.password || '')
  if (!username || !password) {
    res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Usuário e senha são obrigatórios' }))
    return true
  }

  if (!verifyCredentials(username, password)) {
    res.writeHead(401, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Usuário ou senha incorretos' }))
    return true
  }

  const session = await createSession()
  res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(session))
  return true
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
  res.end(JSON.stringify({ ok: true, user: row.user }))
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
