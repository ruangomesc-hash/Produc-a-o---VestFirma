import type { HistoricoEtapaEntry, OrderCard } from './types'

const CAMPOS_LOGO = [
  ['logoEnviadaCliente', 'a logo enviada pelo cliente'],
  ['logoProntaImpressao', 'a logo pronta para impressão'],
  ['previewAprovacaoCliente', 'o preview aprovado pelo cliente'],
] as const

function listaLogo(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => typeof item === 'string' && item && !item.startsWith('blob:'))
}

function mesmaLista(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((url, i) => url === b[i])
}

function verboMudanca(antes: string[], depois: string[]): string {
  if (depois.length === 0) return 'removeu'
  if (antes.length === 0) return 'adicionou'
  if (depois.length < antes.length && depois.every((url) => antes.includes(url))) return 'removeu'
  if (antes.length < depois.length && antes.every((url) => depois.includes(url))) return 'adicionou'
  return 'trocou'
}

/** Frase do histórico. Vazio quando as três listas continuam iguais. */
export function textoMudancaLogo(
  antes: Pick<OrderCard, 'logoEnviadaCliente' | 'logoProntaImpressao' | 'previewAprovacaoCliente'>,
  depois: Pick<OrderCard, 'logoEnviadaCliente' | 'logoProntaImpressao' | 'previewAprovacaoCliente'>,
): string {
  const partes: string[] = []
  for (const [key, nome] of CAMPOS_LOGO) {
    const a = listaLogo(antes?.[key])
    const b = listaLogo(depois?.[key])
    if (mesmaLista(a, b)) continue
    partes.push(`${verboMudanca(a, b)} ${nome}`)
  }
  if (!partes.length) return ''
  const texto = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

type AutorLogo = {
  autorNome?: string
  autorEmail?: string
  autorRole?: HistoricoEtapaEntry['autorRole']
}

/**
 * Acrescenta uma linha no histórico do pedido quando a logo mudou.
 * Não mexe na coluna nem na hora da etapa.
 */
export function anexarHistoricoLogo(antes: OrderCard, depois: OrderCard, autor: AutorLogo = {}): OrderCard {
  const detalhe = textoMudancaLogo(antes, depois)
  if (!detalhe) return depois
  const at = depois.midiaAtualizadaEm || new Date().toISOString()
  const cardId = depois.id || antes.id || 'pedido'
  const id = `logo-${cardId}-${at}`
  const historico = depois.historicoEtapa ?? []
  if (historico.some((entry) => entry?.id === id)) return depois
  const linha: HistoricoEtapaEntry = {
    id,
    tipo: 'logo',
    columnId: depois.columnId || antes.columnId || '',
    columnTitle: '',
    detalhe,
    at,
  }
  if (autor.autorNome) linha.autorNome = autor.autorNome
  if (autor.autorEmail) linha.autorEmail = autor.autorEmail
  if (autor.autorRole) linha.autorRole = autor.autorRole
  return {
    ...depois,
    historicoEtapa: [...historico, linha],
  }
}
