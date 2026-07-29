/**
 * API VestFirma na Vercel — um único handler, sem PHP, sem imports frágeis.
 */
import crypto from 'node:crypto'

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'ruan.gomesc@gmail.com').toLowerCase().trim()
const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '@Vestfirma26!'
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Administrador'
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 14)
const REQUIRE_LOGIN = process.env.REQUIRE_LOGIN === 'true' || process.env.VERCEL === '1'
const BLOB_PREFIX = 'vestfirma/'

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
    throw new Error('Blob não configurado na Vercel (Storage → Blob)')
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
        res.status(403).json({ error: 'Acesso restrito ao administrador' })
        return
      }
      if (req.method === 'GET') {
        const users = await loadUsersList()
        res.status(200).json({ users })
        return
      }
      if (req.method === 'POST') {
        const data = await parseJsonBody(req)
        const email = String(data.email || '').trim().toLowerCase()
        const role = String(data.role || '')
        const name = String(data.name || email)
        if (!email || role === 'admin') {
          res.status(400).json({ error: 'Perfil ou e-mail inválido' })
          return
        }
        const list = await loadUsersList()
        if (list.some((u) => String(u.email).toLowerCase() === email)) {
          res.status(400).json({ error: 'E-mail já cadastrado' })
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
        await blobWriteJson('users.json', { users: list })
        res.status(200).json({ user })
        return
      }
      res.status(405).json({ error: 'Method Not Allowed' })
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
