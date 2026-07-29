/**
 * Servidor VestFirma Kanban: arquivos estáticos (dist/) + API do quadro em JSON.
 * Uso: npm run build && npm run server
 */
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'

import { getBoardPaths, initStoragePaths } from './dataPaths.mjs'

await initStoragePaths()

const {
  corsHeaders,
  handleLoginApi,
  handleLogoutApi,
  handleSessionApi,
  requireSession,
} = await import('./auth.mjs')
const { handleNotifyApi } = await import('./notify.mjs')
const { handleHealthApi } = await import('./health.mjs')
const { handleUsersApi } = await import('./users.mjs')
const { handleAuditApi } = await import('./audit.mjs')
const { externalizeBoardLogos, logoMime, resolveLogoFile } = await import('./boardLogos.mjs')
const {
  backupBoardBeforeWrite,
  countBoardCards,
  mergeBoardPreservingPedidos,
  readExistingBoard,
  readBoardWithRecovery,
  preserveArquivadoEmUnlessAdmin,
} = await import('./boardPersist.mjs')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const REQUIRE_LOGIN = process.env.REQUIRE_LOGIN === 'true'
const PORT = Number(process.env.PORT || 4199)
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1')

const MAX_BODY = Number(process.env.MAX_BODY_MB || 80) * 1024 * 1024

function boardFilePath() {
  return getBoardPaths().boardFile
}

function logoDirPath() {
  return getBoardPaths().logoDir
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) {
      throw new Error('Payload too large')
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function handleBoardApi(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  let session = null
  if (REQUIRE_LOGIN) {
    session = await requireSession(req, res)
    if (!session) return
  }

  if (req.method === 'GET') {
    const DATA_FILE = boardFilePath()
    try {
      const data = await readBoardWithRecovery(DATA_FILE)
      const raw = data ? JSON.stringify(data) : 'null'
      res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(raw)
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
        res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
        res.end('null')
      } else {
        throw err
      }
    }
    return
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const DATA_FILE = boardFilePath()
    const LOGO_DIR = logoDirPath()
    const body = await readBody(req)
    let board = JSON.parse(body)
    const existing = await readExistingBoard(DATA_FILE)
    const existingCount = countBoardCards(existing)
    const incomingCount = countBoardCards(board)
    const force =
      String(req.headers['x-vestfirma-force-board'] || req.headers['X-Vestfirma-Force-Board'] || '') ===
      '1'

    const removeRaw =
      req.headers['x-vestfirma-remove-archived-cards'] ||
      req.headers['X-Vestfirma-Remove-Archived-Cards'] ||
      ''
    const removeArchivedIds = String(removeRaw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (removeArchivedIds.length > 0) {
      if (!session || session.role !== 'admin') {
        res.writeHead(403, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'Só o administrador pode apagar pedidos arquivados.' }))
        return
      }
      for (const id of removeArchivedIds) {
        const card = existing?.cards?.find((c) => c.id === id)
        if (!card) {
          res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: `Pedido não encontrado: ${id}` }))
          return
        }
        if (!card.arquivadoEm) {
          res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
          res.end(
            JSON.stringify({
              error: 'Só é permitido apagar pedidos que já estão arquivados.',
              cardId: id,
            }),
          )
          return
        }
      }
    }

    if (board?.demo === true && existingCount > 0) {
      res.writeHead(409, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(
        JSON.stringify({
          ok: false,
          code: 'DEMO_BOARD_BLOCKED',
          error: 'Modo demo não pode substituir pedidos reais no servidor.',
        }),
      )
      return
    }

    if (!force && existingCount > 0 && incomingCount === 0) {
      res.writeHead(409, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(
        JSON.stringify({
          ok: false,
          code: 'BOARD_WIPE_BLOCKED',
          error: 'Recusado: salvar quadro vazio apagaria pedidos no servidor.',
          existingCards: existingCount,
        }),
      )
      return
    }

    board = mergeBoardPreservingPedidos(existing, board, removeArchivedIds)
    board = preserveArquivadoEmUnlessAdmin(existing, board, session)
    const mergedCount = countBoardCards(board)
    if (!force && existingCount > 0 && mergedCount < existingCount) {
      const removed = existingCount - mergedCount
      const allowed =
        removeArchivedIds.length > 0 &&
        removed === removeArchivedIds.length &&
        session?.role === 'admin'
      if (!allowed) {
        res.writeHead(409, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
        res.end(
          JSON.stringify({
            ok: false,
            code: 'BOARD_CARDS_LOST',
            error: 'Recusado: este save removeria pedidos já gravados.',
            existingCards: existingCount,
            mergedCards: mergedCount,
          }),
        )
        return
      }
    }

    if (process.env.EXTERNALIZE_BOARD_LOGOS !== '0') {
      board = await externalizeBoardLogos(board, LOGO_DIR)
    }

    await backupBoardBeforeWrite(DATA_FILE)
    const out = JSON.stringify(board)
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
    const tmp = `${DATA_FILE}.tmp`
    await fs.writeFile(tmp, out, 'utf8')
    await fs.rename(tmp, DATA_FILE)
    res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, savedAt: new Date().toISOString() }))
    return
  }

  res.writeHead(405, corsHeaders())
  res.end('Method Not Allowed')
}

