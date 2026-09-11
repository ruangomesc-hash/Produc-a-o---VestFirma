import type { OrderCard } from './types'

export const TIPOS_PRODUTO = [
  { id: 'camisa-algodao-100', label: 'Camisa algodão 100%' },
  { id: 'camisa-polo', label: 'Camisa polo' },
  { id: 'corta-vento', label: 'Corta-vento' },
  { id: 'baby-look', label: 'Baby look' },
  { id: 'camisa-manga-longa', label: 'Camisa manga longa' },
  { id: 'camisa-dry-fit', label: 'Camisa dry fit' },
  { id: 'camisa-oversize', label: 'Camisa oversize' },
  { id: 'camisa-plus-size-algodao', label: 'Camisa plus size algodão' },
] as const

export type TipoProdutoId = (typeof TIPOS_PRODUTO)[number]['id']

export type PedidoItemProduto = {
  tipoProduto: TipoProdutoId
  quantidade: number
}

const LABELS = new Map(TIPOS_PRODUTO.map((t) => [t.id, t.label]))
const ORDER = new Map(TIPOS_PRODUTO.map((t, i) => [t.id, i]))

export function rotuloTipoProduto(id: string | null | undefined): string | null {
  if (!id?.trim()) return null
  return LABELS.get(id as TipoProdutoId) ?? id
}

export function tipoProdutoValido(id: string | null | undefined): id is TipoProdutoId {
  if (!id) return false
  return LABELS.has(id as TipoProdutoId)
}

export function ordenarItensProduto(itens: PedidoItemProduto[]): PedidoItemProduto[] {
  return [...itens].sort(
    (a, b) => (ORDER.get(a.tipoProduto) ?? 99) - (ORDER.get(b.tipoProduto) ?? 99),
  )
}

export function quantidadeTotalItensProduto(itens: PedidoItemProduto[] | undefined): number {
  if (!itens?.length) return 0
  return itens.reduce((sum, item) => sum + Math.max(0, item.quantidade), 0)
}

/** Converte JSON legado (tipo único ou lista) para itens normalizados. */
export function normalizeItensProdutoFromCard(
  raw: Pick<OrderCard, 'itensProduto' | 'tipoProduto' | 'quantidade'>,
): PedidoItemProduto[] {
  if (Array.isArray(raw.itensProduto)) {
    const itens = raw.itensProduto
      .filter(
        (item): item is PedidoItemProduto =>
          Boolean(item) &&
          tipoProdutoValido(item.tipoProduto) &&
          Number(item.quantidade) > 0,
      )
      .map((item) => ({
        tipoProduto: item.tipoProduto,
        quantidade: Math.max(1, Math.floor(Number(item.quantidade))),
      }))
    return ordenarItensProduto(itens)
  }

  if (raw.tipoProduto && tipoProdutoValido(raw.tipoProduto)) {
    return [
      {
        tipoProduto: raw.tipoProduto,
        quantidade: Math.max(1, Math.floor(Number(raw.quantidade) || 1)),
      },
    ]
  }

  return []
}

/** Total de peças exibido no quadro — soma dos itens ou quantidade legada. */
export function quantidadeExibidaPedido(
  card: Pick<OrderCard, 'itensProduto' | 'quantidade'>,
): number {
  const totalItens = quantidadeTotalItensProduto(card.itensProduto)
  if (totalItens > 0) return totalItens
  return Math.max(1, card.quantidade || 1)
}

export function itensProdutoDoPedido(
  card: Pick<OrderCard, 'itensProduto' | 'tipoProduto' | 'quantidade'>,
): PedidoItemProduto[] {
  if (card.itensProduto?.length) return ordenarItensProduto(card.itensProduto)
  return normalizeItensProdutoFromCard(card)
}

export function formatItensProdutoResumo(itens: PedidoItemProduto[]): string {
  return ordenarItensProduto(itens)
    .map((item) => `${item.quantidade}× ${rotuloTipoProduto(item.tipoProduto)}`)
    .join(' · ')
}

export function formatItensProdutoLista(itens: PedidoItemProduto[]): string {
  return ordenarItensProduto(itens)
    .map((item) => `• ${item.quantidade}× ${rotuloTipoProduto(item.tipoProduto)}`)
    .join('\n')
}
