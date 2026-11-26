import { separarProdutoTamanho } from './financeiroPecas'
import type { LogoLocal } from './logoLocal'

export type PecaResumoPdf = {
  quantidade: number
  peca: string
  tamanho: string
  extra: string
}

export type ContagemLogos = { pequenas: number; grandes: number }

/** Frente é logo pequena. Costas é logo grande. Frente e costas soma uma de cada. O resultado multiplica pela quantidade de peças. */
export function contarLogosDoPedido(
  local: LogoLocal | null | undefined,
  pecas: number,
): ContagemLogos {
  const quantidade = Math.max(0, Math.floor(Number(pecas) || 0))
  if (!quantidade) return { pequenas: 0, grandes: 0 }
  if (local === 'frente') return { pequenas: quantidade, grandes: 0 }
  if (local === 'costas') return { pequenas: 0, grandes: quantidade }
  if (local === 'frente-costas') return { pequenas: quantidade, grandes: quantidade }
  return { pequenas: 0, grandes: 0 }
}

/** Nome do PDF: pedido #1205 - vestfirma. Sem data. */
export function nomeArquivoPdfPedido(numero: string | undefined) {
  const limpo = String(numero || '').trim().replace(/^#/, '')
  return `pedido #${limpo || 's/n'} - vestfirma`
}

/** Vários pedidos saem num arquivo só: pedidos - vestfirma. */
export function nomeArquivoPdfPedidos(numeros: Array<string | undefined>) {
  const limpos = numeros.map((numero) => String(numero || '').trim().replace(/^#/, '')).filter(Boolean)
  if (limpos.length <= 1) return nomeArquivoPdfPedido(limpos[0])
  return 'pedidos - vestfirma'
}

/** Peça, tamanho e quantidade de cada linha. O detalhe que não é só o tamanho continua visível. */
export function resumoPecasPdf(
  linhas: Array<{ titulo?: string; quantidade?: number; detalhe?: string }> | undefined,
): PecaResumoPdf[] {
  const saida: PecaResumoPdf[] = []
  for (const linha of linhas ?? []) {
    const titulo = String(linha?.titulo || '').trim()
    const quantidade = Math.max(0, Math.floor(Number(linha?.quantidade) || 0))
    if (!titulo || quantidade <= 0) continue
    const separado = separarProdutoTamanho(titulo, linha?.detalhe)
    const detalhe = String(linha?.detalhe || '').trim()
    const extra =
      detalhe && detalhe.localeCompare(separado.tamanho, 'pt-BR', { sensitivity: 'accent' }) !== 0 ? detalhe : ''
    saida.push({
      quantidade,
      peca: separado.nome || titulo,
      tamanho: separado.tamanho,
      extra,
    })
  }
  return saida
}

/** Data do pedido na ficha, no formato dd/mm/aaaa. */
export function dataPedidoImpressao(value: string | undefined) {
  const texto = String(value || '').trim()
  if (!texto) return ''
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return texto
  return texto
}
