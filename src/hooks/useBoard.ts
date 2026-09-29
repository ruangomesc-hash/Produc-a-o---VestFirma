import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_BOARD } from '../defaultBoard'
import { criarComentarioPedido, autorComentarioFromSession, type ComentarioAutor } from '../pedidoComentarios'
import { registrarCriacaoPedido, registrarMudancaEtapa, tituloColuna } from '../historicoEtapa'
import { isRemoteSyncEnabled, fetchRemoteBoard, postPedidoComentario } from '../remoteBoard'
import { notificarSePedidoCriado, notificarSePedidoMovido } from '../whatsappNotify'
import { mesclarSegmentos } from '../segmentosEmpresa'
import { isAuthSessionError, requestAuthFailureLogout } from '../authSession'
import { getAuditActor } from '../auditContext'
import { recordAudit } from '../auditLog'
import { loadBoard, normalizeBoard, saveBoard, type SaveBoardResult } from '../storage'
import { mergeBoardPreservingPedidos, contagemPedidos } from '../pedidosPolicy'
import { boardTemPedidosAlemDoServidor, mergeBoardLoggedInFromServer } from '../boardLoadMerge'
import {
  snapshotBoardPedidos,
  loadBoardPedidosSnapshot,
  contagemPedidosNoSnapshot,
  removeCardFromPedidosSnapshot,
  purgeSnapshotPedidosExcluidos,
} from '../boardPedidosSnapshot'
import { recordPedidoExcluidoPermanente, filterBoardRemovendoExcluidos } from '../pedidosExcluidosLocal'
import type { BoardState, CardFormData, OrderCard } from '../types'
import type { ManagedUser, SessionProfile } from '../userRoles'
import { canPlaceOrders } from '../userRoles'
import { fetchUsers } from '../usersApi'
import {
  findVendedorForManagedUser,
  findVendedorIdForSession,
  managedUserToVendedor,
  managedUserFromSession,
  boardAposSyncVendedoresCompleto,
  unifyVendedorRowsAndRelinkCards,
  relinkOrphanVendedorIdsConservative,
  vendedorPodeAcessarPedido,
  type VendedorContatoPatch,
} from '../vendedorUserSync'
import type { Vendedor } from '../types'

function vendedoresListChanged(before: Vendedor[], after: Vendedor[]): boolean {
  if (before.length !== after.length) return true
  return after.some((v) => {
    const c = before.find((x) => x.id === v.id)
    return !c || c.nome !== v.nome || c.userId !== v.userId || (c.email ?? '') !== (v.email ?? '')
  })
}

function boardAposSyncVendedores(board: BoardState, users: ManagedUser[]): BoardState {
  return boardAposSyncVendedoresCompleto(board, users)
}

async function boardComVendedoresDosUsuarios(board: BoardState): Promise<BoardState> {
  try {
    const users = await fetchUsers()
    return boardAposSyncVendedoresCompleto(board, users)
  } catch {
    return relinkOrphanVendedorIdsConservative(unifyVendedorRowsAndRelinkCards(board))
  }
}

export type BoardSyncState = {
  remote: boolean
  status: 'idle' | 'saving' | 'saved' | 'error'
  message?: string
}

function newId() {
  return crypto.randomUUID()
}

function cardFormDataParaVendedorLogado(board: BoardState, data: CardFormData): CardFormData {
  const actor = getAuditActor()
  if (actor?.role !== 'vendedor') return data
  const vendedorId = findVendedorIdForSession(board, actor as SessionProfile)
  if (!vendedorId) return data
  return { ...data, vendedorId }
}

function vendedorLogadoPodeCard(board: BoardState, card: OrderCard | undefined): boolean {
  const actor = getAuditActor()
  if (!card) return false
  return vendedorPodeAcessarPedido(board, actor, card)
}

