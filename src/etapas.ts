/** Prazo máximo na etapa (horas). null = sem contagem. */
const SLA_HORAS_POR_ID: Record<string, number> = {
  'logos-recebidas': 24,
  'logos-producao': 24,
  'logos-prontas': 24,
  'disponiveis-aplicacao': 6,
  'em-aplicacao': 4,
}

const SLA_HORAS_POR_TITULO: Record<string, number> = {
  'logos recebidas': 24,
  'logos em producao': 24,
  'logos prontas': 24,
  'disponiveis para aplicacao': 6,
  'em aplicacao': 4,
}

const PISCAR_POR_ID = new Set(['liberado-logistica'])

const PISCAR_TITULO_CHAVE = 'liberado para logistica'

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

function formatRestante(ms: number): string {
  const totalMin = Math.ceil(ms / 60_000)
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

export function calcularEtapaPrazo(
  columnId: string,
  columnTitle: string,
  etapaDesde: string,
  agora = Date.now(),
): EtapaPrazoUi {
  if (etapaDevePiscar(columnId, columnTitle)) {
    return { tipo: 'logistica' }
  }

  const horas = slaHorasEtapa(columnId, columnTitle)
  if (!horas) return { tipo: 'nenhum' }

  const inicio = new Date(etapaDesde).getTime()
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
  cards: { etapaDesde: string }[],
  agora = Date.now(),
): ResumoPrazosColuna {
  if (etapaDevePiscar(columnId, columnTitle) || slaHorasEtapa(columnId, columnTitle) == null) {
    return { temContagemPrazo: false, noPrazo: 0, atrasado: 0 }
  }

  let noPrazo = 0
  let atrasado = 0
  for (const card of cards) {
    const prazo = calcularEtapaPrazo(columnId, columnTitle, card.etapaDesde, agora)
    if (prazo.tipo !== 'prazo') continue
    if (prazo.atrasado) atrasado += 1
    else noPrazo += 1
  }

  return { temContagemPrazo: true, noPrazo, atrasado }
}
