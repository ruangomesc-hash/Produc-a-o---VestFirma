import { DEFAULT_BOARD } from './defaultBoard'
import { normalizarLogoLocal } from './logoLocal'
import { garantirHistoricoCard } from './historicoEtapa'
import { encontrarOuCriarSegmento, mesclarSegmentos } from './segmentosEmpresa'
import {
  fetchRemoteBoard,
  isRemoteSyncEnabled,
  saveRemoteBoard,
  type SaveBoardResult,
} from './remoteBoard'
import { requiresLogin, getSessionToken } from './authSession'
import { blockLocalFallbackWhenProtected, initRuntimeConfig } from './runtimeConfig'
import { mergeBoardPreservingPedidos, contagemPedidos, mergeBoardsMaxPedidos, mergeBoardAddingMissingPedidosOnly, mergeBoardRemotePrimary } from './pedidosPolicy'
import { loadBoardPedidosSnapshot, snapshotBoardPedidos } from './boardPedidosSnapshot'
import { unifyVendedorRowsAndRelinkCards } from './vendedorUserSync'
import type { BoardState, OrderCard, SegmentoEmpresa } from './types'

export type { SaveBoardResult } from './remoteBoard'

const DB_NAME = 'vestfirma-kanban'
const DB_VERSION = 1
const STORE = 'board'
const KEY = 'state'

/** Cópia guardada ao entrar no antigo modo demo — usada só na migração. */
const LEGACY_PRE_DEMO_SESSION = 'vestfirma-pre-demo-board'
const LEGACY_PRE_DEMO_LS = 'vestfirma-pre-demo-board-ls'
const LEGACY_DEMO_IDB_KEY = 'state-demo'

type LegacyCard = Omit<OrderCard, 'historicoEtapa' | 'comentarios'> & {
  historicoEtapa?: OrderCard['historicoEtapa']
  comentarios?: OrderCard['comentarios']
  vendedor?: string
  segmento?: string
  logoDataUrl?: string | null
}

type LegacyBoardRaw = BoardState & { demo?: boolean }

function normalizeCard(
  raw: LegacyCard,
  vendedores: BoardState['vendedores'],
  segmentos: SegmentoEmpresa[],
): OrderCard {
  let vendedorId = raw.vendedorId ?? null
  if (raw.vendedorId === undefined && raw.vendedor?.trim()) {
    const texto = raw.vendedor.trim()
    const found = vendedores.find((v) => v.nome.toLowerCase() === texto.toLowerCase())
    if (found) {
      vendedorId = found.id
    } else {
      const novoId = crypto.randomUUID()
      vendedores.push({ id: novoId, nome: texto })
      vendedorId = novoId
    }
  }

  let segmentoId = raw.segmentoId ?? null
  if (!segmentoId && raw.segmento?.trim()) {
    const id = encontrarOuCriarSegmento(segmentos, raw.segmento)
    segmentoId = id || null
  }
  if (segmentoId && !segmentos.some((s) => s.id === segmentoId)) {
    segmentos.push({ id: segmentoId, nome: 'Segmento personalizado' })
  }

  const logoEnviadaCliente =
    raw.logoEnviadaCliente ?? raw.logoDataUrl ?? null
  const logoProntaImpressao = raw.logoProntaImpressao ?? null

  return {
    id: raw.id,
    columnId: raw.columnId,
    cliente: raw.cliente,
    whatsappCliente: raw.whatsappCliente ?? '',
    vendedorId,
    segmentoId,
    quantidade: raw.quantidade,
    numeroPedido: raw.numeroPedido,
    canal: raw.canal,
    endereco: raw.endereco,
    dataPedido: raw.dataPedido,
    dataPagamento: raw.dataPagamento,
    logoEnviadaCliente,
    logoProntaImpressao,
    localLogo: normalizarLogoLocal(raw.localLogo),
    etapaDesde: raw.etapaDesde ?? raw.createdAt ?? new Date().toISOString(),
    createdAt: raw.createdAt ?? raw.etapaDesde ?? new Date().toISOString(),
    historicoEtapa: raw.historicoEtapa ?? [],
    comentarios: Array.isArray(raw.comentarios) ? raw.comentarios : [],
    arquivadoEm: raw.arquivadoEm ?? null,
  }
}

