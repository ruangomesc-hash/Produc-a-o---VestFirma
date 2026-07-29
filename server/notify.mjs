/**
 * Encaminha eventos do kanban para webhook (n8n, Make, Evolution API, etc.)
 * e envia para grupo WhatsApp Business.
 */
export async function handleNotifyApi(req, res, readBody, corsHeaders) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(405, corsHeaders())
    res.end('Method Not Allowed')
    return
  }

  const webhook = process.env.WHATSAPP_WEBHOOK_URL?.trim()
  let payload
  try {
    const body = await readBody(req)
    payload = JSON.parse(body)
  } catch {
    res.writeHead(400, corsHeaders())
    res.end(JSON.stringify({ ok: false, error: 'JSON inválido' }))
    return
  }

  const message = typeof payload.message === 'string' ? payload.message : ''
  if (!message) {
    res.writeHead(400, corsHeaders())
    res.end(JSON.stringify({ ok: false, error: 'Campo message obrigatório' }))
    return
  }

  if (payload.probe === true) {
    res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, probe: true, webhookConfigured: Boolean(webhook) }))
    return
  }

  if (!webhook) {
    const dest =
      typeof payload.grupoWhatsapp === 'string' && payload.grupoWhatsapp
        ? ` → grupo ${payload.grupoWhatsapp}`
        : ''
    console.log(`[vestfirma WhatsApp${dest} — configure WHATSAPP_WEBHOOK_URL]\n`, message)
    res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, mode: 'log', delivered: false }))
    return
  }

  try {
    const forward = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await forward.text().catch(() => '')
    res.writeHead(forward.ok ? 200 : 502, {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
    })
    res.end(
      JSON.stringify({
        ok: forward.ok,
        delivered: forward.ok,
        upstreamStatus: forward.status,
        upstreamBody: text.slice(0, 500),
      }),
    )
  } catch (err) {
    console.error('[vestfirma] webhook WhatsApp:', err)
    res.writeHead(502, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'Falha ao chamar webhook' }))
  }
}
