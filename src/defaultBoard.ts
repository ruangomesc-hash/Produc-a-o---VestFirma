import type { BoardState } from './types'
import { mesclarSegmentos } from './segmentosEmpresa'

const col = (id: string, title: string) => ({ id, title })

/** Única coluna onde novos pedidos podem ser criados. */
export const COLUNA_NOVO_PEDIDO_ID = 'logos-recebidas'

/** Coluna padrão onde novos pedidos entram (portal do vendedor e kanban). */
export function colunaParaNovoPedido(board: BoardState): string {
  const col = board.columns.find((c) => c.id === COLUNA_NOVO_PEDIDO_ID)
  if (col) return col.id
  return board.columns[0]?.id ?? COLUNA_NOVO_PEDIDO_ID
}

export const DEFAULT_BOARD: BoardState = {
  columns: [
    col(COLUNA_NOVO_PEDIDO_ID, 'Logos recebidas'),
    col('logos-producao', 'Logos em produção'),
    col('logos-prontas', 'Logos prontas'),
    col('disponiveis-aplicacao', 'Disponíveis para aplicação'),
    col('em-aplicacao', 'Em aplicação'),
    col('liberado-logistica', 'Liberado para logística'),
    col('pedido-enviado', 'Pedido enviado'),
  ],
  cards: [],
  vendedores: [],
  segmentos: mesclarSegmentos([]),
}
