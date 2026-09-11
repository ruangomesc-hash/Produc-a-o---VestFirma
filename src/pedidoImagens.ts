/** Normaliza campo legado (string) ou lista de URLs de imagem do pedido. */
export function normalizePedidoImagens(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  }
  if (typeof value === 'string' && value) return [value]
  return []
}

export function primeiraImagemPedido(imagens: string[]): string | null {
  return imagens[0] ?? null
}