export function normalizeBoard(raw: BoardState | LegacyBoardRaw | undefined | null): BoardState {
  if (!raw?.columns?.length) return structuredClone(DEFAULT_BOARD)

  const vendedores = [...(raw.vendedores ?? [])].map((v) => ({
    id: v.id,
    nome: v.nome,
    userId: v.userId || undefined,
    email: v.email?.trim() || undefined,
    whatsapp: v.whatsapp?.trim() || undefined,
    grupoWhatsapp: v.grupoWhatsapp?.trim() || undefined,
    managedRole: v.managedRole,
  }))
  const segmentos = mesclarSegmentos(raw.segmentos)
  let cards = (raw.cards ?? []).map((card) =>
    normalizeCard(card as LegacyCard, vendedores, segmentos),
  )

  const base: BoardState = {
    columns: raw.columns,
    cards,
    vendedores,
    segmentos,
  }

  cards = cards.map((c) => garantirHistoricoCard(c, base))

  return unifyVendedorRowsAndRelinkCards({ ...base, cards })
}

function boardHasPedidos(state: BoardState): boolean {
  return contagemPedidos(state) > 0
}

function readLegacyPreDemoBoard(): BoardState | null {
  try {
    const raw =
      sessionStorage.getItem(LEGACY_PRE_DEMO_SESSION) ??
      localStorage.getItem(LEGACY_PRE_DEMO_LS)
    if (!raw) return null
    const parsed = normalizeBoard(JSON.parse(raw) as LegacyBoardRaw)
    return boardHasPedidos(parsed) ? parsed : null
  } catch {
    return null
  }
}

function clearLegacyDemoClientStorage(): void {
  try {
    sessionStorage.removeItem(LEGACY_PRE_DEMO_SESSION)
    localStorage.removeItem(LEGACY_PRE_DEMO_LS)
  } catch {
    /* ignore */
  }
}

/** IndexedDB com flag demo antiga — ignorar e tentar restaurar quadro real. */
async function resolveLocalBoardFromIdb(): Promise<BoardState | null> {
  const localRaw = await loadBoardFromIdb(KEY)
  if (!localRaw) return null
  const legacy = localRaw as LegacyBoardRaw
  if (!legacy.demo) {
    return normalizeBoard(localRaw)
  }
  const rescued = readLegacyPreDemoBoard()
  clearLegacyDemoClientStorage()
  void deleteIdbKey(LEGACY_DEMO_IDB_KEY)
  if (rescued) return rescued
  return null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
  })
}

async function loadBoardFromIdb(storeKey: string = KEY): Promise<BoardState | null> {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const request = store.get(storeKey)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const value = request.result as BoardState | undefined
        resolve(value ?? null)
      }
    })
  } catch {
    return null
  }
}

async function deleteIdbKey(storeKey: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const request = store.delete(storeKey)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } catch {
    /* ignore */
  }
}

async function saveBoardToIdb(state: BoardState, storeKey: string = KEY): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const request = store.put(state, storeKey)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export type SaveBoardOptions = {
  /** Restauração manual — servidor exige header force. */
  forceRemote?: boolean
  /** Não gravar no servidor (uso interno raro). */
  skipRemote?: boolean
  /** Grava imediatamente (ex.: novo pedido). */
  immediate?: boolean
  /** Apagar pedidos arquivados do JSON (admin; servidor valida). */
  permanentlyRemoveArchivedCardIds?: string[]
}

export type LoadBoardResult = {
  board: BoardState
  /** Pedidos só neste navegador — servidor tem menos (ex.: após bug de sync). */
  richerLocal?: BoardState
}

export type LoadBoardOptions = {
  signal?: AbortSignal
}

export async function loadBoardFromBrowserCache(): Promise<BoardState | null> {
  const local = await resolveLocalBoardFromIdb()
  return local
}

