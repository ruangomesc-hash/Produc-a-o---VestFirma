/**
 * GET /api/health — diagnóstico do servidor (sem expor segredos).
 */
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
  const dataFile = process.env.BOARD_DATA_FILE || 'data/board.json'
  const maxBodyMb = Number(process.env.MAX_BODY_MB || 80)
  const logosExternal = process.env.EXTERNALIZE_BOARD_LOGOS !== '0'

  res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  res.end(
    JSON.stringify({
      ok: true,
      service: 'vestfirma-kanban',
      requireLogin,
      sessionMode: 'node',
      storage: 'filesystem',
      logosExternal,
      maxSaveBodyMb: maxBodyMb,
      whatsappWebhookConfigured: webhook,
      boardDataConfigured: Boolean(dataFile),
      timestamp: new Date().toISOString(),
    }),
  )
}
