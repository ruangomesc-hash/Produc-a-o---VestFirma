import { requiresLogin, verifySession } from './authSession'
import { isRemoteSyncEnabled } from './remoteBoard'
import type { BoardState } from './types'
import { getWhatsappNotifyMode, whatsappNotifyEnabled } from './whatsappNotify'

export type CheckStatus = 'ok' | 'warn' | 'error' | 'off'

export type HealthCheck = {
  id: string
  title: string
  status: CheckStatus
  summary: string
  detail?: string
}

type ServerHealth = {
  ok?: boolean
  requireLogin?: boolean
  whatsappWebhookConfigured?: boolean
  boardDataConfigured?: boolean
  timestamp?: string
}

function apiBase(): string | null {
  const raw = import.meta.env.VITE_API_BASE?.trim()
  if (!raw) return null
  return raw.replace(/\/$/, '')
}

function healthUrl(): string | null {
  const base = apiBase()
  if (!base) return null
  const path = import.meta.env.VITE_API_HEALTH_PATH?.trim() || '/health'
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function boardUrl(): string | null {
  const base = apiBase()
  if (!base) return null
  const path = import.meta.env.VITE_API_BOARD_PATH?.trim() || '/board'
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function notifyUrl(): string | null {
  const base = apiBase()
  if (!base) return null
  const path = import.meta.env.VITE_API_NOTIFY_PATH?.trim() || '/notify'
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

async function checkIndexedDb(): Promise<HealthCheck> {
  try {
    const req = indexedDB.open('vestfirma-kanban-test', 1)
    await new Promise<void>((resolve, reject) => {
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        req.result.close()
        indexedDB.deleteDatabase('vestfirma-kanban-test')
        resolve()
      }
    })
    return {
      id: 'idb',
      title: 'Salvamento no navegador',
      status: 'ok',
      summary: 'IndexedDB disponível',
      detail: 'Cópia local do quadro funciona neste navegador.',
    }
  } catch (err) {
    return {
      id: 'idb',
      title: 'Salvamento no navegador',
      status: 'error',
      summary: 'IndexedDB indisponível',
      detail: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init })
    const text = await res.text()
    let data: unknown
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Falha de rede',
    }
  }
}