export function useBoard() {
  const [board, setBoard] = useState<BoardState>(DEFAULT_BOARD)
  const [ready, setReady] = useState(false)
  const [sync, setSync] = useState<BoardSyncState>(() => ({
    remote: isRemoteSyncEnabled(),
    status: 'idle',
  }))
  const [localRestore, setLocalRestore] = useState<BoardState | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boardRef = useRef(board)
  boardRef.current = board

  useEffect(() => {
    let cancelled = false
    const abort = new AbortController()
    const remote = isRemoteSyncEnabled()
    const fallback = remote
      ? undefined
      : setTimeout(() => {
          if (!cancelled) setReady(true)
        }, 2500)

    loadBoard({ signal: abort.signal })
      .then(async (result) => {
        if (cancelled) return
        let board = result.board
        const richer = result.richerLocal ?? null

        const beforeVendedores = board.vendedores
        const beforeCards = board.cards
        board = await boardComVendedoresDosUsuarios(board)
        const remapped = board.cards.some((c) => {
          const prev = beforeCards.find((x) => x.id === c.id)
          return prev && prev.vendedorId !== c.vendedorId
        })
        if (vendedoresListChanged(beforeVendedores, board.vendedores) || remapped) {
          void saveBoard(board, { immediate: true })
        }

        setBoard(board)
        setLocalRestore(richer)
        purgeSnapshotPedidosExcluidos()

        if (richer && contagemPedidos(board) > 0 && isRemoteSyncEnabled()) {
          void saveBoard(board, { forceRemote: true }).then((pushResult) => {
            if (cancelled) return
            if (pushResult.ok && pushResult.remote) {
              setLocalRestore(null)
              setSync({ remote: true, status: 'saved' })
            } else if (!pushResult.ok) {
              setSync({
                remote: pushResult.remote,
                status: 'error',
                message:
                  pushResult.error ||
                  'Pedido(s) neste aparelho ainda não foram gravados no servidor.',
              })
            }
          })
        } else {
          setSync({
            remote,
            status: 'saved',
          })
        }
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (isAuthSessionError(err)) {
          requestAuthFailureLogout('load-board')
          return
        }
        const message = err instanceof Error ? err.message : 'Falha ao carregar o quadro'
        console.warn('VestFirma: erro ao carregar quadro (sessão mantida):', err)
        setSync({ remote, status: 'error', message })
      })
      .finally(() => {
        if (!cancelled) {
          if (fallback) clearTimeout(fallback)
          setReady(true)
        }
      })

    return () => {
      cancelled = true
      abort.abort()
      if (fallback) clearTimeout(fallback)
    }
  }, [])

  const persist = useCallback(
    (
      next: BoardState,
      opts?: {
        forceRemote?: boolean
        skipRemote?: boolean
        immediate?: boolean
        permanentlyRemoveArchivedCardIds?: string[]
      },
    ) => {
      const removeIds = opts?.permanentlyRemoveArchivedCardIds?.filter(Boolean) ?? []
      const safe = mergeBoardPreservingPedidos(boardRef.current, next, removeIds)
      boardRef.current = safe
      setBoard(safe)
      const delay = opts?.immediate ? 0 : 400
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        setSync((s) => ({ ...s, status: 'saving' }))
        void (async () => {
          const payload = boardRef.current
          const result = await saveBoard(payload, {
            forceRemote: opts?.forceRemote,
            skipRemote: opts?.skipRemote,
            permanentlyRemoveArchivedCardIds: removeIds.length ? removeIds : undefined,
          })
          if (result.ok) {
            setSync({ remote: result.remote, status: 'saved' })
          } else {
            setSync({
              remote: result.remote,
              status: 'error',
              message: !result.ok ? result.error : undefined,
            })
          }
        })()
      }, delay)
    },
    [],
  )

  const addColumn = useCallback(
    (title: string) => {
      if (getAuditActor()?.role !== 'admin') return
      const trimmed = title.trim()
      if (!trimmed) return
      persist({
        ...board,
        columns: [...board.columns, { id: newId(), title: trimmed }],
      })
      recordAudit({
        action: 'coluna.criada',
        summary: `Criou a etapa “${trimmed}”`,
      })
    },
    [board, persist],
  )

  const removeColumn = useCallback(
    (columnId: string, _deleteCards: boolean) => {
      if (getAuditActor()?.role !== 'admin') return
      if (board.columns.length <= 1) return
      const rest = board.columns.filter((c) => c.id !== columnId)
      const fallback = rest[0]?.id
      if (!fallback) return
      const cards = board.cards.map((c) => {
        if (c.columnId !== columnId) return c
        const now = new Date().toISOString()
        return {
          ...c,
          columnId: fallback,
          etapaDesde: now,
          historicoEtapa: registrarMudancaEtapa(c, board, fallback, now),
        }
      })
      persist({ ...board, columns: rest, cards })
      recordAudit({
        action: 'coluna.removida',
        summary: `Removeu etapa (pedidos movidos para “${rest[0]?.title ?? 'primeira coluna'}”)`,
        detail: columnId,
      })
    },
    [board, persist],
  )

  const addVendedor = useCallback(
    (nome: string, whatsapp?: string, grupoWhatsapp?: string) => {
      const trimmed = nome.trim()
      if (!trimmed) return false
      const exists = board.vendedores.some(
        (v) => v.nome.toLowerCase() === trimmed.toLowerCase(),
      )
      if (exists) return false
      const wa = whatsapp?.trim()
      const grupo = grupoWhatsapp?.trim()
      persist({
        ...board,
        vendedores: [
          ...board.vendedores,
          {
            id: newId(),
            nome: trimmed,
            whatsapp: wa || undefined,
            grupoWhatsapp: grupo || undefined,
          },
        ],
      })
      return true
    },
    [board, persist],
  )

  const updateVendedorContato = useCallback(
    (
      vendedorId: string,
      patch: { whatsapp?: string; grupoWhatsapp?: string },
    ) => {
      persist({
        ...board,
        vendedores: board.vendedores.map((v) => {
          if (v.id !== vendedorId) return v
          const next = { ...v }
          if (patch.whatsapp !== undefined) {
            const wa = patch.whatsapp.trim()
            next.whatsapp = wa || undefined
          }
          if (patch.grupoWhatsapp !== undefined) {
            const g = patch.grupoWhatsapp.trim()
            next.grupoWhatsapp = g || undefined
          }
          return next
        }),
      })
    },
    [board, persist],
  )

  const removeVendedor = useCallback(
    (vendedorId: string) => {
      if (getAuditActor()?.role !== 'admin') return
      persist({
        ...board,
        vendedores: board.vendedores.filter((v) => v.id !== vendedorId),
        cards: board.cards.map((c) =>
          c.vendedorId === vendedorId ? { ...c, vendedorId: null } : c,
        ),
      })
    },
    [board, persist],
  )

  const upsertVendedorFromManagedUser = useCallback(
    (user: ManagedUser, contato?: VendedorContatoPatch) => {
      if (!canPlaceOrders(user.role)) return
      const current = boardRef.current
      const existing = findVendedorForManagedUser(current, user)
      const next = managedUserToVendedor(user, existing, contato)
      if (existing) {
        const unchanged =
          existing.nome === next.nome &&
          existing.email === next.email &&
          existing.userId === next.userId &&
          (existing.whatsapp ?? '') === (next.whatsapp ?? '') &&
          (existing.grupoWhatsapp ?? '') === (next.grupoWhatsapp ?? '')
        if (unchanged) return
        persist(
          {
            ...current,
            vendedores: current.vendedores.map((v) => (v.id === existing.id ? next : v)),
          },
          { immediate: true },
        )
        return
      }
      persist(
        {
          ...current,
          vendedores: [...current.vendedores, next],
        },
        { immediate: true },
      )
    },
    [persist],
  )

  const upsertVendedorFromSession = useCallback(
    (profile: SessionProfile) => {
      if (!canPlaceOrders(profile.role)) return
      upsertVendedorFromManagedUser(managedUserFromSession(profile))
    },
    [upsertVendedorFromManagedUser],
  )

  const removeVendedorForManagedUser = useCallback(
    (userId: string) => {
      if (getAuditActor()?.role !== 'admin') return
      const linked = board.vendedores.find((v) => v.userId === userId)
      if (linked) removeVendedor(linked.id)
    },
    [board, removeVendedor, board.vendedores],
  )

  const syncVendedoresFromManagedUsers = useCallback(
    (users: ManagedUser[]) => {
      const current = boardRef.current
      const merged = boardAposSyncVendedores(current, users)
      const vendedorIdsRemapped = merged.cards.some((c) => {
        const prev = current.cards.find((x) => x.id === c.id)
        return prev && prev.vendedorId !== c.vendedorId
      })
      if (vendedoresListChanged(current.vendedores, merged.vendedores) || vendedorIdsRemapped) {
        persist(merged, { immediate: true })
      }
    },
    [persist],
  )

  const addSegmento = useCallback(
    (nome: string): string | null => {
      const trimmed = nome.trim()
      if (!trimmed) return null
      const lista = mesclarSegmentos(board.segmentos)
      const existing = lista.find((s) => s.nome.toLowerCase() === trimmed.toLowerCase())
      if (existing) {
        persist({ ...board, segmentos: lista })
        return existing.id
      }
      const id = newId()
      const next = [...lista, { id, nome: trimmed }].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR'),
      )
      persist({ ...board, segmentos: next })
      return id
    },
    [board, persist],
  )

  const addCard = useCallback(
    async (columnId: string, data: CardFormData): Promise<SaveBoardResult> => {
      const actor = getAuditActor()
      let current = boardRef.current
      if (actor && canPlaceOrders(actor.role)) {
        current = boardAposSyncVendedoresCompleto(current, [
          managedUserFromSession(actor as SessionProfile),
        ])
        setBoard(current)
      }
      const payload = cardFormDataParaVendedorLogado(current, data)
      if (actor?.role === 'vendedor' && !payload.vendedorId) {
        const fail: SaveBoardResult = {
          ok: false,
          error:
            'Não foi possível vincular seu usuário ao pedido. Saia e entre de novo ou avise o administrador.',
          remote: isRemoteSyncEnabled(),
        }
        setSync({ remote: fail.remote, status: 'error', message: fail.error })
        return fail
      }
      const now = new Date().toISOString()
      const card: OrderCard = {
        ...payload,
        id: newId(),
        columnId,
        etapaDesde: now,
        createdAt: now,
        historicoEtapa: registrarCriacaoPedido(current, columnId, now),
        comentarios: [],
      }
      const next = mergeBoardPreservingPedidos(current, {
        ...current,
        cards: [...current.cards, card],
      })
      setBoard(next)
      setSync((s) => ({ ...s, status: 'saving' }))
      const forceRemote = actor?.role === 'vendedor' && isRemoteSyncEnabled()
      const result = await saveBoard(next, forceRemote ? { forceRemote: true } : undefined)
      if (result.ok) {
        if (!isRemoteSyncEnabled() || result.remote) {
          setLocalRestore(null)
          snapshotBoardPedidos(next)
          notificarSePedidoCriado(card, next)
          recordAudit({
            action: 'pedido.criado',
            summary: `Novo pedido ${card.numeroPedido} — ${card.cliente}`,
            meta: { cardId: card.id, columnId },
          })
        }
        setSync({ remote: result.remote, status: 'saved' })
      } else {
        setSync({
          remote: result.remote,
          status: 'error',
          message: !result.ok ? result.error : undefined,
        })
      }
      return result
    },
    [],
  )

  const updateCard = useCallback(
    (cardId: string, data: CardFormData) => {
      const current = boardRef.current
      const prev = current.cards.find((c) => c.id === cardId)
      if (!vendedorLogadoPodeCard(current, prev)) return
      const payload = cardFormDataParaVendedorLogado(current, data)
      persist({
        ...current,
        cards: current.cards.map((c) =>
          c.id === cardId ? { ...c, ...payload } : c,
        ),
      })
      recordAudit({
        action: 'pedido.editado',
        summary: `Editou pedido ${payload.numeroPedido || prev?.numeroPedido} — ${payload.cliente || prev?.cliente}`,
        meta: { cardId },
      })
    },
    [persist],
  )

  const addPedidoComentario = useCallback(
    (cardId: string, texto: string, autor: ComentarioAutor) => {
      const trimmed = texto.trim()
      if (!trimmed) return
      const current = boardRef.current
      const alvo = current.cards.find((c) => c.id === cardId)
      if (!vendedorLogadoPodeCard(current, alvo)) return
      const actor = getAuditActor()
      const autorEfetivo = autorComentarioFromSession(actor, autor)
      const entry = criarComentarioPedido(trimmed, autorEfetivo)
      const next: BoardState = {
        ...current,
        cards: current.cards.map((c) =>
          c.id === cardId
            ? { ...c, comentarios: [...(c.comentarios ?? []), entry] }
            : c,
        ),
      }
      boardRef.current = next
      setBoard(next)
      void (async () => {
        const posted = await postPedidoComentario(cardId, entry)
        if (posted.ok) {
          const { comentarios } = posted
          setBoard((prev) => {
            const updated = {
              ...prev,
              cards: prev.cards.map((c) => (c.id === cardId ? { ...c, comentarios } : c)),
            }
            boardRef.current = updated
            return updated
          })
          return
        }
        persist(boardRef.current, { immediate: true, forceRemote: true })
      })()
      recordAudit({
        action: 'pedido.comentario',
        summary: `${autorEfetivo.nome} comentou no pedido ${alvo?.numeroPedido ?? cardId}`,
        detail: trimmed.slice(0, 500),
        meta: { cardId },
      })
    },
    [persist],
  )

  const archiveCard = useCallback(
    (cardId: string) => {
      if (getAuditActor()?.role !== 'admin') return
      const alvo = board.cards.find((c) => c.id === cardId)
      if (!alvo) return
      const now = new Date().toISOString()
      persist({
        ...board,
        cards: board.cards.map((c) =>
          c.id === cardId ? { ...c, arquivadoEm: now } : c,
        ),
      })
      recordAudit({
        action: 'pedido.arquivado',
        summary: `Arquivou pedido ${alvo.numeroPedido} — ${alvo.cliente}`,
        meta: { cardId },
      })
    },
    [board, persist],
  )

  const restoreArchivedCard = useCallback(
    (cardId: string) => {
      if (getAuditActor()?.role !== 'admin') return
      const alvo = board.cards.find((c) => c.id === cardId)
      if (!alvo?.arquivadoEm) return
      persist({
        ...board,
        cards: board.cards.map((c) =>
          c.id === cardId ? { ...c, arquivadoEm: null } : c,
        ),
      })
      recordAudit({
        action: 'pedido.restaurado',
        summary: `Restaurou pedido ${alvo.numeroPedido} — ${alvo.cliente} no kanban`,
        meta: { cardId },
      })
    },
    [board, persist],
  )

  const permanentlyDeleteArchivedCard = useCallback(
    async (cardId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (getAuditActor()?.role !== 'admin') {
        return { ok: false, error: 'Só o administrador pode apagar pedidos arquivados.' }
      }
      const current = boardRef.current
      const alvo = current.cards.find((c) => c.id === cardId)
      if (!alvo?.arquivadoEm) {
        return { ok: false, error: 'Pedido não está arquivado ou já foi removido.' }
      }
      const removeIds = [cardId]
      const next = mergeBoardPreservingPedidos(
        current,
        { ...current, cards: current.cards.filter((c) => c.id !== cardId) },
        removeIds,
      )
      setBoard(next)
      setSync((s) => ({ ...s, status: 'saving' }))
      const result = await saveBoard(next, {
        forceRemote: true,
        permanentlyRemoveArchivedCardIds: removeIds,
      })
      if (result.ok && (!isRemoteSyncEnabled() || result.remote)) {
        recordPedidoExcluidoPermanente(cardId)
        removeCardFromPedidosSnapshot(cardId)
        purgeSnapshotPedidosExcluidos()
        if (isRemoteSyncEnabled()) {
          try {
            const verify = await fetchRemoteBoard()
            if (verify?.cards?.some((c) => c.id === cardId)) {
              setBoard(current)
              const err =
                'O servidor ainda guarda este pedido (restauração automática). Atualize o deploy Node e tente de novo.'
              setSync({ remote: true, status: 'error', message: err })
              return { ok: false, error: err }
            }
          } catch {
            /* rede — confiar no PUT */
          }
        }
        setSync({ remote: result.remote, status: 'saved' })
        recordAudit({
          action: 'pedido.excluido',
          summary: `Apagou definitivamente o pedido arquivado ${alvo.numeroPedido} — ${alvo.cliente}`,
          meta: { cardId, numeroPedido: alvo.numeroPedido },
        })
        return { ok: true }
      }
      try {
        const reloaded = await loadBoard()
        setBoard(
          relinkOrphanVendedorIdsConservative(
            unifyVendedorRowsAndRelinkCards(
              filterBoardRemovendoExcluidos(reloaded.board),
            ),
          ),
        )
      } catch {
        setBoard(current)
      }
      const message =
        (!result.ok && result.error) ||
        'Não foi possível apagar no servidor. Confira se o deploy do Node está atualizado (exclusão de arquivados).'
      setSync({ remote: result.remote, status: 'error', message })
      return { ok: false, error: message }
    },
    [],
  )

  const moveCard = useCallback(
    (cardId: string, columnId: string) => {
      const existing = board.cards.find((c) => c.id === cardId)
      if (!existing || existing.columnId === columnId) return
      if (!vendedorLogadoPodeCard(board, existing)) return

      const fromColumnId = existing.columnId
      const now = new Date().toISOString()
      const updated: OrderCard = {
        ...existing,
        columnId,
        etapaDesde: now,
        historicoEtapa: registrarMudancaEtapa(existing, board, columnId, now),
      }
      const nextBoard = {
        ...board,
        cards: board.cards.map((c) => (c.id === cardId ? updated : c)),
      }
      persist(nextBoard, { immediate: true })
      notificarSePedidoMovido(updated, nextBoard, fromColumnId, columnId)
      recordAudit({
        action: 'pedido.movido',
        summary: `Pedido ${existing.numeroPedido}: ${tituloColuna(board, fromColumnId)} → ${tituloColuna(board, columnId)}`,
        meta: { cardId, fromColumnId, columnId },
      })
    },
    [board, persist],
  )

  const restoreRicherLocalToServer = useCallback(() => {
    if (!localRestore?.cards.length) return
    const merged = normalizeBoard({
      ...localRestore,
      vendedores: localRestore.vendedores.length
        ? localRestore.vendedores
        : board.vendedores,
    })
    setLocalRestore(null)
    persist(merged, { forceRemote: true })
    recordAudit({
      action: 'quadro.restaurado',
      summary: `Restaurou ${merged.cards.length} pedido(s) do navegador para o servidor`,
    })
  }, [localRestore, board.vendedores, persist])

  const restoreFromPedidosSnapshot = useCallback(async (): Promise<SaveBoardResult | { ok: false; error: string }> => {
    const snapRaw = loadBoardPedidosSnapshot()
    if (!snapRaw) return { ok: false, error: 'Nenhum backup no navegador.' }
    const snap = normalizeBoard(snapRaw)
    if (contagemPedidos(snap) === 0) return { ok: false, error: 'Backup vazio.' }
    const merged = mergeBoardPreservingPedidos(boardRef.current, snap)
    setLocalRestore(null)
    setBoard(merged)
    setSync((s) => ({ ...s, status: 'saving' }))
    const result = await saveBoard(merged, { forceRemote: true })
    if (result.ok && (!isRemoteSyncEnabled() || result.remote)) {
      setSync({ remote: result.remote, status: 'saved' })
      recordAudit({
        action: 'quadro.restaurado',
        summary: `Restaurou pedidos do backup do navegador para o servidor (${merged.cards.length} no quadro)`,
      })
    } else {
      setSync({ remote: result.remote, status: 'error', message: !result.ok ? result.error : undefined })
    }
    return result
  }, [])

  const dismissLocalRestore = useCallback(() => setLocalRestore(null), [])

  const syncPendingPedidosToServer = useCallback(async (): Promise<SaveBoardResult> => {
    const current = boardRef.current
    setSync((s) => ({ ...s, status: 'saving' }))
    try {
      const loaded = await loadBoard()
      const merged = mergeBoardLoggedInFromServer(loaded.board, current)
      const unified = relinkOrphanVendedorIdsConservative(
        unifyVendedorRowsAndRelinkCards(merged),
      )
      setBoard(unified)
      if (!boardTemPedidosAlemDoServidor(unified, loaded.board)) {
        setLocalRestore(null)
        setSync({ remote: isRemoteSyncEnabled(), status: 'saved' })
        return { ok: true, remote: isRemoteSyncEnabled() }
      }
      const result = await saveBoard(unified, { forceRemote: true })
      if (result.ok && (!isRemoteSyncEnabled() || result.remote)) {
        setLocalRestore(null)
        setSync({ remote: result.remote, status: 'saved' })
        recordAudit({
          action: 'quadro.restaurado',
          summary: `Sincronizou ${contagemPedidos(unified) - contagemPedidos(loaded.board)} pedido(s) pendente(s) no servidor`,
        })
      } else {
        setLocalRestore(unified)
        setSync({
          remote: result.remote,
          status: 'error',
          message:
            (!result.ok && result.error) ||
            'Pedido(s) ainda não gravados no servidor — tente de novo.',
        })
      }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao sincronizar com o servidor'
      setSync({ remote: isRemoteSyncEnabled(), status: 'error', message })
      return { ok: false, error: message, remote: isRemoteSyncEnabled() }
    }
  }, [])

  const refreshBoardFromServer = useCallback(async () => {
    try {
      const result = await loadBoard()
      const merged = mergeBoardLoggedInFromServer(result.board, boardRef.current)
      const unified = relinkOrphanVendedorIdsConservative(
        unifyVendedorRowsAndRelinkCards(merged),
      )
      boardRef.current = unified
      setBoard(unified)
      if (result.richerLocal) setLocalRestore(result.richerLocal)
      if (contagemPedidos(unified) > contagemPedidos(result.board)) {
        void saveBoard(unified, { immediate: true })
      }
    } catch {
      /* mantém quadro atual */
    }
  }, [])

  return {
    board,
    ready,
    sync,
    localRestore,
    restoreRicherLocalToServer,
    restoreFromPedidosSnapshot,
    dismissLocalRestore,
    syncPendingPedidosToServer,
    refreshBoardFromServer,
    pedidosSnapshotCount: contagemPedidosNoSnapshot(),
    addColumn,
    removeColumn,
    addVendedor,
    updateVendedorContato,
    removeVendedor,
    upsertVendedorFromManagedUser,
    upsertVendedorFromSession,
    removeVendedorForManagedUser,
    syncVendedoresFromManagedUsers,
    addSegmento,
    addCard,
    updateCard,
    addPedidoComentario,
    archiveCard,
    restoreArchivedCard,
    permanentlyDeleteArchivedCard,
    moveCard,
  }
}
