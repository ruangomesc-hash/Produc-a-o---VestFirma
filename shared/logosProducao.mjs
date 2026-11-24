/** Frente é logo pequena. Costas é logo grande. Frente e costas soma uma de cada. O resultado multiplica pela quantidade de peças. */
export function contarLogosDoPedido(local, pecas) {
  const quantidade = Math.max(0, Math.floor(Number(pecas) || 0))
  if (!quantidade) return { pequenas: 0, grandes: 0 }
  if (local === 'frente') return { pequenas: quantidade, grandes: 0 }
  if (local === 'costas') return { pequenas: 0, grandes: quantidade }
  if (local === 'frente-costas') return { pequenas: quantidade, grandes: quantidade }
  return { pequenas: 0, grandes: 0 }
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
