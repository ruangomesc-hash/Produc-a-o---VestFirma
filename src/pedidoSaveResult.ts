import type { SaveBoardResult } from './storage'

/** Pedido considerado gravado para produção (API ligada). */
export function pedidoGravadoNoServidor(result: SaveBoardResult): boolean {
  return result.ok && result.remote === true
}

export function mensagemFalhaGravacaoServidor(result: SaveBoardResult): string {
  if (pedidoGravadoNoServidor(result)) return ''
  if (!result.ok && result.error) return result.error
  return 'Não foi possível gravar no servidor. Tente de novo — o pedido não vale como enviado até sincronizar.'
}
