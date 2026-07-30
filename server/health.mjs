/**
 * GET /api/health — diagnóstico do servidor (sem expor segredos).
 */
import fs from 'node:fs/promises'
import { getBoardPaths } from './dataPaths.mjs'
import { useJwtSessions } from './sessionToken.mjs'
import { countUsersOnDisk } from './usersRepair.mjs'

async function countBoardOnDisk(boardFile) {
  try {
    const raw = await fs.readFile(boardFile, 'utf8')
    const data = JSON.parse(raw)
    const cards = Array.isArray(data?.cards) ? data.cards : []
    const arquivados = cards.filter((c) => c?.arquivadoEm).length
    return { total: cards.length, arquivados, ativos: cards.length - arquivados }
  } catch {
    return null
  }
}

export async function handleHealthApi(req, res, corsHeaders) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, corsHeaders())
    res.end('Method Not Allowed')
    return
  }

  const requireLogin = process.env.REQUIRE_LOGIN === 'true'
  const webhook = Boolean(process.env.WHATSAPP_WEBHOOK_URL?.trim())
  const paths = getBoardPaths()
  const maxBodyMb = Number(process.env.MAX_BODY_MB || 80)
  const logosExternal = process.env.EXTERNALIZE_BOARD_LOGOS !== '0'
  const adminPwdConfigured = Boolean(
    process.env.SEED_ADMIN_PASSWORD?.trim() || process.env.ADMIN_PASSWORD?.trim(),
  )

  const usersOnDisk = await countUsersOnDisk()
  const boardCounts = paths.boardFile ? await countBoardOnDisk(paths.boardFile) : null

  res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  res.end(
    JSON.stringify({
      ok: true,
      service: 'vestfirma-kanban',
      requireLogin,
      sessionMode: useJwtSessions() ? 'jwt' : 'file',
      storage: 'filesystem',
      dataDir: paths.dataDir,
      boardFile: paths.boardFile,
      logosExternal,
      maxSaveBodyMb: maxBodyMb,
      adminPasswordConfigured: adminPwdConfigured,
      storageNote: paths.storageNote || undefined,
      persistentDiskLikely: Boolean(
        paths.dataDir?.includes('/opt/render/project/src/data') ||
          paths.storageNote?.includes('persistente'),
      ),
      onRender: process.env.RENDER === 'true',
      buildTag: 'board-checkup-v1',
      usersOnDisk,
      boardCardsTotal: boardCounts?.total,
      boardCardsActive: boardCounts?.ativos,
      boardCardsArchived: boardCounts?.arquivados,
      whatsappWebhookConfigured: webhook,
      timestamp: new Date().toISOString(),
    }),
  )
}