async function handleLogoApi(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }
  if (req.method !== 'GET') {
    res.writeHead(405, corsHeaders())
    res.end('Method Not Allowed')
    return
  }

  const m = url.pathname.match(/^\/api\/logos\/([a-zA-Z0-9-]+)\/(enviada|impressao)\/?$/i)
  if (!m) {
    res.writeHead(404, corsHeaders())
    res.end('Not Found')
    return
  }

  const resolved = await resolveLogoFile(logoDirPath(), m[1], m[2].toLowerCase())
  if (!resolved) {
    res.writeHead(404, corsHeaders())
    res.end('Not Found')
    return
  }

  const data = await fs.readFile(resolved.full)
  res.writeHead(200, {
    ...corsHeaders(),
    'Content-Type': logoMime[resolved.ext] || 'image/jpeg',
    'Cache-Control': 'private, max-age=86400',
  })
  res.end(data)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
}

async function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath)
  if (rel === '/' || rel === '') rel = '/index.html'
  if (rel.includes('..')) {
    res.writeHead(400)
    res.end('Bad Request')
    return
  }

  const filePath = path.join(DIST, rel)
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  let target = filePath
  try {
    const st = await stat(target)
    if (st.isDirectory()) target = path.join(target, 'index.html')
  } catch {
    if (!rel.includes('.')) {
      target = path.join(DIST, 'index.html')
    } else {
      res.writeHead(404)
      res.end('Not Found')
      return
    }
  }

  if (!existsSync(target)) {
    target = path.join(DIST, 'index.html')
    if (!existsSync(target)) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Execute npm run build antes de npm run server')
      return
    }
  }

  const ext = path.extname(target).toLowerCase()
  const cache =
    ext === '.html'
      ? 'no-cache, no-store, must-revalidate'
      : ext === '.js' || ext === '.css'
        ? 'no-cache'
        : 'public, max-age=86400'
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': cache,
  })
  createReadStream(target).pipe(res)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)

    if (url.pathname === '/api/login' || url.pathname === '/api/login.php') {
      await handleLoginApi(req, res, readBody)
      return
    }
    if (url.pathname === '/api/session' || url.pathname === '/api/session.php') {
      await handleSessionApi(req, res)
      return
    }
    if (url.pathname === '/api/logout' || url.pathname === '/api/logout.php') {
      await handleLogoutApi(req, res)
      return
    }

    if (url.pathname === '/api/board' || url.pathname === '/api/board.php') {
      await handleBoardApi(req, res)
      return
    }

    if (url.pathname === '/api/board/backups' || url.pathname === '/api/board/backups.php') {
      const { handleBoardBackupsApi } = await import('./boardBackups.mjs')
      await handleBoardBackupsApi(req, res, readBody, requireSession, corsHeaders, getBoardPaths())
      return
    }

    if (url.pathname.startsWith('/api/logos/')) {
      await handleLogoApi(req, res, url)
      return
    }

    if (url.pathname === '/api/notify' || url.pathname === '/api/notify.php') {
      await handleNotifyApi(req, res, readBody, corsHeaders)
      return
    }

    if (url.pathname === '/api/health' || url.pathname === '/api/health.php') {
      await handleHealthApi(req, res, corsHeaders)
      return
    }

    if (url.pathname === '/api/users' || url.pathname === '/api/users.php') {
      await handleUsersApi(req, res, readBody, requireSession, corsHeaders)
      return
    }

    if (url.pathname === '/api/audit' || url.pathname === '/api/audit.php') {
      await handleAuditApi(req, res, readBody, requireSession, corsHeaders)
      return
    }

    if (process.env.API_ONLY === '1') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not Found')
      return
    }

    await serveStatic(req, res, url.pathname)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : String(err)
      res.writeHead(500, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(
        JSON.stringify({
          ok: false,
          code: 'SERVER_ERROR',
          error: 'Erro interno na API.',
          message: msg,
          fix: 'Render → Logs. Start: npm run start:production. Disco em /var/data se usar BOARD_DATA_*.',
        }),
      )
    }
  }
})

if (!existsSync(DIST)) {
  console.warn('[vestfirma] Pasta dist/ não encontrada. Rode: npm run build')
}

const paths = getBoardPaths()
server.listen(PORT, HOST, () => {
  if (process.env.API_ONLY === '1') {
    console.log(`VestFirma API — http://${HOST}:${PORT}/api/board`)
  } else {
    console.log(`VestFirma Kanban — http://${HOST}:${PORT}`)
  }
  console.log(`Quadro salvo em: ${paths.boardFile}`)
  console.log(`Logos em: ${paths.logoDir}`)
  if (paths.storageNote) console.log(`[vestfirma] ${paths.storageNote}`)
})
