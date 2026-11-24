function textoChave(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Conta as logos de um pedido. Pequena fica em pequenas. Grande, frente e trás ou frente e costas ficam em grandes. */
export function contarLogosDoPedido(linhas) {
  let pequenas = 0
  let grandes = 0
  for (const item of linhas || []) {
    const quantidade = Math.max(0, Math.floor(Number(item?.quantidade) || 0))
    if (!quantidade) continue
    const texto = textoChave(`${item?.titulo || ''} ${item?.detalhe || ''}`)
    if (texto.includes('pequena')) pequenas += quantidade
    else if (
      texto.includes('grande') ||
      texto.includes('frente e tras') ||
      texto.includes('frente e costas')
    ) {
      grandes += quantidade
    }
  }
  return { pequenas, grandes }
}

/** Nome do PDF: pedido #1205 - vestfirma. Sem data. */
export function nomeArquivoPdfPedido(numero) {
  const limpo = String(numero || '').trim().replace(/^#/, '')
  return `pedido #${limpo || 's/n'} - vestfirma`
}

/** Data do pedido na ficha, no formato dd/mm/aaaa. */
export function dataPedidoImpressao(value) {
  const texto = String(value || '').trim()
  if (!texto) return ''
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return texto
  return texto
}
