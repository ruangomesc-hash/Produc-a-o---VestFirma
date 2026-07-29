/**
 * GET /api/health — diagnóstico do servidor (sem expor segredos).
 */
import { getBoardPaths } from './dataPaths.mjs'
import { useJwtSessions } from './sessionToken.mjs'

export function handleHealthApi(req, res, corsHeaders) {
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

  const requireLogin = process.env.REQUIRE_LOGIN === 'true'
  const webhook = Boolean(process.env.WHATSAPP_WEBHOOK_URL?.trim())
  const paths = getBoardPaths()
  const maxBodyMb = Number(process.env.MAX_BODY_MB || 80)
  const logosExternal = process.env.EXTERNALIZE_BOARD_LOGOS !== '0'
  const adminPwdConfigured = Boolean(
    process.env.SEED_ADMIN_PASSWORD?.trim() || process.env.ADMIN_PASSWORD?.trim(),
  )

  res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
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
      onRender: process.env.RENDER === 'true',
      whatsappWebhookConfigured: webhook,
      timestamp: new Date().toISOString(),
    }),
  )
}
