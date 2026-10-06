import { normalizeNumeroPedido } from './vincularPedido.ts'
import type { OrderCard } from './types.ts'

function chaveNumeroPedido(raw: unknown): { n: number | null; s: string } {
  const t = String(raw || '').trim()
  if (!t) return { n: null, s: '' }
  const norm = normalizeNumeroPedido(t)
  const soNumero = /^\d+$/.test(norm) && !/[a-zA-Z]/.test(t)
  if (soNumero) return { n: Number(norm), s: t.toLowerCase() }
  return { n: null, s: t.toLowerCase() }
}

/** Menor número do pedido primeiro (fila de prioridade). Códigos tipo WPP-01 vão depois. */
export function compararNumeroPedido(a: unknown, b: unknown): number {
  const ka = chaveNumeroPedido(a)
  const kb = chaveNumeroPedido(b)
  if (ka.n != null && kb.n != null && ka.n !== kb.n) return ka.n - kb.n
  if (ka.n != null && kb.n == null) return -1
  if (ka.n == null && kb.n != null) return 1
  if (!ka.s && kb.s) return 1
  if (ka.s && !kb.s) return -1
  const byText = ka.s.localeCompare(kb.s, 'pt-BR', { numeric: true, sensitivity: 'base' })
  if (byText !== 0) return byText
  return 0
}

export function ordenarCardsPorNumeroPedido(cards: OrderCard[]): OrderCard[] {
  return [...cards].sort((a, b) => {
    const c = compararNumeroPedido(a.numeroPedido, b.numeroPedido)
    if (c !== 0) return c
    return String(a.id || '').localeCompare(String(b.id || ''))
  })
}
