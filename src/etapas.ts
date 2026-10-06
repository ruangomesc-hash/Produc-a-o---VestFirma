import { inicioContagemEtapa } from './historicoEtapa'
import type { OrderCard } from './types'

/** Prazo máximo na etapa (horas). null = sem contagem. */
const SLA_HORAS_POR_ID: Record<string, number> = {
  'preview-em-andamento': 24,
  'logos-recebidas': 24,
  'logos-producao': 24,
  'logos-prontas': 24,
  'disponiveis-aplicacao': 6,
  'em-aplicacao': 4,
}

const SLA_HORAS_POR_TITULO: Record<string, number> = {
  'preview em andamento': 24,
  'logos recebidas': 24,
  'logos liberadas para producao': 24,
  'logos em producao': 24,
  'logos prontas': 24,
  'disponiveis para aplicacao': 6,
  'em aplicacao': 4,
}

const PISCAR_POR_ID = new Set(['liberado-logistica'])

const PISCAR_TITULO_CHAVE = 'liberado para logistica'

const ENVIADO_POR_ID = new Set(['pedido-enviado'])
const ENVIADO_TITULO_CHAVE = 'pedido enviado'

const CANCELADOS_POR_ID = new Set(['cancelados-expirados'])
const CANCELADOS_TITULO_CHAVE = 'pedidos cancelados / expirados'

function tituloChave(title: string) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function slaHorasEtapa(columnId: string, columnTitle: string): number | null {
  if (columnId in SLA_HORAS_POR_ID) return SLA_HORAS_POR_ID[columnId]
  const key = tituloChave(columnTitle)
  return SLA_HORAS_POR_TITULO[key] ?? null
}

export function etapaDevePiscar(columnId: string, columnTitle: string): boolean {
  if (PISCAR_POR_ID.has(columnId)) return true
  return tituloChave(columnTitle) === PISCAR_TITULO_CHAVE
}

export function etapaPedidoEnviado(columnId: string, columnTitle: string): boolean {
  if (ENVIADO_POR_ID.has(columnId)) return true
  return tituloChave(columnTitle) === ENVIADO_TITULO_CHAVE
}

/** Selo WPP: da Preview em andamento até logística. Pedido feito usa Solicitar logo. */
export function etapaMostraSeloWpp(columnId: string, columnTitle: string): boolean {
  if (columnId === 'pedido-feito' || tituloChave(columnTitle) === 'pedido feito') return false
  if (etapaPedidoEnviado(columnId, columnTitle)) return false
  if (etapaCanceladosExpirados(columnId, columnTitle)) return false
  return true
}

export function etapaCanceladosExpirados(columnId: string, columnTitle: string): boolean {
  if (CANCELADOS_POR_ID.has(columnId)) return true
  const key = tituloChave(columnTitle)
  return (
    key === CANCELADOS_TITULO_CHAVE ||
    key === 'pedidos cancelados / expirados' ||
    (key.includes('cancelado') && key.includes('expir'))
  )
}

function parseInstanteEtapa(iso: string): number {
  const trimmed = iso.trim()
  if (!trimmed) return NaN
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00`).getTime()
  }
  return new Date(trimmed).getTime()
}

function formatRestante(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000))
  if (totalMin < 60) {
    return `${totalMin} min restante${totalMin === 1 ? '' : 's'}`
  }
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (m === 0) return `${h}h restante${h === 1 ? '' : 's'}`
  return `${h}h ${m}min restantes`
}

export type EtapaPrazoUi =
  | { tipo: 'nenhum' }
  | { tipo: 'prazo'; atrasado: boolean; texto: string }
  | { tipo: 'logistica' }
  | { tipo: 'enviado' }
  | { tipo: 'cancelados' }

export type EtapaPrazoCardRef = Pick<OrderCard, 'columnId' | 'etapaDesde' | 'historicoEtapa'>

export function calcularEtapaPrazo(
  columnId: string,
  columnTitle: string,
  card: EtapaPrazoCardRef,
  agora = Date.now(),
): EtapaPrazoUi {
  if (etapaPedidoEnviado(columnId, columnTitle)) {
    return { tipo: 'enviado' }
  }

  if (etapaCanceladosExpirados(columnId, columnTitle)) {
    return { tipo: 'cancelados' }
  }

  if (etapaDevePiscar(columnId, columnTitle)) {
    return { tipo: 'logistica' }
  }

  const horas = slaHorasEtapa(columnId, columnTitle)
  if (!horas) return { tipo: 'nenhum' }

  const etapaDesde = inicioContagemEtapa({ ...card, columnId })
  const inicio = parseInstanteEtapa(etapaDesde)
  if (Number.isNaN(inicio)) return { tipo: 'nenhum' }

  const limite = inicio + horas * 3_600_000
  const restante = limite - agora

  if (restante <= 0) {
    return { tipo: 'prazo', atrasado: true, texto: 'Atrasado' }
  }

  return {
    tipo: 'prazo',
    atrasado: false,
    texto: formatRestante(restante),
  }
}

export type ResumoPrazosColuna = {
  temContagemPrazo: boolean
  noPrazo: number
  atrasado: number
}

export function resumirPrazosColuna(
  columnId: string,
  columnTitle: string,
  cards: EtapaPrazoCardRef[],
  agora = Date.now(),
): ResumoPrazosColuna {
  if (
    etapaDevePiscar(columnId, columnTitle) ||
    etapaPedidoEnviado(columnId, columnTitle) ||
    etapaCanceladosExpirados(columnId, columnTitle) ||
    slaHorasEtapa(columnId, columnTitle) == null
  ) {
    return { temContagemPrazo: false, noPrazo: 0, atrasado: 0 }
  }

  let noPrazo = 0
  let atrasado = 0
  for (const card of cards) {
    const prazo = calcularEtapaPrazo(columnId, columnTitle, card, agora)
    if (prazo.tipo !== 'prazo') continue
    if (prazo.atrasado) atrasado += 1
    else noPrazo += 1
  }

  return { temContagemPrazo: true, noPrazo, atrasado }
}
