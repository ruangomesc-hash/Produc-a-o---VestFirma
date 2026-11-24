function linhaTexto(item: { titulo: string; quantidade: number; detalhe?: string }) {
  const extra = item.detalhe ? ` (${item.detalhe})` : ''
  return `${item.quantidade}× ${item.titulo}${extra}`
}

export type PecaSeparacao = { titulo: string; quantidade: number; detalhe?: string }

export type PedidoSeparacaoTexto = {
  numero: string
  cliente: string
  linhas: PecaSeparacao[]
  observacao?: string
}

/** Soma as peças iguais de vários pedidos para a equipe separar. */
export function resumirPecasSeparacao(pedidos: PedidoSeparacaoTexto[]): PecaSeparacao[] {
  const mapa = new Map<string, PecaSeparacao>()
  for (const pedido of pedidos) {
    for (const item of pedido.linhas || []) {
      const quantidade = Math.max(0, Number(item.quantidade) || 0)
      const titulo = String(item.titulo || '').trim()
      if (!titulo || quantidade <= 0) continue
      const detalhe = String(item.detalhe || '').trim()
      const chave = `${titulo.toLocaleLowerCase('pt-BR')}\n${detalhe.toLocaleLowerCase('pt-BR')}`
      const atual = mapa.get(chave) || { titulo, detalhe, quantidade: 0 }
      atual.quantidade += quantidade
      mapa.set(chave, atual)
    }
  }
  return [...mapa.values()].sort((a, b) => {
    const nome = a.titulo.localeCompare(b.titulo, 'pt-BR')
    if (nome !== 0) return nome
    return (a.detalhe || '').localeCompare(b.detalhe || '', 'pt-BR')
  })
}

export function textoOndaSeparacao(input: {
  quando: string
  etapa?: string
  pedidos: PedidoSeparacaoTexto[]
}): string {
  const pecas = resumirPecasSeparacao(input.pedidos)
  const linhas = ['*Separação em ondas — VestFirma*', input.quando]
  if (input.etapa) linhas.push(`Etapa: ${input.etapa}`)
  linhas.push(`${input.pedidos.length} pedido${input.pedidos.length === 1 ? '' : 's'}`)
  linhas.push('')
  if (!pecas.length) linhas.push('• Sem peças informadas nos pedidos')
  else linhas.push(...pecas.map((item) => `• ${linhaTexto(item)}`))
  return linhas.join('\n')
}

export function textoListaSeparacao(input: {
  quando: string
  etapa?: string
  pedidos: PedidoSeparacaoTexto[]
}): string {
  const pecas = resumirPecasSeparacao(input.pedidos)
  const linhas = ['*Lista de separação — VestFirma*', input.quando]
  if (input.etapa) linhas.push(`Etapa: ${input.etapa}`)
  linhas.push(`${input.pedidos.length} pedido${input.pedidos.length === 1 ? '' : 's'}`)
  linhas.push('', '*Separar estes produtos*')
  if (!pecas.length) linhas.push('• Sem peças informadas nos pedidos')
  else linhas.push(...pecas.map((item) => `• ${linhaTexto(item)}`))
  linhas.push('', '*Pedidos*')
  for (const pedido of input.pedidos) {
    const pecasPedido = (pedido.linhas || []).reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0)
    linhas.push('')
    linhas.push(
      `*#${pedido.numero}* — ${pedido.cliente} — ${pecasPedido} peça${pecasPedido === 1 ? '' : 's'}`,
    )
    if (pedido.linhas?.length) linhas.push(...pedido.linhas.map((item) => `• ${linhaTexto(item)}`))
    if (pedido.observacao) linhas.push(`Obs: ${pedido.observacao}`)
  }
  return linhas.join('\n')
}
