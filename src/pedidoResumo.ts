import type { OrderCard, PedidoLinhaResumo } from './types'
import {
  formatItensProdutoLista,
  formatItensProdutoResumo,
  itensProdutoDoPedido,
  quantidadeTotalItensProduto,
  rotuloTipoProduto,
} from './tiposProduto'

export function normalizeLinhasPedido(raw: unknown): PedidoLinhaResumo[] {
  if (!Array.isArray(raw)) return []
  const out: PedidoLinhaResumo[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as { titulo?: unknown; quantidade?: unknown; detalhe?: unknown }
    const titulo = String(row.titulo || '').trim()
    const quantidade = Math.max(0, Math.floor(Number(row.quantidade) || 0))
    if (!titulo || quantidade <= 0) continue
    const detalhe = String(row.detalhe || '').trim()
    out.push(detalhe ? { titulo, quantidade, detalhe } : { titulo, quantidade })
  }
  return out
}

export function somaLinhasPedido(linhas: PedidoLinhaResumo[] | undefined): number {
  if (!linhas?.length) return 0
  return linhas.reduce((sum, item) => sum + Math.max(0, item.quantidade), 0)
}

export function formatLinhasPedidoResumo(linhas: PedidoLinhaResumo[] | undefined): string {
  if (!linhas?.length) return ''
  return linhas
    .map((item) => {
      const extra = item.detalhe ? ` (${item.detalhe})` : ''
      return `${item.quantidade}× ${item.titulo}${extra}`
    })
    .join(' · ')
}

export function formatLinhasPedidoLista(linhas: PedidoLinhaResumo[] | undefined): string {
  if (!linhas?.length) return ''
  return linhas
    .map((item) => {
      const extra = item.detalhe ? ` (${item.detalhe})` : ''
      return `• ${item.quantidade}× ${item.titulo}${extra}`
    })
    .join('\n')
}

export function linhasResumoDoPedido(
  card: Pick<OrderCard, 'linhasPedido' | 'itensProduto' | 'tipoProduto' | 'quantidade'>,
): PedidoLinhaResumo[] {
  const shopify = normalizeLinhasPedido(card.linhasPedido)
  if (shopify.length) return shopify
  return itensProdutoDoPedido(card).map((item) => ({
    titulo: rotuloTipoProduto(item.tipoProduto) || item.tipoProduto,
    quantidade: item.quantidade,
  }))
}

export function quantidadeExibidaComResumo(
  card: Pick<OrderCard, 'linhasPedido' | 'itensProduto' | 'quantidade'>,
): number {
  const dasLinhas = somaLinhasPedido(card.linhasPedido)
  if (dasLinhas > 0) return dasLinhas
  const dosTipos = quantidadeTotalItensProduto(card.itensProduto)
  if (dosTipos > 0) return dosTipos
  return Math.max(1, card.quantidade || 1)
}

export function textoResumoPedido(
  card: Pick<OrderCard, 'linhasPedido' | 'itensProduto' | 'tipoProduto' | 'quantidade'>,
): string {
  const shopify = formatLinhasPedidoResumo(card.linhasPedido)
  if (shopify) return shopify
  return formatItensProdutoResumo(itensProdutoDoPedido(card))
}

export function textoResumoPedidoLista(
  card: Pick<OrderCard, 'linhasPedido' | 'itensProduto' | 'tipoProduto' | 'quantidade'>,
): string {
  const shopify = formatLinhasPedidoLista(card.linhasPedido)
  if (shopify) return shopify
  return formatItensProdutoLista(itensProdutoDoPedido(card))
}
