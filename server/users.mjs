import crypto from 'node:crypto'
import { isValidLoginEmail, normalizeLoginEmail } from '../shared/loginEmail.mjs'
import {
  loadUsersData,
  mutateUsersStore,
  usersStoreFileExists,
} from './usersPersist.mjs'
import { repairUsersMissingFromBoard, countUsersOnDisk } from './usersRepair.mjs'

export const ROLES = ['admin', 'gerente', 'expedicao', 'impressao', 'vendedor']

const SEED_ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'ruan.gomesc@gmail.com').toLowerCase().trim()
const SEED_ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Administrador'
const SEED_ADMIN_PASSWORD = (
  process.env.SEED_ADMIN_PASSWORD ||
  process.env.ADMIN_PASSWORD ||
  '@Vestfirma26!'
).trim()

function randomPassword(length = 12) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[crypto.randomInt(0, chars.length)]
  }
  return out
}

function normalizeEmail(email) {
  return normalizeLoginEmail(email)
}

async function loadRaw() {
  return loadUsersData()
}

export async function ensureUsersSeeded() {
  const exists = await usersStoreFileExists()
  if (exists) {
    const data = await loadRaw()
    if (data.users.length > 0) return
    console.warn('[vestfirma] users.json existe mas está sem usuários — não recriar admin automaticamente')
    return
  }

  const email = SEED_ADMIN_EMAIL
  const password = SEED_ADMIN_PASSWORD || randomPassword(12)

  await mutateUsersStore(
    () => [
      {
        id: crypto.randomBytes(8).toString('hex'),
        email,
        name: SEED_ADMIN_NAME,
        role: 'admin',
        password,
        createdAt: new Date().toISOString(),
      },
    ],
    { replace: true },
  )
}

export async function listUsers() {
  await ensureUsersSeeded()
  const data = await loadRaw()
  const repaired = await repairUsersMissingFromBoard(data.users)
  return repaired
}

export async function getUsersStoreStats() {
  return { count: await countUsersOnDisk(), file: 'users.json' }
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
  if (!norm || !isValidLoginEmail(norm)) throw new Error('E-mail inválido')

  const user = {
    id: crypto.randomBytes(8).toString('hex'),
    email: norm,
    name: String(name || '').trim() || norm,
    role,
    password: randomPassword(12),
    createdAt: new Date().toISOString(),
  }

  let created = user
  const merged = await mutateUsersStore((users) => {
    if (findUserByEmail(users, norm)) throw new Error('Este e-mail já está cadastrado')
    users.push(user)
    created = user
    return users
  })

  if (!merged.some((u) => u.id === user.id)) {
    throw new Error('Cadastro não persistiu no servidor — tente de novo')
  }

  return created
}

export async function updateUser(id, { email, role, name, regeneratePassword }) {
  let updated = null
  await mutateUsersStore((users) => {
    const user = findUserById(users, id)
    if (!user) throw new Error('Usuário não encontrado')

    if (email != null) {
      const norm = normalizeEmail(email)
      if (!norm || !isValidLoginEmail(norm)) throw new Error('E-mail inválido')
      const other = findUserByEmail(users, norm)
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

    updated = user
    return users
  })

  if (!updated) throw new Error('Usuário não encontrado')
  return updated
}

export async function deleteUser(id, currentUserId, session) {
  if (!session || session.role !== 'admin') {
    throw new Error('Apenas o administrador pode excluir usuários')
  }

  await mutateUsersStore(
    (users) => {
      const idx = users.findIndex((u) => u.id === id)
      if (idx < 0) throw new Error('Usuário não encontrado')
      const user = users[idx]
      if (user.role === 'admin') throw new Error('Não é possível excluir o administrador geral')
      if (id === currentUserId) throw new Error('Você não pode excluir a si mesmo')
      users.splice(idx, 1)
      return users
    },
    { replace: true },
  )
}

export async function verifyUserPassword(email, password) {
  const norm = normalizeEmail(email)
  const pwd = String(password).trim()

  if (SEED_ADMIN_PASSWORD && norm === SEED_ADMIN_EMAIL && pwd === SEED_ADMIN_PASSWORD) {
    return {
      id: 'admin-seed',
      email: SEED_ADMIN_EMAIL,
      name: SEED_ADMIN_NAME,
      role: 'admin',
    }
  }

  if (norm === SEED_ADMIN_EMAIL) {
    return null
  }

  await ensureUsersSeeded()
  const users = await listUsers()
  const user = findUserByEmail(users, email)
  if (user) {
    const stored = String(user.password || '')
    if (stored !== '' && stored === pwd) return user
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

  if (process.env.REQUIRE_LOGIN !== 'true' && process.env.VERCEL !== '1') {
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
      await deleteUser(id, session.userId || '', session)
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
