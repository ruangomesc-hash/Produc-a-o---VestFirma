import crypto from 'node:crypto'
import { isValidLoginEmail, normalizeLoginEmail } from '../shared/loginEmail.mjs'
import {
  loadUsersData,
  mutateUsersStore,
  usersStoreFileExists,
} from './usersPersist.mjs'
import {
  repairUsersMissingFromBoard,
  countUsersOnDisk,
} from './usersRepair.mjs'
import { mergeUsersById, recoverUsersFromBackups } from './usersRecover.mjs'
import { syncBoardVendedorFromUser } from './usersBoardSync.mjs'

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
    const recovered = await recoverUsersFromBackups()
    if (recovered.length > 0) {
      console.warn(
        `[vestfirma] users.json vazio — restaurando ${recovered.length} usuário(s) de backup`,
      )
      await mutateUsersStore((users) => mergeUsersById(users, recovered))
      return
    }
    console.warn('[vestfirma] users.json existe mas está sem usuários — não recriar admin automaticamente')
    return
  }

  const recovered = await recoverUsersFromBackups()
  if (recovered.length > 0) {
    console.warn(
      `[vestfirma] users.json ausente — restaurando ${recovered.length} usuário(s) de backup`,
    )
    await mutateUsersStore((users) => mergeUsersById(users, recovered))
    return
  }

  const email = SEED_ADMIN_EMAIL
  const password = SEED_ADMIN_PASSWORD || randomPassword(12)

  await mutateUsersStore((users) => {
    if (users.length > 0) return users
    return [
      ...users,
      {
        id: crypto.randomBytes(8).toString('hex'),
        email,
        name: SEED_ADMIN_NAME,
        role: 'admin',
        password,
        createdAt: new Date().toISOString(),
      },
    ]
  })
}

export async function listUsers() {
  await ensureUsersSeeded()
  const data = await loadRaw()
  let users = data.users ?? []

  if (users.length <= 1) {
    const recovered = await recoverUsersFromBackups()
    if (recovered.length > users.length) {
      console.warn(
        `[vestfirma] users.json com ${users.length} usuário(s) — mesclando ${recovered.length} do backup`,
      )
      users = mergeUsersById(users, recovered)
      await mutateUsersStore((current) => mergeUsersById(current, recovered))
    }
  }

  const repaired = await repairUsersMissingFromBoard(users)
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

  if (user.role === 'vendedor') {
    try {
      await syncBoardVendedorFromUser(user)
    } catch (err) {
      console.warn('[vestfirma] Falha ao sincronizar vendedor no quadro:', err)
    }
  }

  return created
}

/** Admin reenvia logins que existem no navegador mas sumiram do disco do servidor. */
export async function syncMissingUsersFromClient(incoming) {
  const list = Array.isArray(incoming) ? incoming : []
  const valid = list.filter(
    (u) =>
      u?.id &&
      u?.email &&
      u?.role &&
      ROLES.includes(u.role) &&
      u.role !== 'admin' &&
      String(u.password || '').trim(),
  )
  if (valid.length === 0) {
    const data = await loadRaw()
    return { added: 0, total: data.users?.length ?? 0, message: 'Nada para sincronizar.' }
  }

  const before = (await loadRaw()).users ?? []
  const beforeIds = new Set(before.map((u) => u.id))
  const merged = await mutateUsersStore((current) => mergeUsersById(current, valid))
  const added = merged.filter((u) => !beforeIds.has(u.id)).length

  for (const u of valid) {
    if (u.role === 'vendedor') {
      try {
        await syncBoardVendedorFromUser(u)
      } catch (err) {
        console.warn('[vestfirma] sync vendedor no quadro:', err)
      }
    }
  }

  return {
    added,
    total: merged.length,
    message:
      added > 0
        ? `Sincronizou ${added} usuário(s) que estavam só no navegador.`
        : 'Usuários já estavam no servidor.',
  }
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

export async function deleteUser(id, currentUserId, session, confirmHeader) {
  if (!session || session.role !== 'admin') {
    throw new Error('Apenas o administrador pode excluir usuários')
  }
  const confirm = String(confirmHeader || '').trim()
  if (!confirm || confirm !== id) {
    throw new Error(
      'Confirmação de exclusão obrigatória (header X-Vestfirma-Confirm-User-Delete).',
    )
  }

  await mutateUsersStore(
    (users) => {
      const idx = users.findIndex((u) => u.id === id)
      if (idx < 0) throw new Error('Usuário não encontrado')
      const user = users[idx]
      if (user.role === 'admin') throw new Error('Não é possível excluir o administrador geral')
      if (id === currentUserId) throw new Error('Você não pode excluir a si mesmo')
      console.warn(`[vestfirma] Admin excluiu usuário ${user.email} (${user.id}) — confirmado`)
      return users.filter((u) => u.id !== id)
    },
    { replace: true, explicitUserDeleteId: id },
  )
}

export async function handleUsersBackupsApi(req, res, readBody, requireSession, corsHeaders) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return true
  }

  const session = await requireSession(req, res)
  if (!session) return true
  if (!requireAdminSession(session, res, corsHeaders)) return true

  try {
    const { listUsersBackupSummaries, restoreMissingUsersFromBackup } = await import(
      './usersRecover.mjs'
    )

    if (req.method === 'GET') {
      const data = await listUsersBackupSummaries()
      res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(data))
      return true
    }

    if (req.method === 'POST') {
      const body = await readBody(req)
      const data = JSON.parse(body || '{}')
      if (data.action === 'repair-from-board') {
        const { repairUsersFromBoardReport } = await import('./usersRepair.mjs')
        const result = await repairUsersFromBoardReport()
        res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
        res.end(
          JSON.stringify({
            ok: true,
            added: result.added,
            message: result.message,
            vendedoresNoQuadro: result.vendedoresNoQuadro,
            created: result.created.map((u) => userPublic(u, true)),
          }),
        )
        return true
      }
      const result = await restoreMissingUsersFromBackup(String(data.backup || 'users.json.bak'))
      res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true, ...result }))
      return true
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha ao restaurar usuários'
    res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: msg }))
    return true
  }

  res.writeHead(405, corsHeaders())
  res.end('Method Not Allowed')
  return true
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
      if (data.action === 'sync-missing') {
        const result = await syncMissingUsersFromClient(data.users)
        res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: true, ...result }))
        return true
      }
      const user = await createUser(data.email, data.role, data.name)
      const stats = await getUsersStoreStats()
      res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(
        JSON.stringify({
          user: userPublic(user, true),
          usersCount: stats.count,
        }),
      )
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
      await deleteUser(
        id,
        session.userId || '',
        session,
        req.headers['x-vestfirma-confirm-user-delete'] ||
          req.headers['X-Vestfirma-Confirm-User-Delete'],
      )
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
