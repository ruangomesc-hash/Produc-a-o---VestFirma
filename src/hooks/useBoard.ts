import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_BOARD } from '../defaultBoard'
import { criarComentarioPedido, autorComentarioFromSession, type ComentarioAutor } from '../pedidoComentarios'
import { registrarCriacaoPedido, registrarMudancaEtapa, tituloColuna } from '../historicoEtapa'
import { isRemoteSyncEnabled } from '../remoteBoard'
import { notificarSePedidoCriado, notificarSePedidoMovido } from '../whatsappNotify'
import { mesclarSegmentos } from '../segmentosEmpresa'
import { isAuthSessionError, requestAuthFailureLogout } from '../authSession'
import { getAuditActor } from '../auditContext'
import { recordAudit } from '../auditLog'
import { loadBoard, normalizeBoard, saveBoard } from '../storage'
import { mergeBoardPreservingPedidos, contagemPedidos } from '../pedidosPolicy'
import {
  snapshotBoardPedidos,
  loadBoardPedidosSnapshot,
  contagemPedidosNoSnapshot,
} from '../boardPedidosSnapshot'
import type { BoardState, CardFormData, OrderCard } from '../types'
import type { ManagedUser, SessionProfile } from '../userRoles'
import { canPlaceOrders } from '../userRoles'
import {
  findVendedorForManagedUser,
  findVendedorIdForSession,
  managedUserToVendedor,
  managedUserFromSession,
  mergeVendedoresFromManagedUsers,
  vendedorPodeAcessarPedido,
  type VendedorContatoPatch,
} from '../vendedorUserSync'

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
  const vendedorId = findVendedorIdForSession(board, actor)
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
      .then((result) => {
        if (!cancelled) {
          let board = result.board
          let richer = result.richerLocal ?? null

          if (contagemPedidos(board) === 0) {
            const snapRaw = loadBoardPedidosSnapshot()
            const snap = snapRaw ? normalizeBoard(snapRaw) : null
            if (snap && contagemPedidos(snap) > 0) {
              board = mergeBoardPreservingPedidos(board, snap)
              richer = board
              void saveBoard(board)
            }
          }

          setBoard(board)
          setLocalRestore(richer)
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
      opts?: { forceRemote?: boolean; skipRemote?: boolean; immediate?: boolean },
    ) => {
      setBoard((prev) => {
        const safe = mergeBoardPreservingPedidos(prev, next)
        const delay = opts?.immediate ? 0 : 400
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
          setSync((s) => ({ ...s, status: 'saving' }))
          void saveBoard(safe, {
            forceRemote: opts?.forceRemote,
            skipRemote: opts?.skipRemote,
          }).then((result) => {
            if (result.ok) {
              snapshotBoardPedidos(safe)
              setSync({ remote: result.remote, status: 'saved' })
            } else {
              setSync({
                remote: result.remote,
                status: 'error',
                message: result.error,
              })
            }
          })
        }, delay)
        return safe
      })
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
      const linked = board.vendedores.find((v) => v.userId === userId)
      if (linked) removeVendedor(linked.id)
    },
    [board, removeVendedor, board.vendedores],
  )

  const syncVendedoresFromManagedUsers = useCallback(
    (users: ManagedUser[]) => {
      const current = boardRef.current
      const merged = mergeVendedoresFromManagedUsers(current, users)
      const same =
        merged.vendedores.length === current.vendedores.length &&
        merged.vendedores.every((v) => {
          const c = current.vendedores.find((x) => x.id === v.id)
          return (
            c &&
            c.nome === v.nome &&
            c.userId === v.userId &&
            (c.email ?? '') === (v.email ?? '')
          )
        })
      if (!same) persist(merged, { immediate: true })
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
    (columnId: string, data: CardFormData) => {
      const payload = cardFormDataParaVendedorLogado(board, data)
      const now = new Date().toISOString()
      const card: OrderCard = {
        ...payload,
        id: newId(),
        columnId,
        etapaDesde: now,
        createdAt: now,
        historicoEtapa: registrarCriacaoPedido(board, columnId, now),
        comentarios: [],
      }
      persist({ ...board, cards: [...board.cards, card] }, { immediate: true })
      notificarSePedidoCriado(card, { ...board, cards: [...board.cards, card] })
      recordAudit({
        action: 'pedido.criado',
        summary: `Novo pedido ${card.numeroPedido} — ${card.cliente}`,
        meta: { cardId: card.id, columnId },
      })
    },
    [board, persist],
  )

  const updateCard = useCallback(
    (cardId: string, data: CardFormData) => {
      const prev = board.cards.find((c) => c.id === cardId)
      if (!vendedorLogadoPodeCard(board, prev)) return
      const payload = cardFormDataParaVendedorLogado(board, data)
      persist({
        ...board,
        cards: board.cards.map((c) =>
          c.id === cardId ? { ...c, ...payload } : c,
        ),
      })
      recordAudit({
        action: 'pedido.editado',
        summary: `Editou pedido ${payload.numeroPedido || prev?.numeroPedido} — ${payload.cliente || prev?.cliente}`,
        meta: { cardId },
      })
    },
    [board, persist],
  )

  const addPedidoComentario = useCallback(
    (cardId: string, texto: string, autor: ComentarioAutor) => {
      const trimmed = texto.trim()
      if (!trimmed) return
      const alvo = board.cards.find((c) => c.id === cardId)
      if (!vendedorLogadoPodeCard(board, alvo)) return
      const actor = getAuditActor()
      const autorEfetivo = autorComentarioFromSession(actor, autor)
      const entry = criarComentarioPedido(trimmed, autorEfetivo)
      persist({
        ...board,
        cards: board.cards.map((c) =>
          c.id === cardId
            ? { ...c, comentarios: [...(c.comentarios ?? []), entry] }
            : c,
        ),
      })
      const card = board.cards.find((c) => c.id === cardId)
      recordAudit({
        action: 'pedido.comentario',
        summary: `${autorEfetivo.nome} comentou no pedido ${card?.numeroPedido ?? cardId}`,
        detail: trimmed.slice(0, 500),
        meta: { cardId },
      })
    },
    [board, persist],
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

  const restoreFromPedidosSnapshot = useCallback(() => {
    const snapRaw = loadBoardPedidosSnapshot()
    if (!snapRaw) return
    const snap = normalizeBoard(snapRaw)
    if (contagemPedidos(snap) === 0) return
    const merged = mergeBoardPreservingPedidos(boardRef.current, snap)
    setLocalRestore(null)
    persist(merged, { forceRemote: true })
    recordAudit({
      action: 'quadro.restaurado',
      summary: `Restaurou ${merged.cards.length} pedido(s) do backup do navegador`,
    })
  }, [persist])

  const dismissLocalRestore = useCallback(() => setLocalRestore(null), [])

  return {
    board,
    ready,
    sync,
    localRestore,
    restoreRicherLocalToServer,
    restoreFromPedidosSnapshot,
    dismissLocalRestore,
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
    moveCard,
  }
}
