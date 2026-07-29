import { readTextStore, writeTextStore } from './storageAdapter.mjs'
import { corsHeaders, readJsonBody, requireSession } from './auth.mjs'

const BOARD_STORE = 'board.json'
const REQUIRE_LOGIN = process.env.REQUIRE_LOGIN === 'true' || process.env.VERCEL === '1'

export async function handleBoardApi(req, res, readBody) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return true
  }

  if (REQUIRE_LOGIN) {
    const session = await requireSession(req, res)
    if (!session) return true
  }

  if (req.method === 'GET') {
    const raw = await readTextStore(BOARD_STORE)
    res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(raw && raw.trim() ? raw : 'null')
    return true
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const body = await readBody(req)
    JSON.parse(body)
    await writeTextStore(BOARD_STORE, body)
    res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, savedAt: new Date().toISOString() }))
    return true
  }

  res.writeHead(405, corsHeaders())
  res.end('Method Not Allowed')
  return true
}

export async function handleHealthApi(req, res) {
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

  res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  res.end(
    JSON.stringify({
      ok: true,
      service: 'vestfirma-kanban',
      requireLogin: REQUIRE_LOGIN,
      sessionMode: process.env.VERCEL === '1' ? 'jwt' : 'file',
      storage: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : process.env.VERCEL ? 'none-env-auth' : 'filesystem',
      adminEmailConfigured: Boolean(process.env.SEED_ADMIN_EMAIL || 'ruan.gomesc@gmail.com'),
      timestamp: new Date().toISOString(),
    }),
  )
  return true
}

export { readJsonBody }
