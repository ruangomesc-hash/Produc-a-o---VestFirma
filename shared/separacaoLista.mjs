function linhaTexto(item) {
  const extra = item.detalhe ? ` (${item.detalhe})` : ''
  return `${item.quantidade}× ${item.titulo}${extra}`
}

function chaveLinha(item) {
  return `${item.titulo}\n${item.detalhe || ''}`
}

/** Soma as peças iguais de vários pedidos para a equipe separar. */
export function resumirPecasSeparacao(pedidos) {
  const mapa = new Map()
  for (const pedido of pedidos) {
    for (const item of pedido.linhas || []) {
      const quantidade = Math.max(0, Number(item.quantidade) || 0)
      const titulo = String(item.titulo || '').trim()
      if (!titulo || quantidade <= 0) continue
      const detalhe = String(item.detalhe || '').trim()
      const chave = chaveLinha({ titulo, detalhe })
      const atual = mapa.get(chave) || { titulo, detalhe, quantidade: 0 }
      atual.quantidade += quantidade
      mapa.set(chave, atual)
    }
  }
  return [...mapa.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
}

export function textoListaSeparacao({ quando, etapa, pedidos }) {
  const pecas = resumirPecasSeparacao(pedidos)
  const linhas = ['*Lista de separação — VestFirma*', quando]
  if (etapa) linhas.push(`Etapa: ${etapa}`)
  linhas.push(`${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'}`)
  linhas.push('', '*Separar estes produtos*')
  if (!pecas.length) linhas.push('• Sem peças informadas nos pedidos')
  else linhas.push(...pecas.map((item) => `• ${linhaTexto(item)}`))
  linhas.push('', '*Pedidos*')
  for (const pedido of pedidos) {
    const pecasPedido = (pedido.linhas || []).reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0)
    linhas.push('')
    linhas.push(`*#${pedido.numero}* — ${pedido.cliente} — ${pecasPedido} peça${pecasPedido === 1 ? '' : 's'}`)
    if (pedido.linhas?.length) linhas.push(...pedido.linhas.map((item) => `• ${linhaTexto(item)}`))
    if (pedido.observacao) linhas.push(`Obs: ${pedido.observacao}`)
  }
  return linhas.join('\n')
}
