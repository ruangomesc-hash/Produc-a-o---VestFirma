import { authHeaders, requestAuthFailureLogout } from './authSession'
import { getApiBase, isRemoteSyncEnabled } from './runtimeConfig'

export type BoardBackupSummary = {
  file: string
  label: string
  totalCards: number
  missingCount: number
  missingMatchingQuery: number
  preview: {
    id: string
    numeroPedido: string
    cliente: string
    vendedor: string | null
    arquivado: boolean
  }[]
}

export type BoardBackupsList = {
  ok: boolean
  currentCards: number
  backups: BoardBackupSummary[]
}

function backupsEndpoint(): string {
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')
  return `${base.replace(/\/$/, '')}/board/backups`
}

function backupsRequestUrl(query?: string): string {
  const path = backupsEndpoint()
  const q = query?.trim()
  if (!q) return path
  return `${path}?q=${encodeURIComponent(q)}`
}

export async function fetchBoardBackups(query?: string): Promise<BoardBackupsList> {
  const res = await fetch(backupsRequestUrl(query), {
    cache: 'no-store',
    headers: { Accept: 'application/json', ...authHeaders() },
  })
  if (res.status === 401) {
    requestAuthFailureLogout('board-backups')
    throw new Error('Sessão expirada')
  }
  if (res.status === 403) throw new Error('Só administrador pode restaurar backups')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Falha (${res.status})`)
  }
  return (await res.json()) as BoardBackupsList
}

export type RestoreBackupResult = {
  ok: boolean
  added: number
  total: number
  message: string
  backupUsed?: string
}

export async function restoreBoardFromBackup(options: {
  backup?: string
  autoBest?: boolean
  q?: string
}): Promise<RestoreBackupResult> {
  const res = await fetch(backupsEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(options),
  })
  if (res.status === 401) {
    requestAuthFailureLogout('board-backups-post')
    throw new Error('Sessão expirada')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Falha (${res.status})`)
  }
  return (await res.json()) as RestoreBackupResult
}

export { isRemoteSyncEnabled }
