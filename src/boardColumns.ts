import { COLUNA_PEDIDO_FEITO_ID, DEFAULT_BOARD } from './defaultBoard'
import type { BoardState, Column, OrderCard } from './types'

/** Etapa final — pedido já saiu; não deve voltar sozinho para o início. */
export const COLUNA_PEDIDO_ENVIADO_ID = 'pedido-enviado'

/** Etapas avançadas protegidas contra “regressão” acidental no merge/sync. */
export const COLUNAS_ETAPA_AVANCADA = new Set([
  'liberado-logistica',
  COLUNA_PEDIDO_ENVIADO_ID,
])

const DEFAULT_COLUMN_IDS = new Set(DEFAULT_BOARD.columns.map((c) => c.id))

/** Garante colunas padrão do fluxo (inclui Pedido enviado) sem remover personalizações. */
export function ensureBoardColumns(columns: Column[] | undefined | null): Column[] {
  const list = [...(columns ?? [])]
  const byId = new Map(list.map((c) => [c.id, c]))

  for (const def of DEFAULT_BOARD.columns) {
    if (!byId.has(def.id)) {
      list.push({ ...def })
      byId.set(def.id, def)
    }
  }

  return posicionarPedidoFeitoAntesDeLogos(list)
}

/** Etapa nova entra no fluxo, sempre antes de Pedido enviado. */
export function inserirColunaAntesDePedidoEnviado(columns: Column[], nova: Column): Column[] {
  const list = [...columns]
  const idx = list.findIndex((c) => c.id === COLUNA_PEDIDO_ENVIADO_ID)
  if (idx < 0) {
    list.push(nova)
    return list
  }
  list.splice(idx, 0, nova)
  return list
}

function posicionarPedidoFeitoAntesDeLogos(columns: Column[]): Column[] {
  const list = [...columns]
  const feitoIdx = list.findIndex((c) => c.id === COLUNA_PEDIDO_FEITO_ID)
  if (feitoIdx < 0) return list
  const [feito] = list.splice(feitoIdx, 1)
  const logosIdx = list.findIndex((c) => c.id === 'logos-recebidas')
  list.splice(logosIdx < 0 ? 0 : logosIdx, 0, feito)
  return list
}

export function indiceColuna(board: Pick<BoardState, 'columns'>, columnId: string): number {
  return board.columns.findIndex((c) => c.id === columnId)
}

export function colunaExiste(board: Pick<BoardState, 'columns'>, columnId: string): boolean {
  return indiceColuna(board, columnId) >= 0
}

/** Evita exibir pedido avançado na primeira coluna quando a etapa sumiu do quadro. */
export function resolveCardColumnId(board: BoardState, card: OrderCard): string {
  if (colunaExiste(board, card.columnId)) return card.columnId

  const historico = card.historicoEtapa ?? []
  for (let i = historico.length - 1; i >= 0; i--) {
    const entry = historico[i]
    if (entry?.columnId && colunaExiste(board, entry.columnId)) {
      return entry.columnId
    }
  }

  for (const id of [COLUNA_PEDIDO_ENVIADO_ID, 'liberado-logistica']) {
    if (colunaExiste(board, id)) return id
  }

  const ultima = board.columns.at(-1)?.id
  if (ultima) return ultima
  return board.columns[0]?.id ?? card.columnId
}

function ultimaMudancaEtapaMs(card: OrderCard, columnId: string): number {
  let max = 0
  for (const entry of card.historicoEtapa ?? []) {
    if (entry?.columnId !== columnId || !entry.at) continue
    if (entry.tipo === 'criado' && columnId !== card.columnId) continue
    const t = Date.parse(entry.at)
    if (!Number.isNaN(t)) max = Math.max(max, t)
  }
  return max
}

/**
 * Impede que sync/merge antigo jogue pedido de logística/enviado de volta ao início.
 * Retrocesso manual (histórico recente na coluna de destino) continua permitido.
 */
export function impedirRegressaoEtapaNoMerge(
  existing: OrderCard,
  merged: OrderCard,
  columns: Column[],
): OrderCard {
  if (merged.columnId === existing.columnId) return merged
  if (!COLUNAS_ETAPA_AVANCADA.has(existing.columnId)) return merged

  const boardRef = { columns }
  const idxExist = indiceColuna(boardRef, existing.columnId)
  const idxMerged = indiceColuna(boardRef, merged.columnId)
  if (idxExist < 0 || idxMerged < 0 || idxMerged >= idxExist) return merged

  const mudancaExplicita =
    ultimaMudancaEtapaMs(merged, merged.columnId) >
    Math.max(
      ultimaMudancaEtapaMs(existing, existing.columnId),
      ultimaMudancaEtapaMs(existing, merged.columnId),
    )

  if (mudancaExplicita) return merged

  return {
    ...merged,
    columnId: existing.columnId,
    etapaDesde: existing.etapaDesde,
  }
}

export function isColunaPadrao(columnId: string): boolean {
  return DEFAULT_COLUMN_IDS.has(columnId)
}
