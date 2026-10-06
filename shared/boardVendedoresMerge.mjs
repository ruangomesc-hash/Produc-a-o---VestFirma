/** @param {import('../src/types').Vendedor[]} a */
/** @param {import('../src/types').Vendedor[]} b */
export function mergeVendedoresUnion(a, b) {
  const out = []
  const index = new Map()

  const keysFor = (v) => {
    const keys = [`id:${v.id}`]
    if (v.userId) keys.push(`uid:${v.userId}`)
    if (v.email?.trim()) keys.push(`em:${v.email.trim().toLowerCase()}`)
    return keys
  }

  const upsert = (v) => {
    if (!v?.id) return
    let targetIdx
    for (const k of keysFor(v)) {
      if (index.has(k)) {
        targetIdx = index.get(k)
        break
      }
    }
    if (targetIdx !== undefined) {
      const prev = out[targetIdx]
      const merged = {
        ...prev,
        ...v,
        id: prev.id,
        nome: v.nome?.trim() ? v.nome : prev.nome,
      }
      out[targetIdx] = merged
      for (const k of keysFor(merged)) index.set(k, targetIdx)
      return
    }
    const idx = out.length
    out.push(v)
    for (const k of keysFor(v)) index.set(k, idx)
  }

  for (const v of a ?? []) upsert(v)
  for (const v of b ?? []) upsert(v)
  return out
}

const DEFAULT_COLUMNS = [
  { id: 'pedido-feito', title: 'Pedido feito' },
  { id: 'logos-recebidas', title: 'Logos recebidas' },
  { id: 'logos-producao', title: 'Logos em produção' },
  { id: 'logos-prontas', title: 'Logos prontas' },
  { id: 'disponiveis-aplicacao', title: 'Disponíveis para aplicação' },
  { id: 'em-aplicacao', title: 'Em aplicação' },
  { id: 'liberado-logistica', title: 'Liberado para logística' },
  { id: 'pedido-enviado', title: 'Pedido enviado' },
  { id: 'cancelados-expirados', title: 'Pedidos cancelados / expirados' },
]

export function ensureBoardColumns(columns) {
  const list = [...(columns ?? [])]
  const byId = new Map(list.map((c) => [c.id, c]))
  for (const def of DEFAULT_COLUMNS) {
    if (!byId.has(def.id)) {
      list.push({ ...def })
      byId.set(def.id, def)
    }
  }
  return posicionarCanceladosDepoisDeEnviado(posicionarPedidoFeitoAntesDeLogos(list))
}

function posicionarPedidoFeitoAntesDeLogos(columns) {
  const list = [...columns]
  const feitoIdx = list.findIndex((c) => c.id === 'pedido-feito')
  if (feitoIdx < 0) return list
  const [feito] = list.splice(feitoIdx, 1)
  const logosIdx = list.findIndex((c) => c.id === 'logos-recebidas')
  list.splice(logosIdx < 0 ? 0 : logosIdx, 0, feito)
  return list
}

function posicionarCanceladosDepoisDeEnviado(columns) {
  const list = [...columns]
  const idx = list.findIndex((c) => c.id === 'cancelados-expirados')
  if (idx < 0) return list
  const [cancelados] = list.splice(idx, 1)
  const envIdx = list.findIndex((c) => c.id === 'pedido-enviado')
  list.splice(envIdx < 0 ? list.length : envIdx + 1, 0, cancelados)
  return list
}

export function mergeBoardShell(existing, incoming) {
  const mergedColumns = ensureBoardColumns(
    incoming?.columns?.length ? incoming.columns : existing?.columns ?? incoming?.columns,
  )
  return {
    columns: mergedColumns,
    vendedores: mergeVendedoresUnion(existing?.vendedores ?? [], incoming?.vendedores ?? []),
    segmentos: incoming?.segmentos?.length ? incoming.segmentos : existing?.segmentos ?? incoming?.segmentos,
  }
}
