import type { HistoricoEtapaEntry, OrderCard, PedidoComentario } from './types'
import { normalizePedidoImagens } from './pedidoImagens'
import { ordenarComentariosPedido } from './pedidoComentarios'

function isoToMs(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** Momento da última mudança no pedido (etapa, comentário ou arquivo). */
export function pedidoRevisionMs(card: Pick<
  OrderCard,
  'historicoEtapa' | 'comentarios' | 'etapaDesde' | 'createdAt' | 'arquivadoEm'
>): number {
  let max = 0
  for (const e of card.historicoEtapa ?? []) {
    max = Math.max(max, isoToMs(e?.at))
  }
  for (const c of card.comentarios ?? []) {
    max = Math.max(max, isoToMs(c?.at))
  }
  for (const iso of [card.etapaDesde, card.createdAt, card.arquivadoEm]) {
    max = Math.max(max, isoToMs(iso))
  }
  return max
}

function mergeById<T extends { id?: string }>(a: T[] | undefined, b: T[] | undefined): T[] {
  const byId = new Map<string, T>()
  const semId: T[] = []
  for (const item of [...(a ?? []), ...(b ?? [])]) {
    if (!item) continue
    if (item.id) byId.set(item.id, item)
    else semId.push(item)
  }
  return [...semId, ...Array.from(byId.values())]
}

function ordenarHistorico(entries: HistoricoEtapaEntry[]): HistoricoEtapaEntry[] {
  return [...entries].sort((x, y) => x.at.localeCompare(y.at))
}

/** Une URLs de imagem; nunca descarta anexo que só existe de um lado. */
export function mergePedidoImagens(
  a: string | string[] | null | undefined,
  b: string | string[] | null | undefined,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const url of [...normalizePedidoImagens(a), ...normalizePedidoImagens(b)]) {
    if (!url || url.startsWith('blob:') || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

export function mergeObservacaoPedido(
  a: string | undefined,
  b: string | undefined,
  tA: number,
  tB: number,
): string {
  const sa = typeof a === 'string' ? a : ''
  const sb = typeof b === 'string' ? b : ''
  if (sa === sb) return sa
  if (!sa.trim()) return sb
  if (!sb.trim()) return sa
  if (tB !== tA) return tB > tA ? sb : sa
  if (sa.includes(sb)) return sa
  if (sb.includes(sa)) return sb
  return sa.length >= sb.length ? sa : sb
}

function mergeItensProduto(existing: OrderCard, incoming: OrderCard, tExist: number, tIn: number) {
  const a = existing.itensProduto
  const b = incoming.itensProduto
  const hasA = Array.isArray(a) && a.length > 0
  const hasB = Array.isArray(b) && b.length > 0
  if (!hasA) return hasB ? b : a
  if (!hasB) return a
  return tIn >= tExist ? b : a
}

/**
 * Une dois estados do mesmo pedido: comentários, logos e observação não se apagam no sync.
 * Campos simples seguem a revisão mais recente. Não remove o pedido.
 */
export function mergeOrderCardFields(existing: OrderCard, incoming: OrderCard): OrderCard {
  const tExist = pedidoRevisionMs(existing)
  const tIn = pedidoRevisionMs(incoming)
  const newer = tIn >= tExist ? incoming : existing
  const older = tIn >= tExist ? existing : incoming

  const comentarios = ordenarComentariosPedido(
    mergeById<PedidoComentario>(existing.comentarios, incoming.comentarios),
  )

  return {
    ...older,
    ...newer,
    comentarios,
    historicoEtapa: ordenarHistorico(
      mergeById<HistoricoEtapaEntry>(existing.historicoEtapa, incoming.historicoEtapa),
    ),
    logoEnviadaCliente: mergePedidoImagens(
      existing.logoEnviadaCliente,
      incoming.logoEnviadaCliente,
    ),
    logoProntaImpressao: mergePedidoImagens(
      existing.logoProntaImpressao,
      incoming.logoProntaImpressao,
    ),
    previewAprovacaoCliente: mergePedidoImagens(
      existing.previewAprovacaoCliente,
      incoming.previewAprovacaoCliente,
    ),
    observacao: mergeObservacaoPedido(existing.observacao, incoming.observacao, tExist, tIn),
    itensProduto: mergeItensProduto(existing, incoming, tExist, tIn),
  }
}
