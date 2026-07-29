/**
 * API VestFirma na Vercel — um único handler, sem PHP, sem imports frágeis.
 */
import crypto from 'node:crypto'
import { isValidLoginEmail, normalizeLoginEmail } from '../shared/loginEmail.mjs'

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'ruan.gomesc@gmail.com').toLowerCase().trim()
const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '@Vestfirma26!'
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Administrador'
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 14)
const REQUIRE_LOGIN = process.env.REQUIRE_LOGIN === 'true' || process.env.VERCEL === '1'
const BLOB_PREFIX = 'vestfirma/'
const USER_ROLES = ['admin', 'gerente', 'expedicao', 'impressao', 'vendedor']

const BLOB_FIX =
  'Vercel → Storage → Create Blob Store → Environment Variables: BLOB_READ_WRITE_TOKEN → Redeploy.'

function jsonError(res, status, payload) {
  res.status(status).json({
    ok: false,
    ...payload,
  })
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function sessionSecret() {
  return process.env.SESSION_SECRET || ADMIN_PASSWORD || 'vestfirma-session'
}

function routeFromReq(req) {
  const slug = req.query?.slug
  let path = Array.isArray(slug) ? slug.join('/') : String(slug || '')
  if (!path && req.url) {
    try {
      const u = new URL(req.url, 'http://localhost')
      path = u.pathname.replace(/^\/api\//, '')
    } catch {
      path = ''
    }
  }
  return path.replace(/\.php$/i, '').toLowerCase()
}

function issueToken(user) {
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

function parseToken(token) {
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
  }
}

function readBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || ''
  return h.startsWith('Bearer ') ? h.slice(7).trim() : ''
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body)
  }
  return {}
}

function verifyAdmin(username, password) {
  const email = String(username || '').trim().toLowerCase()
  const pwd = String(password || '')
  if (email === ADMIN_EMAIL && pwd === ADMIN_PASSWORD) {
    return { id: 'admin', email: ADMIN_EMAIL, name: ADMIN_NAME, role: 'admin' }
  }
  return null
}

async function blobReadText(name) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null
  try {
    const { head } = await import('@vercel/blob')
    const meta = await head(`${BLOB_PREFIX}${name}`)
    const res = await fetch(meta.url)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function blobWriteText(name, text) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const err = new Error('Blob não configurado na Vercel (Storage → Blob)')
    err.code = 'BLOB_NOT_CONFIGURED'
    throw err
  }
  const { put } = await import('@vercel/blob')
  await put(`${BLOB_PREFIX}${name}`, text, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
}

async function blobReadJson(name) {
  const raw = await blobReadText(name)
  if (!raw?.trim()) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function blobWriteJson(name, data) {
  await blobWriteText(name, JSON.stringify(data, null, 2))
}

async function defaultUsers() {
  return [
    {
      id: 'admin',
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: 'admin',
      password: ADMIN_PASSWORD,
      createdAt: new Date().toISOString(),
    },
  ]
}

async function loadUsersList() {
  const data = await blobReadJson('users.json')
  if (data?.users?.length) return data.users
  return defaultUsers()
}

function randomPassword(length = 12) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[crypto.randomInt(0, chars.length)]
  }
  return out
}

async function saveUsersList(list) {
  await blobWriteJson('users.json', { users: list })
}

function normalizeEmail(email) {
  return normalizeLoginEmail(email)
}

function isValidEmail(email) {
  return isValidLoginEmail(email)
}

