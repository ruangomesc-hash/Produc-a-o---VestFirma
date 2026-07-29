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
import { mergeBoardPreservingPedidos, contagemPedidos } from './pedidosPolicy'
import type { BoardState, OrderCard, SegmentoEmpresa } from './types'

export type { SaveBoardResult } from './remoteBoard'

const DB_NAME = 'vestfirma-kanban'
const DB_VERSION = 1
const STORE = 'board'
const KEY = 'state'

type LegacyCard = Omit<OrderCard, 'historicoEtapa' | 'comentarios'> & {
  historicoEtapa?: OrderCard['historicoEtapa']
  comentarios?: OrderCard['comentarios']
  vendedor?: string
  segmento?: string
  logoDataUrl?: string | null
}

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

export function normalizeBoard(raw: BoardState | undefined | null): BoardState {
  if (!raw?.columns?.length) return structuredClone(DEFAULT_BOARD)

  const vendedores = [...(raw.vendedores ?? [])].map((v) => ({
    id: v.id,
    nome: v.nome,
    userId: v.userId || undefined,
    email: v.email?.trim() || undefined,
    whatsapp: v.whatsapp?.trim() || undefined,
    grupoWhatsapp: v.grupoWhatsapp?.trim() || undefined,
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
    demo: raw.demo ?? false,
  }

  cards = cards.map((c) => garantirHistoricoCard(c, base))

  return { ...base, cards }
}

function boardHasPedidos(state: BoardState): boolean {
  return contagemPedidos(state) > 0
}

function localUsavelParaProducao(local: BoardState | null): BoardState | null {
  if (!local?.columns?.length) return null
  if (local.demo) return null
  return local
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

async function loadBoardFromIdb(): Promise<BoardState | null> {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const request = store.get(KEY)
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

async function saveBoardToIdb(state: BoardState): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const request = store.put(state, KEY)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export type SaveBoardOptions = {
  /** Restauração manual — servidor exige header force. */
  forceRemote?: boolean
  /** Não gravar no servidor (ex.: modo demo). */
  skipRemote?: boolean
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
  const localRaw = await loadBoardFromIdb()
  return localRaw ? normalizeBoard(localRaw) : null
}

export async function loadBoard(options?: LoadBoardOptions): Promise<LoadBoardResult> {
  await initRuntimeConfig()
  const localRaw = await loadBoardFromIdb()
  const local = localRaw ? normalizeBoard(localRaw) : null

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
      const localProd = localUsavelParaProducao(local)
      const board = localProd
        ? mergeBoardPreservingPedidos(remote, localProd)
        : remote
      await saveBoardToIdb(board)
      const richerLocal =
        contagemPedidos(board) > contagemPedidos(remote) ? board : undefined
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
    const board = local ?? structuredClone(DEFAULT_BOARD)
    return { board }
  }
}

export async function saveBoard(
  state: BoardState,
  options?: SaveBoardOptions,
): Promise<SaveBoardResult> {
  let normalized = normalizeBoard(state)

  if (normalized.demo && !options?.skipRemote && !options?.forceRemote) {
    options = { ...options, skipRemote: true }
  }

  const idbRaw = await loadBoardFromIdb()
  const idb = idbRaw ? normalizeBoard(idbRaw) : null
  const idbProd = localUsavelParaProducao(idb)

  if (normalized.demo) {
    if (options?.skipRemote) {
      try {
        await saveBoardToIdb(normalized)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao salvar no navegador'
        return { ok: false, error: message, remote: isRemoteSyncEnabled() }
      }
      return { ok: true, remote: false }
    }
  } else if (idbProd) {
    normalized = mergeBoardPreservingPedidos(idbProd, normalized)
  }

  if (isRemoteSyncEnabled() && !options?.skipRemote && !options?.forceRemote) {
    try {
      const remoteRaw = await fetchRemoteBoard()
      if (remoteRaw) {
        const remote = normalizeBoard(remoteRaw)
        normalized = mergeBoardPreservingPedidos(remote, normalized)
      }
    } catch {
      /* servidor também faz merge */
    }
  }

  if (
    !normalized.demo &&
    !options?.forceRemote &&
    idbProd &&
    boardHasPedidos(idbProd) &&
    !boardHasPedidos(normalized)
  ) {
    normalized = mergeBoardPreservingPedidos(normalized, idbProd)
  }

  try {
    await saveBoardToIdb(normalized)
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
    await saveRemoteBoard(normalized, { force: options?.forceRemote })
    return { ok: true, remote: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao salvar no servidor'
    return { ok: false, error: message, remote: true }
  }
}
