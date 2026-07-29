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

export function mergeBoardShell(existing, incoming) {
  return {
    columns: incoming?.columns?.length ? incoming.columns : existing?.columns ?? incoming?.columns,
    vendedores: mergeVendedoresUnion(existing?.vendedores ?? [], incoming?.vendedores ?? []),
    segmentos: incoming?.segmentos?.length ? incoming.segmentos : existing?.segmentos ?? incoming?.segmentos,
  }
}
