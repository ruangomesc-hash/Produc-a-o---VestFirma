import { authHeaders, ensureAuthConfigReady } from './authSession'
import { getAuditActor } from './auditContext'
import { getApiBase } from './runtimeConfig'
import type { UserRole } from './userRoles'

export type AuditEntry = {
  id: string
  at: string
  action: string
  summary: string
  detail?: string
  meta?: Record<string, unknown>
  actorEmail: string
  actorName: string
  actorRole: UserRole | string
}

export type AuditRecordInput = {
  action: string
  summary: string
  detail?: string
  meta?: Record<string, unknown>
}

function apiPath(segment: string): string {
  const clean = segment.replace(/\.php$/i, '').replace(/^\//, '')
  return `/${clean}`
}

/** Registra ação no servidor (não bloqueia a UI). */
export function recordAudit(input: AuditRecordInput): void {
  void (async () => {
    await ensureAuthConfigReady()
    const base = getApiBase()
    if (!base) return
    const actor = getAuditActor()
    if (!actor) return

    try {
      await fetch(`${base}${apiPath('audit')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      })
    } catch {
      /* ignore */
    }
  })()
}

export async function fetchAuditLog(limit = 300): Promise<AuditEntry[]> {
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')

  const res = await fetch(`${base}${apiPath('audit')}?limit=${limit}`, {
    headers: { Accept: 'application/json', ...authHeaders() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Falha ao carregar histórico (${res.status})`)
  }
  const data = (await res.json()) as { entries?: AuditEntry[] }
  return data.entries ?? []
}