function userPublic(user, includePassword) {
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

async function verifyLoginUser(username, password) {
  const envUser = verifyAdmin(username, password)
  if (envUser) return envUser
  const users = await loadUsersList()
  const email = String(username || '').trim().toLowerCase()
  const pwd = String(password || '')
  const found = users.find((u) => String(u.email).toLowerCase() === email)
  if (found && String(found.password) === pwd) return found
  return null
}

export default async function handler(req, res) {
  cors(res)
  const route = routeFromReq(req)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  try {
    if (route === 'ping' || route === '') {
      res.status(200).json({
        ok: true,
        ping: 'vestfirma-api',
        route,
        vercel: process.env.VERCEL === '1',
        hasBlob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      })
      return
    }

    if (route === 'health') {
      res.status(200).json({
        ok: true,
        service: 'vestfirma-kanban',
        requireLogin: REQUIRE_LOGIN,
        sessionMode: 'jwt',
        storage: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'none',
        adminEmail: ADMIN_EMAIL,
        timestamp: new Date().toISOString(),
      })
      return
    }

    if (route === 'login') {
      if (req.method !== 'POST') {
        jsonError(res, 405, {
          code: 'METHOD_NOT_ALLOWED',
          error: 'Use POST para login.',
          fix: 'O front deve enviar POST /api/login com JSON username e password.',
        })
        return
      }
      const data = await parseJsonBody(req)
      const username = String(data.username || data.email || '').trim()
      const password = String(data.password || '')
      if (!username || !password) {
        jsonError(res, 400, {
          code: 'AUTH_MISSING_FIELDS',
          error: 'E-mail e senha são obrigatórios.',
          fix: 'Preencha os dois campos antes de entrar.',
        })
        return
      }
      const user = await verifyLoginUser(username, password)
      if (!user) {
        const emailNorm = username.toLowerCase()
        const isAdminEmail = emailNorm === ADMIN_EMAIL
        jsonError(res, 401, {
          code: 'AUTH_INVALID',
          error: isAdminEmail
            ? 'Senha incorreta para o administrador.'
            : 'E-mail ou senha incorretos.',
          fix: isAdminEmail
            ? 'Vercel → Environment Variables: SEED_ADMIN_PASSWORD deve ser @Vestfirma26! (ou a senha que você definiu). Redeploy após alterar.'
            : 'Peça ao admin um acesso em Usuários ou confira e-mail e senha.',
          detail: `Tentativa: ${emailNorm}`,
        })
        return
      }
      const token = issueToken(user)
      res.status(200).json({
        token,
        user: user.name,
        email: user.email,
        role: user.role,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000).toISOString(),
      })
      return
    }

    if (route === 'session') {
      if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method Not Allowed' })
        return
      }
      const row = parseToken(readBearer(req))
      if (!row) {
        res.status(401).json({ ok: false })
        return
      }
      res.status(200).json({
        ok: true,
        user: row.user,
        email: row.email || '',
        role: row.role || '',
      })
      return
    }

    if (route === 'logout') {
      res.status(200).json({ ok: true })
      return
    }

    if (route === 'board') {
      const session = parseToken(readBearer(req))
      if (REQUIRE_LOGIN && !session) {
        res.status(401).json({ error: 'Não autenticado' })
        return
      }
      if (req.method === 'GET') {
        const raw = await blobReadText('board.json')
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.status(200).send(raw && raw.trim() ? raw : 'null')
        return
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        let body = req.body
        if (typeof body === 'object' && body && !Buffer.isBuffer(body)) {
          body = JSON.stringify(body)
        } else if (typeof body !== 'string') {
          body = '{}'
        }
        JSON.parse(body)
        await blobWriteText('board.json', body)
        res.status(200).json({ ok: true, savedAt: new Date().toISOString() })
        return
      }
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    if (route === 'users') {
      const session = parseToken(readBearer(req))
      if (!session || session.role !== 'admin') {
        jsonError(res, 403, {
          code: 'FORBIDDEN',
          error: 'Acesso restrito ao administrador.',
          fix: 'Entre com a conta admin (ruan.gomesc@gmail.com).',
        })
        return
      }
      if (req.method === 'GET') {
        const users = await loadUsersList()
        res.status(200).json({ users: users.map((u) => userPublic(u, true)) })
        return
      }
      if (req.method === 'POST') {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          jsonError(res, 503, {
            code: 'BLOB_NOT_CONFIGURED',
            error: 'Não dá para cadastrar usuários: armazenamento Blob não está ativo.',
            fix: BLOB_FIX,
            detail: '/api/health retorna storage: "none" sem o token.',
          })
          return
        }
        const data = await parseJsonBody(req)
        const email = normalizeEmail(data.email)
        const role = String(data.role || '')
        const name = String(data.name || '').trim() || email
        if (!email || !isValidEmail(email)) {
          jsonError(res, 400, {
            code: 'INVALID_EMAIL',
            error: 'E-mail inválido.',
            fix: 'Use formato completo, ex.: francejunior@vestfirma.com.br',
            detail: email || '(vazio)',
          })
          return
        }
        if (!USER_ROLES.includes(role) || role === 'admin') {
          jsonError(res, 400, {
            code: 'INVALID_ROLE',
            error: 'Perfil inválido para novo acesso.',
            fix: 'Escolha Gerente, Expedição, Impressão ou Vendedor.',
          })
          return
        }
        const list = await loadUsersList()
        if (list.some((u) => normalizeEmail(u.email) === email)) {
          jsonError(res, 400, {
            code: 'EMAIL_EXISTS',
            error: 'Este e-mail já está cadastrado.',
            fix: 'Use outro e-mail ou exclua o acesso antigo na tabela.',
          })
          return
        }
        const user = {
          id: crypto.randomBytes(8).toString('hex'),
          email,
          name,
          role,
          password: randomPassword(12),
          createdAt: new Date().toISOString(),
        }
        list.push(user)
        await saveUsersList(list)
        res.status(200).json({ user: userPublic(user, true) })
        return
      }
      if (req.method === 'PUT') {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          jsonError(res, 503, {
            code: 'BLOB_NOT_CONFIGURED',
            error: 'Não dá para alterar usuários sem Vercel Blob.',
            fix: BLOB_FIX,
          })
          return
        }
        const data = await parseJsonBody(req)
        const id = String(data.id || '')
        if (!id) {
          jsonError(res, 400, { code: 'MISSING_ID', error: 'id obrigatório.' })
          return
        }
        const list = await loadUsersList()
        const idx = list.findIndex((u) => u.id === id)
        if (idx < 0) {
          jsonError(res, 400, { code: 'NOT_FOUND', error: 'Usuário não encontrado.' })
          return
        }
        const user = list[idx]
        if (user.role === 'admin') {
          jsonError(res, 400, {
            code: 'ADMIN_LOCKED',
            error: 'Não é possível alterar o administrador geral por aqui.',
          })
          return
        }
        if (data.email != null) {
          const email = normalizeEmail(data.email)
          if (!isValidEmail(email)) {
            jsonError(res, 400, {
              code: 'INVALID_EMAIL',
              error: 'E-mail inválido.',
              fix: 'Use nome@dominio.com ou login interno como nome@vestfirma',
            })
            return
          }
          if (list.some((u) => u.id !== id && normalizeEmail(u.email) === email)) {
            jsonError(res, 400, { code: 'EMAIL_EXISTS', error: 'Este e-mail já está cadastrado.' })
            return
          }
          user.email = email
        }
        if (data.role != null) {
          const role = String(data.role)
          if (!USER_ROLES.includes(role) || role === 'admin') {
            jsonError(res, 400, { code: 'INVALID_ROLE', error: 'Perfil inválido.' })
            return
          }
          user.role = role
        }
        if (data.name != null && String(data.name).trim()) user.name = String(data.name).trim()
        if (data.regeneratePassword) user.password = randomPassword(12)
        list[idx] = user
        await saveUsersList(list)
        res.status(200).json({ user: userPublic(user, true) })
        return
      }
      if (req.method === 'DELETE') {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          jsonError(res, 503, {
            code: 'BLOB_NOT_CONFIGURED',
            error: 'Não dá para excluir usuários sem Vercel Blob.',
            fix: BLOB_FIX,
          })
          return
        }
        const id = String(req.query?.id || '').trim()
        if (!id) {
          jsonError(res, 400, { code: 'MISSING_ID', error: 'id obrigatório na query ?id=' })
          return
        }
        const list = await loadUsersList()
        const target = list.find((u) => u.id === id)
        if (!target) {
          jsonError(res, 400, { code: 'NOT_FOUND', error: 'Usuário não encontrado.' })
          return
        }
        if (target.role === 'admin') {
          jsonError(res, 400, { code: 'ADMIN_LOCKED', error: 'Não é possível excluir o administrador geral.' })
          return
        }
        if (id === session.userId) {
          jsonError(res, 400, { code: 'SELF_DELETE', error: 'Você não pode excluir a si mesmo.' })
          return
        }
        await saveUsersList(list.filter((u) => u.id !== id))
        res.status(200).json({ ok: true })
        return
      }
      jsonError(res, 405, { code: 'METHOD_NOT_ALLOWED', error: 'Método não permitido em /api/users.' })
      return
    }

    res.status(404).json({
      ok: false,
      code: 'ROUTE_NOT_FOUND',
      error: `Rota API "/${route}" não existe.`,
      fix: 'Use /api/login, /api/health, /api/board. Redeploy com api/[...slug].js.',
      detail: String(route),
    })
  } catch (err) {
    console.error('[vestfirma-api]', route, err)
    const msg = err instanceof Error ? err.message : String(err)
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
    if (code === 'BLOB_NOT_CONFIGURED' || /blob/i.test(msg)) {
      jsonError(res, 503, {
        code: 'BLOB_NOT_CONFIGURED',
        error: 'Armazenamento Vercel Blob não configurado.',
        fix: BLOB_FIX,
        detail: msg,
      })
      return
    }
    jsonError(res, 500, {
      code: 'SERVER_ERROR',
      error: 'Erro interno na API.',
      message: msg,
      fix: 'Vercel → Deployments → Functions → Logs. Corrija o erro e redeploy.',
      detail: msg,
    })
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
  maxDuration: 60,
}
