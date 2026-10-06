import type { HistoricoEtapaEntry, OrderCard, PedidoComentario } from './types'
import { normalizePedidoImagens } from './pedidoImagens'
import { ordenarComentariosPedido } from './pedidoComentarios'

function isoToMs(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** Última mudança de etapa (arraste manual / Shopify), independente de comentário. */
export function etapaRevisionMs(
  card: Pick<OrderCard, 'columnId' | 'etapaDesde' | 'historicoEtapa' | 'createdAt'> | null | undefined,
): number {
  if (!card) return 0
  let max = isoToMs(card.etapaDesde) || isoToMs(card.createdAt)
  for (const e of card.historicoEtapa ?? []) {
    const tipo = String(e?.tipo || '')
    if (tipo === 'criado' || tipo === 'movido' || tipo === 'avancou' || tipo === 'voltou' || e?.fromColumnId) {
      max = Math.max(max, isoToMs(e?.at))
    }
  }
  return max
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

function mergeLinhasPedido(existing: OrderCard, incoming: OrderCard, tExist: number, tIn: number) {
  const a = existing.linhasPedido
  const b = incoming.linhasPedido
  const hasA = Array.isArray(a) && a.length > 0
  const hasB = Array.isArray(b) && b.length > 0
  if (!hasA) return hasB ? b : a
  if (!hasB) return a
  return tIn >= tExist ? b : a
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
  const etapaExist = etapaRevisionMs(existing)
  const etapaIn = etapaRevisionMs(incoming)
  const etapaWinner = etapaIn >= etapaExist ? incoming : existing
  const comentarios = ordenarComentariosPedido(
    mergeById<PedidoComentario>(existing.comentarios, incoming.comentarios),
  )

  return {
    ...older,
    ...newer,
    columnId: etapaWinner.columnId,
    etapaDesde: etapaWinner.etapaDesde || newer.etapaDesde,
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
    linhasPedido: mergeLinhasPedido(existing, incoming, tExist, tIn),
  }
}

function qtdImagens(value: string | string[] | null | undefined): number {
  return normalizePedidoImagens(value).length
}

export function cardTemConteudoAlemDoOutro(
  local: OrderCard,
  remote: OrderCard | undefined,
): boolean {
  if (!remote) return true
  if (
    mergePedidoImagens(local.logoProntaImpressao, remote.logoProntaImpressao).length >
    qtdImagens(remote.logoProntaImpressao)
  ) {
    return true
  }
  if (
    mergePedidoImagens(local.logoEnviadaCliente, remote.logoEnviadaCliente).length >
    qtdImagens(remote.logoEnviadaCliente)
  ) {
    return true
  }
  if (
    mergePedidoImagens(local.previewAprovacaoCliente, remote.previewAprovacaoCliente).length >
    qtdImagens(remote.previewAprovacaoCliente)
  ) {
    return true
  }
  const localComents = local.comentarios ?? []
  const remoteComents = remote.comentarios ?? []
  const remoteIds = new Set(remoteComents.map((c) => c?.id).filter(Boolean))
  if (localComents.some((c) => c?.id && !remoteIds.has(c.id))) return true
  if (localComents.length > remoteComents.length) return true
  const lo = (local.observacao ?? '').trim()
  const ro = (remote.observacao ?? '').trim()
  if (lo && !ro) return true
  if (
    local.columnId !== remote.columnId &&
    etapaRevisionMs(local) > etapaRevisionMs(remote)
  ) {
    return true
  }
  return false
}

/** Local tem comentário, logo ou observação que o servidor ainda não tem. */
export function boardTemConteudoAlemDoServidor(
  local: { cards?: OrderCard[] } | null | undefined,
  remote: { cards?: OrderCard[] } | null | undefined,
): boolean {
  const byId = new Map((remote?.cards ?? []).filter((c) => c?.id).map((c) => [c.id, c]))
  for (const card of local?.cards ?? []) {
    if (!card?.id) continue
    if (cardTemConteudoAlemDoOutro(card, byId.get(card.id))) return true
  }
  return false
}