export async function loadBoard(options?: LoadBoardOptions): Promise<LoadBoardResult> {
  await initRuntimeConfig()
  const local = await resolveLocalBoardFromIdb()

  if (!isRemoteSyncEnabled()) {
    const board = local ?? structuredClone(DEFAULT_BOARD)
    return { board }
  }

  const protectedServer =
    blockLocalFallbackWhenProtected() || (requiresLogin() && !getSessionToken())

  try {
    const remoteRaw = await fetchRemoteBoard({ signal: options?.signal })
    if (remoteRaw) {
      const remote = normalizeBoard(remoteRaw)
      const snapshotRaw = loadBoardPedidosSnapshot()
      const snapshot = snapshotRaw ? normalizeBoard(snapshotRaw) : null
      const loggedIn = requiresLogin() && Boolean(getSessionToken())
      const remoteCount = contagemPedidos(remote)

      let board: BoardState
      let richerLocal: BoardState | undefined

      if (loggedIn && remoteCount > 0) {
        board = mergeBoardRemotePrimary(remote, local)
      } else if (loggedIn && remoteCount === 0) {
        board =
          mergeBoardsMaxPedidos(snapshot, local, remote) ??
          mergeBoardPreservingPedidos(remote, local ?? remote)
        if (snapshot && boardHasPedidos(snapshot)) {
          board = mergeBoardAddingMissingPedidosOnly(board, snapshot)
        }
        if (contagemPedidos(board) > 0) richerLocal = board
      } else {
        board =
          mergeBoardsMaxPedidos(snapshot, remote, local) ??
          mergeBoardsMaxPedidos(remote, local, snapshot) ??
          (local ? mergeBoardPreservingPedidos(remote, local) : remote)

        if (!boardHasPedidos(board) && snapshot && boardHasPedidos(snapshot)) {
          board = mergeBoardAddingMissingPedidosOnly(board, snapshot)
        }
      }

      const mergedCount = contagemPedidos(board)

      if (!loggedIn && mergedCount > remoteCount) {
        richerLocal = board
      }

      await saveBoardToIdb(board)
      snapshotBoardPedidos(board)

      if (richerLocal && !protectedServer && !loggedIn && boardHasPedidos(board)) {
        try {
          await saveRemoteBoard(board)
          richerLocal = undefined
        } catch {
          /* banner / nova tentativa depois */
        }
      }
      return { board, richerLocal }
    }

    if (local && boardHasPedidos(local)) {
      if (protectedServer) {
        throw new Error('Login necessário para acessar o quadro')
      }
      await saveRemoteBoard(local)
      return { board: local }
    }

    const board = local ?? structuredClone(DEFAULT_BOARD)
    return { board }
  } catch (err) {
    if (protectedServer) {
      console.warn('VestFirma: servidor protegido — não usar cópia local sem login.', err)
      throw err
    }
    console.warn('VestFirma: falha ao carregar do servidor, usando cópia local.', err)
    let board = local ?? structuredClone(DEFAULT_BOARD)
    const snapshotRaw = loadBoardPedidosSnapshot()
    const snapshot = snapshotRaw ? normalizeBoard(snapshotRaw) : null
    if (snapshot && boardHasPedidos(snapshot)) {
      board = mergeBoardAddingMissingPedidosOnly(board, snapshot)
    }
    return { board }
  }
}

export async function saveBoard(
  state: BoardState,
  options?: SaveBoardOptions,
): Promise<SaveBoardResult> {
  let normalized = normalizeBoard(state)
  const removeIds = options?.permanentlyRemoveArchivedCardIds?.filter(Boolean) ?? []

  const idbRaw = await loadBoardFromIdb()
  const idb = idbRaw ? normalizeBoard(idbRaw as LegacyBoardRaw) : null
  const idbLegacy = idbRaw as LegacyBoardRaw | null
  const idbUsable = idb && !idbLegacy?.demo ? idb : null

  if (idbUsable) {
    normalized = mergeBoardPreservingPedidos(idbUsable, normalized, removeIds)
  }

  if (isRemoteSyncEnabled() && !options?.skipRemote && !options?.forceRemote) {
    try {
      const remoteRaw = await fetchRemoteBoard()
      if (remoteRaw) {
        const remote = normalizeBoard(remoteRaw)
        normalized = mergeBoardPreservingPedidos(remote, normalized, removeIds)
      }
    } catch {
      /* servidor também faz merge */
    }
  }

  if (
    !options?.forceRemote &&
    idbUsable &&
    boardHasPedidos(idbUsable) &&
    !boardHasPedidos(normalized)
  ) {
    normalized = mergeBoardPreservingPedidos(normalized, idbUsable, removeIds)
  }

  try {
    await saveBoardToIdb(normalized)
    snapshotBoardPedidos(normalized)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao salvar no navegador'
    return { ok: false, error: message, remote: isRemoteSyncEnabled() }
  }

  if (!isRemoteSyncEnabled() || options?.skipRemote) {
    return { ok: true, remote: false }
  }

  if (!options?.forceRemote && !boardHasPedidos(normalized)) {
    return {
      ok: false,
      error: 'Recusado: não enviar quadro vazio ao servidor (proteção de pedidos).',
      remote: true,
    }
  }

  try {
    await saveRemoteBoard(normalized, {
      force: options?.forceRemote,
      permanentlyRemoveArchivedCardIds: removeIds.length ? removeIds : undefined,
    })
    return { ok: true, remote: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao salvar no servidor'
    return { ok: false, error: message, remote: true }
  }
}
