import type { BoardState, PedidoComentario } from './types'
import {
  blockLocalFallbackWhenProtected,
  getApiBase,
  isRemoteSyncEnabled,
} from './runtimeConfig'
import {
  authHeaders,
  requestAuthFailureLogout,
  requiresLogin,
} from './authSession'

export type SaveBoardResult =
  | { ok: true; remote: boolean }
  | { ok: false; error: string; remote: boolean }

function boardEndpoint(): string {
  const path = import.meta.env.VITE_API_BOARD_PATH?.trim() || '/board'
  return path.startsWith('/') ? path : `/${path}`
}

export { isRemoteSyncEnabled }

function boardPatchUrl(base: string): string {
  return `${base}${boardEndpoint()}`
}

export async function postPedidoComentario(cardId: string, comentario: PedidoComentario): Promise<
  { ok: true; comentarios: PedidoComentario[]; card: PedidoMidiaPatch } | { ok: false; error: string }
> {
  return postPedidoPatch({ cardId, comentario })
}

export type PedidoMidiaPatch = {
  logoEnviadaCliente?: string[]
  logoProntaImpressao?: string[]
  previewAprovacaoCliente?: string[]
  observacao?: string
  comentarios?: PedidoComentario[]
}

async function postPedidoPatch(
  payload: PedidoMidiaPatch & { cardId: string; comentario?: PedidoComentario },
): Promise<{ ok: true; comentarios: PedidoComentario[]; card: PedidoMidiaPatch } | { ok: false; error: string }> {
  const base = getApiBase()
  if (!base) return { ok: false, error: 'API indisponível' }

  const res = await fetch(boardPatchUrl(base), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ action: 'vestfirma-card-patch', ...payload }),
  })

  if (res.status === 401) {
    requestAuthFailureLogout('board-card-patch')
    return { ok: false, error: 'Sessão expirada' }
  }

  const data = (await res.json().catch(() => ({}))) as PedidoMidiaPatch & {
    ok?: boolean
    comentarios?: PedidoComentario[]
    error?: string
  }
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error || `Falha ao gravar no pedido (${res.status})` }
  }
  return {
    ok: true,
    comentarios: Array.isArray(data.comentarios) ? data.comentarios : [],
    card: {
      logoEnviadaCliente: data.logoEnviadaCliente,
      logoProntaImpressao: data.logoProntaImpressao,
      previewAprovacaoCliente: data.previewAprovacaoCliente,
      observacao: data.observacao,
    },
  }
}

export async function postPedidoCampos(
  cardId: string,
  patch: PedidoMidiaPatch,
): Promise<{ ok: true; comentarios: PedidoComentario[]; card: PedidoMidiaPatch } | { ok: false; error: string }> {
  return postPedidoPatch({ cardId, ...patch })
}

export async function postPedidoMidia(
  cardId: string,
  patch: PedidoMidiaPatch,
): Promise<{ ok: true; card: PedidoMidiaPatch } | { ok: false; error: string }> {
  const posted = await postPedidoCampos(cardId, patch)
  if (!posted.ok) return posted
  return { ok: true, card: posted.card }
}

export type RemoteBoardFetchOptions = {
  signal?: AbortSignal
}

export async function fetchRemoteBoard(
  options?: RemoteBoardFetchOptions,
): Promise<BoardState | null> {
  const base = getApiBase()
  if (!base) return null

  const res = await fetch(`${base}${boardEndpoint()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
    headers: { Accept: 'application/json', ...authHeaders() },
  })

  if (res.status === 401) {
    if (!options?.signal?.aborted) requestAuthFailureLogout('board-get')
    throw new Error(
      requiresLogin() || blockLocalFallbackWhenProtected()
        ? 'Sessão expirada ou acesso negado'
        : 'Servidor exige login (401)',
    )
  }

  if (!res.ok) {
    throw new Error(`Servidor respondeu ${res.status}`)
  }

  const text = (await res.text()).trim()
  if (!text || text === 'null') return null

  return JSON.parse(text) as BoardState
}

export type RemoteBoardSaveOptions = {
  force?: boolean
  /** IDs de pedidos arquivados removidos permanentemente (só admin; header no PUT). */
  permanentlyRemoveArchivedCardIds?: string[]
  /** Confirmação explícita de exclusão (mesmos IDs; header X-Vestfirma-Confirm-Remove-Pedido). */
  confirmRemovePedidoIds?: string[]
}

export async function saveRemoteBoard(
  state: BoardState,
  options?: RemoteBoardSaveOptions,
): Promise<void> {
  const base = getApiBase()
  if (!base) return

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
  }
  if (options?.force) headers['X-Vestfirma-Force-Board'] = '1'
  const removeIds = options?.permanentlyRemoveArchivedCardIds?.filter(Boolean) ?? []
  if (removeIds.length) {
    headers['X-Vestfirma-Remove-Archived-Cards'] = removeIds.join(',')
    const confirmIds = options?.confirmRemovePedidoIds?.filter(Boolean) ?? removeIds
    headers['X-Vestfirma-Confirm-Remove-Pedido'] = confirmIds.join(',')
  }

  const res = await fetch(`${base}${boardEndpoint()}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(state),
  })

  if (res.status === 401) {
    requestAuthFailureLogout('board-put')
    throw new Error('Sessão expirada')
  }

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    try {
      const j = JSON.parse(msg) as { error?: string; code?: string }
      if (j.code === 'BOARD_CARDS_LOST') {
        throw new Error(
          j.error ||
            'Servidor recusou apagar (deploy antigo?). Atualize o serviço Node na Render e tente de novo.',
        )
      }
      if (j.error) throw new Error(j.error)
    } catch (e) {
      if (e instanceof Error && e.message !== msg) throw e
    }
    throw new Error(msg || `Falha ao salvar (${res.status})`)
  }
}
