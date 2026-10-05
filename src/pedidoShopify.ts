import { COLUNA_PEDIDO_FEITO_ID } from './defaultBoard'
import type { OrderCard } from './types'

export function pedidoFaltaLogo(
  card: Pick<OrderCard, 'columnId' | 'logoEnviadaCliente'>,
): boolean {
  if (card.columnId !== COLUNA_PEDIDO_FEITO_ID) return false
  return !Array.isArray(card.logoEnviadaCliente) || card.logoEnviadaCliente.length === 0
}
