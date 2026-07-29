const UFS_BR = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB',
  'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
])

export type LocalPedido = {
  cidade: string | null
  uf: string | null
}

export type CidadeResumo = {
  chave: string
  cidade: string
  uf: string | null
  pedidos: number
  pecas: number
}

export type EstadoResumo = {
  uf: string
  pedidos: number
  pecas: number
}

function ufValida(raw: string | undefined): string | null {
  if (!raw) return null
  const uf = raw.toUpperCase()
  return UFS_BR.has(uf) ? uf : null
}

/** Extrai cidade e UF a partir do endereço livre do pedido. */
export function parseLocalPedido(endereco: string): LocalPedido {
  const t = endereco.trim()
  if (!t) return { cidade: null, uf: null }

  const tail = t.match(/([^/]+)\/([A-Za-z]{2})\s*$/)
  if (tail) {
    const uf = ufValida(tail[2])
    if (uf) {
      let cidade = tail[1].trim()
      const partes = cidade.split(/\s*[—\-]\s*/)
      cidade = (partes[partes.length - 1] ?? cidade).trim()
      return { cidade: cidade || null, uf }
    }
  }

  const soUf = t.match(/\b([A-Za-z]{2})\s*$/)
  if (soUf) {
    const uf = ufValida(soUf[1])
    if (uf) return { cidade: null, uf }
  }

  return { cidade: null, uf: null }
}

export function agregarPorEstado(
  cards: { endereco: string; quantidade: number }[],
): EstadoResumo[] {
  const map = new Map<string, { pedidos: number; pecas: number }>()
  for (const card of cards) {
    const { uf } = parseLocalPedido(card.endereco)
    if (!uf) continue
    const cur = map.get(uf) ?? { pedidos: 0, pecas: 0 }
    cur.pedidos += 1
    cur.pecas += card.quantidade
    map.set(uf, cur)
  }
  return [...map.entries()]
    .map(([uf, v]) => ({ uf, ...v }))
    .sort((a, b) => b.pedidos - a.pedidos || a.uf.localeCompare(b.uf))
}

export function agregarPorCidade(
  cards: { endereco: string; quantidade: number }[],
): CidadeResumo[] {
  const map = new Map<string, CidadeResumo>()
  for (const card of cards) {
    const { cidade, uf } = parseLocalPedido(card.endereco)
    if (!cidade) continue
    const chave = `${cidade}|${uf ?? ''}`
    const cur = map.get(chave) ?? {
      chave,
      cidade,
      uf,
      pedidos: 0,
      pecas: 0,
    }
    cur.pedidos += 1
    cur.pecas += card.quantidade
    map.set(chave, cur)
  }
  return [...map.values()].sort(
    (a, b) => b.pedidos - a.pedidos || b.pecas - a.pecas || a.cidade.localeCompare(b.cidade, 'pt-BR'),
  )
}
