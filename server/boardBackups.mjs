import fs from 'node:fs/promises'
import path from 'node:path'
import {
  backupBoardBeforeWrite,
  countBoardCards,
  mergeBoardAddingMissingPedidosOnly,
  readExistingBoard,
} from './boardPersist.mjs'
import { externalizeBoardLogos } from './boardLogos.mjs'

const BACKUP_NAME_RE = /^board-\d{4}-\d{2}-\d{2}T[\d\-Z]+\.json$/

function safeBackupFileName(name) {
  if (name === 'board.json.bak') return name
  if (typeof name === 'string' && BACKUP_NAME_RE.test(name)) return name
  return null
}

function cardMatchesQuery(card, board, q) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const parts = [card.numeroPedido, card.cliente, card.observacoes, card.vendedorId]
  const v = board.vendedores?.find((x) => x.id === card.vendedorId)
  if (v?.nome) parts.push(v.nome)
  if (v?.email) parts.push(v.email)
  return parts.some((p) => String(p ?? '').toLowerCase().includes(needle))
}

async function readBackupBoard(DATA_FILE, fileName) {
  const safe = safeBackupFileName(fileName)
  if (!safe) return null
  const dir = path.dirname(DATA_FILE)
  const full =
    safe === 'board.json.bak' ? `${DATA_FILE}.bak` : path.join(dir, 'backups', safe)
  try {
    const raw = await fs.readFile(full, 'utf8')
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}

function previewCards(cards, board, limit = 5) {
  return cards.slice(0, limit).map((c) => {
    const v = board.vendedores?.find((x) => x.id === c.vendedorId)
    return {
      id: c.id,
      numeroPedido: c.numeroPedido,
      cliente: c.cliente,
      vendedor: v?.nome ?? null,
      arquivado: Boolean(c.arquivadoEm),
    }
  })
}

export async function listBoardBackupSummaries(DATA_FILE, query = '') {
  const current = await readExistingBoard(DATA_FILE)
  const currentIds = new Set((current?.cards ?? []).map((c) => c.id).filter(Boolean))
  const dir = path.dirname(DATA_FILE)
  const backupsDir = path.join(dir, 'backups')
  const entries = [{ file: 'board.json.bak', label: 'Cópia .bak (último save)' }]

  try {
    const names = (await fs.readdir(backupsDir))
      .filter((n) => n.startsWith('board-') && n.endsWith('.json'))
      .sort()
      .reverse()
    for (const n of names) entries.push({ file: n, label: n })
  } catch {
    /* sem backups */
  }

  const summaries = []
  for (const { file, label } of entries) {
    const board = await readBackupBoard(DATA_FILE, file)
    if (!board) continue
    const cards = Array.isArray(board.cards) ? board.cards : []
    const missing = cards.filter((c) => c?.id && !currentIds.has(c.id))
    const q = query.trim()
    const missingFiltered = q
      ? missing.filter((c) => cardMatchesQuery(c, board, q))
      : missing
    if (q && missingFiltered.length === 0 && !cards.some((c) => cardMatchesQuery(c, board, q))) {
      continue
    }
    summaries.push({
      file,
      label,
      totalCards: cards.length,
      missingCount: missing.length,
      missingMatchingQuery: q ? missingFiltered.length : missing.length,
      preview: previewCards(q ? missingFiltered : missing, board),
    })
  }
  return {
    currentCards: countBoardCards(current),
    backups: summaries,
  }
}

export async function mergeMissingFromBackup(DATA_FILE, LOGO_DIR, backupFile) {
  const backupBoard = await readBackupBoard(DATA_FILE, backupFile)
  if (!backupBoard) {
    const err = new Error('Backup não encontrado ou nome inválido.')
    err.code = 'BACKUP_NOT_FOUND'
    throw err
  }
  const existing = await readExistingBoard(DATA_FILE)
  const before = countBoardCards(existing)
  let merged = mergeBoardAddingMissingPedidosOnly(existing, backupBoard)
  if (process.env.EXTERNALIZE_BOARD_LOGOS !== '0') {
    merged = await externalizeBoardLogos(merged, LOGO_DIR)
  }
  const after = countBoardCards(merged)
  const added = after - before
  if (added <= 0) {
    return { ok: true, added: 0, total: after, message: 'Nenhum pedido novo neste backup.' }
  }
  await backupBoardBeforeWrite(DATA_FILE)
  const out = JSON.stringify(merged)
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  const tmp = `${DATA_FILE}.tmp`
  await fs.writeFile(tmp, out, 'utf8')
  await fs.rename(tmp, DATA_FILE)
  await fs.writeFile(`${DATA_FILE}.bak`, out, 'utf8')
  return { ok: true, added, total: after, message: `${added} pedido(s) restaurado(s) do backup.` }
}

export async function mergeMissingFromBestBackup(DATA_FILE, LOGO_DIR, query = '') {
  const { backups } = await listBoardBackupSummaries(DATA_FILE, query)
  let best = null
  for (const b of backups) {
    const count = query.trim() ? b.missingMatchingQuery : b.missingCount
    if (count <= 0) continue
    if (!best || count > best.count) best = { file: b.file, count }
  }
  if (!best) {
    return {
      ok: true,
      added: 0,
      total: countBoardCards(await readExistingBoard(DATA_FILE)),
      message: 'Nenhum backup com pedidos ausentes.',
    }
  }
  const result = await mergeMissingFromBackup(DATA_FILE, LOGO_DIR, best.file)
  return { ...result, backupUsed: best.file }
}

export async function handleBoardBackupsApi(req, res, readBody, requireSession, corsHeaders, paths) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  const session = await requireSession(req, res)
  if (!session) return

  const { requireAdminSession } = await import('./users.mjs')
  if (!requireAdminSession(session, res, corsHeaders)) return

  const DATA_FILE = paths.boardFile
  const LOGO_DIR = paths.logoDir
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET') {
    const q = url.searchParams.get('q') || ''
    const data = await listBoardBackupSummaries(DATA_FILE, q)
    res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, ...data }))
    return
  }

  if (req.method === 'POST') {
    const body = await readBody(req)
    let payload = {}
    try {
      payload = body ? JSON.parse(body) : {}
    } catch {
      res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: 'JSON inválido' }))
      return
    }
    const q = String(payload.q || url.searchParams.get('q') || '')
    try {
      let result
      if (payload.autoBest === true) {
        result = await mergeMissingFromBestBackup(DATA_FILE, LOGO_DIR, q)
      } else {
        const file = safeBackupFileName(String(payload.backup || ''))
        if (!file) {
          res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: 'Informe backup válido ou autoBest: true' }))
          return
        }
        result = await mergeMissingFromBackup(DATA_FILE, LOGO_DIR, file)
      }
      res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(result))
    } catch (err) {
      const code = err?.code === 'BACKUP_NOT_FOUND' ? 404 : 500
      res.writeHead(code, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Falha ao restaurar' }))
    }
    return
  }

  res.writeHead(405, corsHeaders())
  res.end('Method Not Allowed')
}
