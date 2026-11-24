export type ContagemLogos = { pequenas: number; grandes: number }

function textoChave(valor: string) {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Conta as logos de um pedido. Pequena fica em pequenas. Grande, frente e trás ou frente e costas ficam em grandes. */
export function contarLogosDoPedido(
  linhas: { titulo?: string; quantidade?: number; detalhe?: string }[] | undefined,
): ContagemLogos {
  let pequenas = 0
  let grandes = 0
  for (const item of linhas || []) {
    const quantidade = Math.max(0, Math.floor(Number(item.quantidade) || 0))
    if (!quantidade) continue
    const texto = textoChave(`${item.titulo || ''} ${item.detalhe || ''}`)
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