export async function runSystemHealthChecks(board: BoardState): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = []

  checks.push(await checkIndexedDb())

  const remote = isRemoteSyncEnabled()
  checks.push({
    id: 'api-config',
    title: 'API do servidor',
    status: remote ? 'ok' : 'warn',
    summary: remote ? 'Configurada (VITE_API_BASE)' : 'Desligada',
    detail: remote
      ? import.meta.env.VITE_API_BASE
      : 'Só salva neste navegador. Defina VITE_API_BASE=/api no .env e use npm run server.',
  })

  let serverHealth: ServerHealth | null = null
  const hUrl = healthUrl()
  if (remote && hUrl) {
    const h = await fetchJson(hUrl)
    if (h.ok && h.data && typeof h.data === 'object') {
      serverHealth = h.data as ServerHealth
      checks.push({
        id: 'server-health',
        title: 'Servidor VestFirma',
        status: 'ok',
        summary: 'Respondendo (/api/health)',
        detail: serverHealth.timestamp
          ? `Última resposta: ${new Date(serverHealth.timestamp).toLocaleString('pt-BR')}`
          : undefined,
      })
    } else {
      checks.push({
        id: 'server-health',
        title: 'Servidor VestFirma',
        status: 'error',
        summary: h.error ?? `Sem resposta (${h.status || 'rede'})`,
        detail: 'Confira se Iniciar Kanban.command está rodando em http://127.0.0.1:4199',
      })
    }
  }

  const bUrl = boardUrl()
  if (remote && bUrl) {
    const b = await fetchJson(bUrl, { headers: { Accept: 'application/json' } })
    if (b.ok) {
      checks.push({
        id: 'board-api',
        title: 'Quadro compartilhado',
        status: 'ok',
        summary: 'Leitura do quadro OK',
        detail: `GET ${import.meta.env.VITE_API_BOARD_PATH || '/board'}`,
      })
    } else if (b.status === 401) {
      checks.push({
        id: 'board-api',
        title: 'Quadro compartilhado',
        status: requiresLogin() ? 'warn' : 'error',
        summary: 'Servidor exige login (401)',
        detail: requiresLogin()
          ? 'Faça login ou alinhe REQUIRE_LOGIN=false no servidor.'
          : 'Build com login desligado, mas servidor exige sessão.',
      })
    } else {
      checks.push({
        id: 'board-api',
        title: 'Quadro compartilhado',
        status: 'error',
        summary: b.error ?? `Erro HTTP ${b.status}`,
      })
    }
  }

  const loginRequired = requiresLogin()
  checks.push({
    id: 'login-build',
    title: 'Login no site',
    status: loginRequired ? 'ok' : 'off',
    summary: loginRequired ? 'Exigido (publicado)' : 'Desligado (uso local)',
    detail: loginRequired
      ? 'VITE_REQUIRE_LOGIN=true no build.'
      : 'Normal antes de publicar na Hostinger.',
  })

  if (loginRequired && remote) {
    const sessionOk = await verifySession()
    checks.push({
      id: 'login-session',
      title: 'Sua sessão',
      status: sessionOk ? 'ok' : 'error',
      summary: sessionOk ? 'Autenticado' : 'Não logado ou sessão expirada',
    })
  }

  const serverWantLogin = serverHealth?.requireLogin === true
  if (remote && serverHealth && loginRequired !== serverWantLogin) {
    checks.push({
      id: 'login-mismatch',
      title: 'Login build × servidor',
      status: 'warn',
      summary: 'Configuração diferente',
      detail: `Build: ${loginRequired ? 'exige' : 'livre'} · Servidor: ${serverWantLogin ? 'exige' : 'livre'}`,
    })
  }

  const waEnabled = whatsappNotifyEnabled()
  const waMode = getWhatsappNotifyMode()
  checks.push({
    id: 'wa-client',
    title: 'Avisos WhatsApp (app)',
    status: waEnabled ? 'ok' : 'off',
    summary: waEnabled
      ? `Ativos — modo ${waMode === 'webhook' ? 'automático' : 'abrir WhatsApp'}`
      : 'Desligados em Grupo WhatsApp',
  })

  if (remote && waEnabled && waMode === 'webhook') {
    const webhookOnServer = serverHealth?.whatsappWebhookConfigured === true
    if (serverHealth) {
      checks.push({
        id: 'wa-webhook',
        title: 'Webhook WhatsApp (servidor)',
        status: webhookOnServer ? 'ok' : 'warn',
        summary: webhookOnServer
          ? 'WHATSAPP_WEBHOOK_URL configurada'
          : 'Webhook não configurada no .env',
        detail: webhookOnServer
          ? 'n8n/Evolution receberá os avisos.'
          : 'Mensagens só aparecem no terminal do Node até configurar a URL.',
      })
    }

    const nUrl = notifyUrl()
    if (nUrl) {
      const probe = await fetchJson(nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '__vestfirma_probe__', probe: true }),
      })
      checks.push({
        id: 'wa-notify-api',
        title: 'API de notificação',
        status: probe.ok || probe.status === 400 ? 'ok' : 'error',
        summary: probe.ok ? 'Endpoint /api/notify OK' : `Falha (${probe.status || probe.error})`,
      })
    }
  }

  const vendedores = board.vendedores
  const comGrupo = vendedores.filter((v) => v.grupoWhatsapp?.trim()).length
  if (vendedores.length === 0) {
    checks.push({
      id: 'vendedores',
      title: 'Grupos por vendedor',
      status: 'warn',
      summary: 'Nenhum vendedor cadastrado',
      detail: 'Cadastre vendedores e o ID do grupo WhatsApp de cada um.',
    })
  } else {
    checks.push({
      id: 'vendedores',
      title: 'Grupos por vendedor',
      status: comGrupo === vendedores.length ? 'ok' : comGrupo > 0 ? 'warn' : 'error',
      summary: `${comGrupo} de ${vendedores.length} com grupo WhatsApp`,
      detail:
        comGrupo < vendedores.length
          ? 'Complete o campo “Grupo WhatsApp (ID)” em Vendedores.'
          : 'Cada vendedor tem grupo para receber avisos.',
    })
  }

  if (board.demo) {
    checks.push({
      id: 'demo',
      title: 'Modo demo',
      status: 'warn',
      summary: 'Quadro de demonstração',
      detail: 'Avisos WhatsApp não são enviados no modo demo.',
    })
  }

  return checks
}

export function countByStatus(checks: HealthCheck[]) {
  let ok = 0
  let warn = 0
  let err = 0
  let off = 0
  for (const c of checks) {
    if (c.status === 'ok') ok++
    else if (c.status === 'warn') warn++
    else if (c.status === 'error') err++
    else off++
  }
  return { ok, warn, err, off }
}
