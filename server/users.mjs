import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

export const ROLES = ['admin', 'gerente', 'expedicao', 'impressao', 'vendedor']

const USERS_FILE = process.env.USERS_FILE || path.join(ROOT, 'data', 'users.json')

const SEED_ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'ruan.gomesc@gmail.com').toLowerCase().trim()
const SEED_ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Administrador'
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || ''
const LEGACY_ADMIN_USER = process.env.ADMIN_USER || 'vestfirma'
const LEGACY_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'vestfirma-dev-change-me'

function randomPassword(length = 12) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[crypto.randomInt(0, chars.length)]
  }
  return out
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

async function loadRaw() {
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf8')
    const data = JSON.parse(raw)
    if (data && Array.isArray(data.users)) return data
  } catch (err) {
    if (!(err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT')) {
      /* ignore parse errors */
    }
  }
  return { users: [] }
}

async function saveRaw(data) {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true })
  const tmp = `${USERS_FILE}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, USERS_FILE)
}

export async function ensureUsersSeeded() {
  const data = await loadRaw()
  if (data.users.length > 0) return

  let email = SEED_ADMIN_EMAIL
  let password = SEED_ADMIN_PASSWORD || randomPassword(12)
  if (LEGACY_ADMIN_USER.includes('@')) {
    email = normalizeEmail(LEGACY_ADMIN_USER)
  }
  if (!SEED_ADMIN_PASSWORD && LEGACY_ADMIN_PASSWORD) {
    password = LEGACY_ADMIN_PASSWORD
  }

  data.users.push({
    id: crypto.randomBytes(8).toString('hex'),
    email,
    name: SEED_ADMIN_NAME,
    role: 'admin',
    password,
    createdAt: new Date().toISOString(),
  })
  await saveRaw(data)
}

export async function listUsers() {
  await ensureUsersSeeded()
  const data = await loadRaw()
  return data.users
}

export function findUserByEmail(users, email) {
  const norm = normalizeEmail(email)
  return users.find((u) => normalizeEmail(u.email) === norm) || null
}

export function findUserById(users, id) {
  return users.find((u) => u.id === id) || null
}

export function userPublic(user, includePassword) {
  const row = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt || '',
  }
  if (includePassword) row.password = user.password
  return row
}

export async function createUser(email, role, name) {
  if (!ROLES.includes(role)) throw new Error('Perfil inválido')
  if (role === 'admin') throw new Error('Use apenas um administrador geral')
  const norm = normalizeEmail(email)
  if (!norm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) throw new Error('E-mail inválido')

  const data = await loadRaw()
  if (findUserByEmail(data.users, norm)) throw new Error('Este e-mail já está cadastrado')

  const user = {
    id: crypto.randomBytes(8).toString('hex'),
    email: norm,
    name: String(name || '').trim() || norm,
    role,
    password: randomPassword(12),
    createdAt: new Date().toISOString(),
  }
  data.users.push(user)
  await saveRaw(data)
  return user
}

export async function updateUser(id, { email, role, name, regeneratePassword }) {
  const data = await loadRaw()
  const user = findUserById(data.users, id)
  if (!user) throw new Error('Usuário não encontrado')

  if (email != null) {
    const norm = normalizeEmail(email)
    if (!norm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) throw new Error('E-mail inválido')
    const other = findUserByEmail(data.users, norm)
    if (other && other.id !== id) throw new Error('Este e-mail já está cadastrado')
    user.email = norm
  }
  if (role != null) {
    if (!ROLES.includes(role)) throw new Error('Perfil inválido')
    if (user.role === 'admin' && role !== 'admin') {
      throw new Error('Não é possível alterar o perfil do administrador geral')
    }
    if (role === 'admin') throw new Error('Só existe um administrador geral')
    user.role = role
  }
  if (name != null && String(name).trim()) user.name = String(name).trim()
  if (regeneratePassword) user.password = randomPassword(12)

  await saveRaw(data)
  return user
}

export async function deleteUser(id, currentUserId) {
  const data = await loadRaw()
  const idx = data.users.findIndex((u) => u.id === id)
  if (idx < 0) throw new Error('Usuário não encontrado')
  const user = data.users[idx]
  if (user.role === 'admin') throw new Error('Não é possível excluir o administrador geral')
  if (id === currentUserId) throw new Error('Você não pode excluir a si mesmo')
  data.users.splice(idx, 1)
  await saveRaw(data)
}

export async function verifyUserPassword(email, password) {
  await ensureUsersSeeded()
  const users = await listUsers()
  const user = findUserByEmail(users, email)
  if (user) {
    const stored = String(user.password || '')
    if (stored !== '' && stored === String(password)) return user
    return null
  }

  if (email === LEGACY_ADMIN_USER || normalizeEmail(email) === normalizeEmail(LEGACY_ADMIN_USER)) {
    if (password === LEGACY_ADMIN_PASSWORD) {
      return {
        id: 'legacy',
        email: LEGACY_ADMIN_USER.includes('@') ? normalizeEmail(LEGACY_ADMIN_USER) : email,
        name: LEGACY_ADMIN_USER,
        role: 'admin',
      }
    }
  }
  return null
}

export function requireAdminSession(row, res, corsHeaders) {
  if (!row || row.role !== 'admin') {
    res.writeHead(403, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Acesso restrito ao administrador' }))
    return false
  }
  return true
}

export async function handleUsersApi(req, res, readBody, requireSession, corsHeaders) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return true
  }

  if (process.env.REQUIRE_LOGIN !== 'true') {
    res.writeHead(503, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Login desligado no servidor (REQUIRE_LOGIN)' }))
    return true
  }

  const session = await requireSession(req, res)
  if (!session) return true
  if (!requireAdminSession(session, res, corsHeaders)) return true

  try {
    if (req.method === 'GET') {
      const users = await listUsers()
      res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ users: users.map((u) => userPublic(u, true)) }))
      return true
    }

    if (req.method === 'POST') {
      const body = await readBody(req)
      const data = JSON.parse(body)
      const user = await createUser(data.email, data.role, data.name)
      res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ user: userPublic(user, true) }))
      return true
    }

    if (req.method === 'PUT') {
      const body = await readBody(req)
      const data = JSON.parse(body)
      const user = await updateUser(data.id, {
        email: 'email' in data ? data.email : undefined,
        role: 'role' in data ? data.role : undefined,
        name: 'name' in data ? data.name : undefined,
        regeneratePassword: Boolean(data.regeneratePassword),
      })
      res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ user: userPublic(user, true) }))
      return true
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url || '/', `http://${req.headers.host}`)
      const id = url.searchParams.get('id') || ''
      await deleteUser(id, session.userId || '')
      res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true }))
      return true
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha ao processar usuários'
    res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: msg }))
    return true
  }

  res.writeHead(405, corsHeaders())
  res.end('Method Not Allowed')
  return true
}
