import type { BoardState, Column, OrderCard } from './types'

/** Etapa única. Aprovado não fica aqui: o pedido segue para Disponíveis para aplicação. */
export const COLUNA_CONTROLE_QUALIDADE_ID = 'controle-qualidade'
export const COLUNA_CONTROLE_QUALIDADE_TITLE = 'Controle de qualidade'
export const COLUNA_DISPONIVEIS_APLICACAO_ID = 'disponiveis-aplicacao'

/** Coluna criada no quadro ao vivo. O id fixa a migração mesmo se o título mudar. */
export const COLUNA_LOGO_SOLICITADA_ID = '1c87d196-b493-448c-b5b3-3f38aeb2eb7d'

export const MARCAS_CONTROLE_QUALIDADE = {
  reprovado: 'Reprovado no controle de qualidade',
  retrabalho: 'Aguardando retrabalho',
} as const

export type MarcaControleQualidade = keyof typeof MARCAS_CONTROLE_QUALIDADE

function tituloChave(title: string) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function ehColunaLogoSolicitada(column: { id?: string; title?: string } | null | undefined) {
  if (!column?.id) return false
  if (column.id === COLUNA_LOGO_SOLICITADA_ID) return true
  const chave = tituloChave(column.title || '')
  return chave === 'logo solicitada' || chave === 'logos solicitadas'
}

export function marcaControleQualidade(value: unknown): MarcaControleQualidade | null {
  return value === 'reprovado' || value === 'retrabalho' ? value : null
}

export function textoMarcaControleQualidade(marca: MarcaControleQualidade | null | undefined) {
  if (!marca) return ''
  return MARCAS_CONTROLE_QUALIDADE[marca]
}

/** Coloca Controle de qualidade imediatamente antes de Disponíveis para aplicação. */
export function ordenarColunasComControleQualidade(columns: Column[]): Column[] {
  const list = (columns ?? []).filter(
    (col) => col?.id && !ehColunaLogoSolicitada(col) && col.id !== COLUNA_CONTROLE_QUALIDADE_ID,
  )
  const cq: Column = {
    id: COLUNA_CONTROLE_QUALIDADE_ID,
    title: COLUNA_CONTROLE_QUALIDADE_TITLE,
  }
  const dest = list.findIndex((col) => col.id === COLUNA_DISPONIVEIS_APLICACAO_ID)
  list.splice(dest < 0 ? list.length : dest, 0, cq)
  return list
}

/**
 * Move os pedidos de logo solicitada para Controle de qualidade e tira essa coluna.
 * Não apaga pedido. A segunda passagem não muda mais nada.
 */
export function aplicarControleQualidade(board: BoardState): { board: BoardState; changed: boolean } {
  const columnsIn = Array.isArray(board?.columns) ? board.columns.filter(Boolean) : []
  const cardsIn = Array.isArray(board?.cards) ? board.cards : []
  const removerIds = new Set(columnsIn.filter(ehColunaLogoSolicitada).map((col) => col.id))
  for (const card of cardsIn) {
    if (card?.columnId === COLUNA_LOGO_SOLICITADA_ID) removerIds.add(COLUNA_LOGO_SOLICITADA_ID)
  }

  const titulos = new Map(columnsIn.map((col) => [col.id, col.title]))
  const agora = new Date().toISOString()
  let cardsChanged = false
  const cards = cardsIn.map((card) => {
    if (!card || !removerIds.has(card.columnId)) return card
    cardsChanged = true
    const histId = `cq-migracao-${card.id}`
    const historico = Array.isArray(card.historicoEtapa) ? [...card.historicoEtapa] : []
    const ja = historico.some((entry) => entry?.id === histId)
    if (!ja) {
      historico.push({
        id: histId,
        tipo: 'movido',
        columnId: COLUNA_CONTROLE_QUALIDADE_ID,
        columnTitle: COLUNA_CONTROLE_QUALIDADE_TITLE,
        at: agora,
        fromColumnId: card.columnId,
        fromColumnTitle: titulos.get(card.columnId) || 'logo solicitada',
        detalhe: 'Entrou em Controle de qualidade no lugar de logo solicitada',
      })
    }
    if (card.columnId === COLUNA_CONTROLE_QUALIDADE_ID && ja) return card
    return {
      ...card,
      columnId: COLUNA_CONTROLE_QUALIDADE_ID,
      etapaDesde: ja ? card.etapaDesde : agora,
      historicoEtapa: historico,
    }
  })

  const columns = ordenarColunasComControleQualidade(columnsIn)
  const columnsChanged =
    columns.length !== columnsIn.length ||
    columns.some((col, index) => columnsIn[index]?.id !== col.id || columnsIn[index]?.title !== col.title)

  return {
    board: { ...board, columns, cards: cards as OrderCard[] },
    changed: cardsChanged || columnsChanged,
  }
}
