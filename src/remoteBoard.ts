import type { BoardState } from './types'
import { authHeaders, handleAuthResponse, requiresLogin } from './authSession'

export type SaveBoardResult =
  | { ok: true; remote: boolean }
  | { ok: false; error: string; remote: boolean }

function apiBase(): string | null {
  const raw = import.meta.env.VITE_API_BASE?.trim()
  if (!raw) return null
  return raw.replace(/\/$/, '')
}

function boardEndpoint(): string {
  const path = import.meta.env.VITE_API_BOARD_PATH?.trim() || 'board.php'
  return path.startsWith('/') ? path : `/${path}`
}

export function isRemoteSyncEnabled(): boolean {
  return apiBase() !== null
}

export async function fetchRemoteBoard(): Promise<BoardState | null> {
  const base = apiBase()
  if (!base) return null

  const res = await fetch(`${base}${boardEndpoint()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json', ...authHeaders() },
  })

  if (res.status === 401 && requiresLogin()) {
    handleAuthResponse(401)
    throw new Error('Sessão expirada')
  }

  if (res.status === 401) {
    throw new Error('Servidor exige login (401)')
  }

  if (!res.ok) {
    throw new Error(`Servidor respondeu ${res.status}`)
  }

  const text = (await res.text()).trim()
  if (!text || text === 'null') return null

  return JSON.parse(text) as BoardState
}

export async function saveRemoteBoard(state: BoardState): Promise<void> {
  const base = apiBase()
  if (!base) return

  const res = await fetch(`${base}${boardEndpoint()}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(state),
  })

  if (res.status === 401 && requiresLogin()) {
    handleAuthResponse(401)
    throw new Error('Sessão expirada')
  }

  if (res.status === 401) {
    throw new Error('Servidor exige login (401). Ative REQUIRE_LOGIN no servidor ou desative no build.')
  }

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `Falha ao salvar (${res.status})`)
  }
}
