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
  midiaAtualizadaEm?: string
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

export async function postMoverPedido(
  cardId: string,
  columnId: string,
): Promise<{ ok: true; columnId: string } | { ok: false; error: string }> {
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
    body: JSON.stringify({ action: 'vestfirma-card-move', cardId, columnId }),
  })

  if (res.status === 401) {
    requestAuthFailureLogout('board-card-move')
    return { ok: false, error: 'Sessão expirada' }
  }

  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; columnId?: string; error?: string }
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error || `Falha ao mudar a etapa (${res.status})` }
  }
  return { ok: true, columnId: data.columnId || columnId }
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

export async function fetchBoardRevision(): Promise<{ updatedAt: string | null; cards: number } | null> {
  const base = getApiBase()
  if (!base) return null

  const res = await fetch(`${base}${boardEndpoint()}/revision?t=${Date.now()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      ...authHeaders(),
    },
  })

  if (!res.ok) return null
  const data = (await res.json().catch(() => null)) as { updatedAt?: string | null; cards?: number } | null
  if (!data) return null
  return {
    updatedAt: data.updatedAt ?? null,
    cards: Number(data.cards) || 0,
  }
}

export async function fetchRemoteBoard(
  options?: RemoteBoardFetchOptions,
): Promise<BoardState | null> {
  const base = getApiBase()
  if (!base) return null

  const url = `${base}${boardEndpoint()}?t=${Date.now()}`
  const res = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      ...authHeaders(),
    },
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
    const trimmed = msg.trim()
    if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
      throw new Error(
        'A API do quadro não respondeu (página HTML). O deploy Node precisa estar no ar — os pedidos continuam neste navegador.',
      )
    }
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
      if (e instanceof Error && e.message !== msg && !e.message.includes('JSON')) throw e
    }
    throw new Error(msg || `Falha ao salvar (${res.status})`)
  }
}

/** Avisa na hora quando qualquer usuário grava o quadro. Reconecta se a ligação cair. */
export function subscribeBoardLive(onBoard: () => void): () => void {
  if (!isRemoteSyncEnabled()) return () => {}

  const base = getApiBase()
  if (!base) return () => {}

  const ctrl = new AbortController()
  let stopped = false

  const wait = (ms: number) =>
    new Promise((resolve) => {
      const id = setTimeout(resolve, ms)
      ctrl.signal.addEventListener('abort', () => {
        clearTimeout(id)
        resolve(undefined)
      })
    })

  const run = async () => {
    let delay = 1000
    while (!stopped) {
      try {
        const res = await fetch(`${base}${boardEndpoint()}/live?t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          signal: ctrl.signal,
          headers: {
            Accept: 'text/event-stream',
            ...authHeaders(),
          },
        })
        if (res.status === 401) {
          requestAuthFailureLogout('board-live')
          return
        }
        if (!res.ok || !res.body) throw new Error(`ao vivo ${res.status}`)
        delay = 1000
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (!stopped) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          let split = buf.indexOf('\n\n')
          while (split >= 0) {
            const chunk = buf.slice(0, split)
            buf = buf.slice(split + 2)
            if (chunk.includes('event: board')) onBoard()
            split = buf.indexOf('\n\n')
          }
        }
      } catch {
        if (stopped || ctrl.signal.aborted) return
      }
      if (stopped) return
      await wait(delay)
      delay = Math.min(delay * 2, 8000)
    }
  }

  void run()
  return () => {
    stopped = true
    ctrl.abort()
  }
}
