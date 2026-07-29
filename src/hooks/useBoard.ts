import { useCallback, useEffect, useRef, useState } from 'react'
import { createDemoBoard } from '../demoBoard'
import { DEFAULT_BOARD } from '../defaultBoard'
import { registrarCriacaoPedido, registrarMudancaEtapa } from '../historicoEtapa'
import { isRemoteSyncEnabled } from '../remoteBoard'
import { notificarSePedidoCriado, notificarSePedidoMovido } from '../whatsappNotify'
import { mesclarSegmentos } from '../segmentosEmpresa'
import { notifyUnauthorized } from '../authSession'
import { loadBoard, normalizeBoard, saveBoard } from '../storage'
import type { BoardState, CardFormData, OrderCard } from '../types'
import type { ManagedUser } from '../userRoles'
import {
  findVendedorForManagedUser,
  managedUserToVendedor,
  mergeVendedoresFromManagedUsers,
} from '../vendedorUserSync'

export type BoardSyncState = {
  remote: boolean
  status: 'idle' | 'saving' | 'saved' | 'error'
  message?: string
}

function newId() {
  return crypto.randomUUID()
}

const PRE_DEMO_STORAGE_KEY = 'vestfirma-pre-demo-board'

function savePreDemoBoard(state: BoardState) {
  try {
    sessionStorage.setItem(PRE_DEMO_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota or private mode */
  }
}

function readPreDemoBoard(): BoardState | null {
  try {
    const raw = sessionStorage.getItem(PRE_DEMO_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as BoardState
  } catch {
    return null
  }
}

function clearPreDemoBoard() {
  try {
    sessionStorage.removeItem(PRE_DEMO_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function useBoard() {
  const [board, setBoard] = useState<BoardState>(DEFAULT_BOARD)
  const [ready, setReady] = useState(false)
  const [sync, setSync] = useState<BoardSyncState>(() => ({
    remote: isRemoteSyncEnabled(),
    status: 'idle',
  }))
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const fallback = setTimeout(() => {
      if (!cancelled) setReady(true)
    }, 2500)

    loadBoard()
      .then((data) => {
        if (!cancelled) {
          setBoard(data)
          setSync({
            remote: isRemoteSyncEnabled(),
            status: 'saved',
          })
        }
      })
      .catch(() => {
        if (!cancelled) notifyUnauthorized()
      })
      .finally(() => {
        if (!cancelled) {
          clearTimeout(fallback)
          setReady(true)
        }
      })

    return () => {
      cancelled = true
      clearTimeout(fallback)
    }
  }, [])

  const persist = useCallback((next: BoardState) => {
    setBoard(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setSync((s) => ({ ...s, status: 'saving' }))
      void saveBoard(next).then((result) => {
        if (result.ok) {
          setSync({ remote: result.remote, status: 'saved' })
        } else {
          setSync({
            remote: result.remote,
            status: 'error',
            message: result.error,
          })
        }
      })
    }, 400)
  }, [])

  const addColumn = useCallback(
    (title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      persist({
        ...board,
        columns: [...board.columns, { id: newId(), title: trimmed }],
      })
    },
    [board, persist],
  )

  const removeColumn = useCallback(
    (columnId: string, deleteCards: boolean) => {
      if (board.columns.length <= 1) return
      const rest = board.columns.filter((c) => c.id !== columnId)
      let cards = board.cards
      if (deleteCards) {
        cards = cards.filter((c) => c.columnId !== columnId)
      } else {
        const fallback = rest[0]?.id
        if (!fallback) return
        cards = cards.map((c) => {
          if (c.columnId !== columnId) return c
          const now = new Date().toISOString()
          return {
            ...c,
            columnId: fallback,
            etapaDesde: now,
            historicoEtapa: registrarMudancaEtapa(c, board, fallback, now),
          }
        })
      }
      persist({ ...board, columns: rest, cards })
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
    (user: ManagedUser) => {
      if (user.role !== 'vendedor') return
      const existing = findVendedorForManagedUser(board, user)
      const next = managedUserToVendedor(user, existing)
      if (existing) {
        persist({
          ...board,
          vendedores: board.vendedores.map((v) => (v.id === existing.id ? next : v)),
        })
        return
      }
      const nomeTaken = board.vendedores.some(
        (v) => v.nome.trim().toLowerCase() === next.nome.trim().toLowerCase(),
      )
      if (nomeTaken) return
      persist({
        ...board,
        vendedores: [...board.vendedores, next],
      })
    },
    [board, persist],
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
      const merged = mergeVendedoresFromManagedUsers(board, users)
      if (merged.vendedores !== board.vendedores) persist(merged)
    },
    [board, persist],
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
      const now = new Date().toISOString()
      const card: OrderCard = {
        ...data,
        id: newId(),
        columnId,
        etapaDesde: now,
        createdAt: now,
        historicoEtapa: registrarCriacaoPedido(board, columnId, now),
      }
      persist({ ...board, cards: [...board.cards, card] })
      notificarSePedidoCriado(card, { ...board, cards: [...board.cards, card] })
    },
    [board, persist],
  )

  const updateCard = useCallback(
    (cardId: string, data: CardFormData) => {
      persist({
        ...board,
        cards: board.cards.map((c) =>
          c.id === cardId ? { ...c, ...data } : c,
        ),
      })
    },
    [board, persist],
  )

  const deleteCard = useCallback(
    (cardId: string) => {
      persist({
        ...board,
        cards: board.cards.filter((c) => c.id !== cardId),
      })
    },
    [board, persist],
  )

  const moveCard = useCallback(
    (cardId: string, columnId: string) => {
      const existing = board.cards.find((c) => c.id === cardId)
      if (!existing || existing.columnId === columnId) return

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
      persist(nextBoard)
      notificarSePedidoMovido(updated, nextBoard, fromColumnId, columnId)
    },
    [board, persist],
  )

  const loadDemo = useCallback(() => {
    if (!board.demo) {
      savePreDemoBoard(board)
    }
    persist(createDemoBoard())
  }, [board, persist])

  const exitDemo = useCallback(() => {
    const saved = readPreDemoBoard()
    clearPreDemoBoard()
    if (saved) {
      persist(normalizeBoard({ ...saved, demo: false }))
      return
    }
    persist(structuredClone(DEFAULT_BOARD))
  }, [persist])

  return {
    board,
    ready,
    sync,
    addColumn,
    removeColumn,
    addVendedor,
    updateVendedorContato,
    removeVendedor,
    upsertVendedorFromManagedUser,
    removeVendedorForManagedUser,
    syncVendedoresFromManagedUsers,
    addSegmento,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    loadDemo,
    exitDemo,
  }
}
