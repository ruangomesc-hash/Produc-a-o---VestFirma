function isoToMs(iso) {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

export function pedidoRevisionMs(card) {
  let max = 0
  for (const e of card?.historicoEtapa ?? []) {
    max = Math.max(max, isoToMs(e?.at))
  }
  for (const c of card?.comentarios ?? []) {
    max = Math.max(max, isoToMs(c?.at))
  }
  for (const iso of [card?.etapaDesde, card?.createdAt, card?.arquivadoEm]) {
    max = Math.max(max, isoToMs(iso))
  }
  return max
}

function mergeById(a, b) {
  const byId = new Map()
  const semId = []
  for (const item of [...(a ?? []), ...(b ?? [])]) {
    if (!item) continue
    if (item.id) byId.set(item.id, item)
    else semId.push(item)
  }
  return [...semId, ...Array.from(byId.values())]
}

function sortByAt(list) {
  return [...list].sort((x, y) => String(x?.at ?? '').localeCompare(String(y?.at ?? '')))
}

function normalizeImagens(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.length > 0)
  if (typeof value === 'string' && value) return [value]
  return []
}

export function mergePedidoImagens(a, b) {
  const out = []
  const seen = new Set()
  for (const url of [...normalizeImagens(a), ...normalizeImagens(b)]) {
    if (!url || url.startsWith('blob:') || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

export function mergeObservacaoPedido(a, b, tA, tB) {
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

function mergeLinhasPedido(existing, incoming, tExist, tIn) {
  const a = existing?.linhasPedido
  const b = incoming?.linhasPedido
  const hasA = Array.isArray(a) && a.length > 0
  const hasB = Array.isArray(b) && b.length > 0
  if (!hasA) return hasB ? b : a
  if (!hasB) return a
  return tIn >= tExist ? b : a
}

function mergeItensProduto(existing, incoming, tExist, tIn) {
  const a = existing?.itensProduto
  const b = incoming?.itensProduto
  const hasA = Array.isArray(a) && a.length > 0
  const hasB = Array.isArray(b) && b.length > 0
  if (!hasA) return hasB ? b : a
  if (!hasB) return a
  return tIn >= tExist ? b : a
}

/** Une comentários, logos e observação; não remove o pedido. */
export function mergeOrderCardFields(existing, incoming) {
  const tExist = pedidoRevisionMs(existing)
  const tIn = pedidoRevisionMs(incoming)
  const newer = tIn >= tExist ? incoming : existing
  const older = tIn >= tExist ? existing : incoming

  return {
    ...older,
    ...newer,
    comentarios: sortByAt(mergeById(existing.comentarios, incoming.comentarios)),
    historicoEtapa: sortByAt(mergeById(existing.historicoEtapa, incoming.historicoEtapa)),
    logoEnviadaCliente: mergePedidoImagens(existing.logoEnviadaCliente, incoming.logoEnviadaCliente),
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

function qtdImagens(value) {
  return normalizeImagens(value).length
}

export function cardTemConteudoAlemDoOutro(local, remote) {
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
  return false
}

export function boardTemConteudoAlemDoServidor(local, remote) {
  const byId = new Map((remote?.cards ?? []).filter((c) => c?.id).map((c) => [c.id, c]))
  for (const card of local?.cards ?? []) {
    if (!card?.id) continue
    if (cardTemConteudoAlemDoOutro(card, byId.get(card.id))) return true
  }
  return false
}

