import crypto from 'node:crypto'
import { readJsonStore, writeJsonStore } from './storageAdapter.mjs'
import { requireAdminSession } from './users.mjs'

const AUDIT_STORE = 'audit.json'
const MAX_ENTRIES = 5000
const DEFAULT_LIST_LIMIT = 300

async function loadRaw() {
  const data = await readJsonStore(AUDIT_STORE)
  if (data && Array.isArray(data.entries)) return data
  return { entries: [] }
}

async function saveRaw(data) {
  await writeJsonStore(AUDIT_STORE, data)
}

export async function appendAuditEntry(session, payload) {
  const action = String(payload?.action || '').trim()
  const summary = String(payload?.summary || '').trim()
  if (!action || !summary) throw new Error('action e summary são obrigatórios')

  const data = await loadRaw()
  const entry = {
    id: crypto.randomBytes(8).toString('hex'),
    at: new Date().toISOString(),
    action,
    summary,
    detail: payload.detail != null ? String(payload.detail).slice(0, 4000) : '',
    meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : undefined,
    actorEmail: session?.email || '',
    actorName: session?.user || session?.email || 'Usuário',
    actorRole: session?.role || '',
  }
  data.entries.push(entry)
  if (data.entries.length > MAX_ENTRIES) {
    data.entries = data.entries.slice(-MAX_ENTRIES)
  }
  await saveRaw(data)
  return entry
}

export async function listAuditEntries(limit = DEFAULT_LIST_LIMIT) {
  const data = await loadRaw()
  const n = Math.min(Math.max(1, limit), 2000)
  return data.entries.slice(-n).reverse()
}

export async function handleAuditApi(req, res, readBody, requireSession, corsHeaders) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return true
  }

  const session = await requireSession(req, res)
  if (!session) return true

  if (req.method === 'GET') {
    if (!requireAdminSession(session, res, corsHeaders)) return true
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const limit = Number(url.searchParams.get('limit') || DEFAULT_LIST_LIMIT)
    const entries = await listAuditEntries(limit)
    res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, entries }))
    return true
  }

  if (req.method === 'POST') {
    try {
      const body = await readBody(req)
      const payload = JSON.parse(body)
      const entry = await appendAuditEntry(session, payload)
      res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true, entry }))
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao registrar histórico'
      res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: msg }))
      return true
    }
  }

  res.writeHead(405, corsHeaders())
  res.end('Method Not Allowed')
  return true
}
