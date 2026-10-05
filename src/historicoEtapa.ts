import { COLUNA_NOVO_PEDIDO_ID, COLUNA_PEDIDO_FEITO_ID } from './defaultBoard'
import type { BoardState, HistoricoEtapaEntry, OrderCard } from './types'
import { USER_ROLE_LABELS, type UserRole } from './userRoles'
import { getAuditActor } from './auditContext'

function autorHistoricoAtual(): Pick<
  HistoricoEtapaEntry,
  'autorNome' | 'autorEmail' | 'autorRole'
> {
  const actor = getAuditActor()
  if (!actor) return {}
  return {
    autorNome: actor.user,
    autorEmail: actor.email,
    autorRole: actor.role,
  }
}

export function rotuloAutorHistorico(entry: HistoricoEtapaEntry): string | null {
  const role = entry.autorRole ? USER_ROLE_LABELS[entry.autorRole as UserRole] : null
  if (entry.autorNome && role) return `${entry.autorNome} · ${role}`
  if (entry.autorNome) return entry.autorNome
  if (entry.autorEmail) return entry.autorEmail
  return null
}

/** Quando o pedido entrou na coluna atual (histórico ou etapaDesde). */
export function inicioContagemEtapa(
  card: Pick<OrderCard, 'columnId' | 'etapaDesde' | 'historicoEtapa'>,
): string {
  const historico = card.historicoEtapa ?? []
  for (let i = historico.length - 1; i >= 0; i--) {
    const entry = historico[i]
    if (entry.columnId === card.columnId && entry.at) {
      return entry.at
    }
  }
  return card.etapaDesde
}

export function tituloColuna(board: BoardState, columnId: string): string {
  return board.columns.find((c) => c.id === columnId)?.title ?? 'Etapa'
}

function indiceColuna(board: BoardState, columnId: string): number {
  return board.columns.findIndex((c) => c.id === columnId)
}

export function tipoMudancaEtapa(
  board: BoardState,
  fromColumnId: string,
  toColumnId: string,
): 'avancou' | 'voltou' | 'movido' {
  const from = indiceColuna(board, fromColumnId)
  const to = indiceColuna(board, toColumnId)
  if (from < 0 || to < 0 || from === to) return 'movido'
  return to > from ? 'avancou' : 'voltou'
}

export function criarEntradaHistorico(
  tipo: HistoricoEtapaEntry['tipo'],
  board: BoardState,
  columnId: string,
  at = new Date().toISOString(),
  extra?: Pick<HistoricoEtapaEntry, 'fromColumnId' | 'fromColumnTitle'>,
): HistoricoEtapaEntry {
  return {
    id: crypto.randomUUID(),
    tipo,
    columnId,
    columnTitle: tituloColuna(board, columnId),
    at,
    ...extra,
    ...autorHistoricoAtual(),
  }
}

export function registrarCriacaoPedido(
  board: BoardState,
  columnId: string,
  at = new Date().toISOString(),
): HistoricoEtapaEntry[] {
  return [criarEntradaHistorico('criado', board, columnId, at)]
}

export function registrarMudancaEtapa(
  card: OrderCard,
  board: BoardState,
  toColumnId: string,
  at = new Date().toISOString(),
): HistoricoEtapaEntry[] {
  const fromId = card.columnId
  if (fromId === toColumnId) return card.historicoEtapa

  const tipo = tipoMudancaEtapa(board, fromId, toColumnId)
  const entry = criarEntradaHistorico(tipo, board, toColumnId, at, {
    fromColumnId: fromId,
    fromColumnTitle: tituloColuna(board, fromId),
  })

  return [...(card.historicoEtapa ?? []), entry]
}

function buildHistoricoInicial(card: OrderCard, board: BoardState): HistoricoEtapaEntry[] {
  const criadoEm = card.createdAt || card.etapaDesde || new Date().toISOString()
  const colCriacao = COLUNA_NOVO_PEDIDO_ID
  const historico: HistoricoEtapaEntry[] = [
    criarEntradaHistorico('criado', board, colCriacao, criadoEm),
  ]

  const colAtual = card.columnId
  if (colAtual !== colCriacao) {
    const mudancaEm = card.etapaDesde || criadoEm
    historico.push(
      criarEntradaHistorico(
        tipoMudancaEtapa(board, colCriacao, colAtual),
        board,
        colAtual,
        mudancaEm,
        {
          fromColumnId: colCriacao,
          fromColumnTitle: tituloColuna(board, colCriacao),
        },
      ),
    )
  }

  return historico
}

/** Corrige timeline antiga que misturava criação com a etapa atual. */
function corrigirHistoricoLegado(
  historico: HistoricoEtapaEntry[],
  card: OrderCard,
  board: BoardState,
): HistoricoEtapaEntry[] {
  const colCriacao = COLUNA_NOVO_PEDIDO_ID
  const colAtual = card.columnId

  if (historico.length === 1 && historico[0].tipo === 'criado') {
    const unico = historico[0]

    if (unico.columnId === COLUNA_PEDIDO_FEITO_ID) {
      return historico
    }

    if (unico.columnId !== colCriacao && unico.columnId === colAtual) {
      const criadoEm = unico.at || card.createdAt || card.etapaDesde
      const mudancaEm = card.etapaDesde || criadoEm
      return [
        criarEntradaHistorico('criado', board, colCriacao, criadoEm),
        criarEntradaHistorico(
          tipoMudancaEtapa(board, colCriacao, colAtual),
          board,
          colAtual,
          mudancaEm,
          {
            fromColumnId: colCriacao,
            fromColumnTitle: tituloColuna(board, colCriacao),
          },
        ),
      ]
    }

    if (unico.columnId === colCriacao && colAtual !== colCriacao) {
      const mudancaEm = card.etapaDesde || unico.at
      return [
        unico,
        criarEntradaHistorico(
          tipoMudancaEtapa(board, colCriacao, colAtual),
          board,
          colAtual,
          mudancaEm,
          {
            fromColumnId: colCriacao,
            fromColumnTitle: tituloColuna(board, colCriacao),
          },
        ),
      ]
    }
  }

  return historico
}

/** Preenche ou corrige histórico de etapas do pedido. */
export function garantirHistoricoCard(card: OrderCard, board: BoardState): OrderCard {
  if (!card.historicoEtapa?.length) {
    const withHist = { ...card, historicoEtapa: buildHistoricoInicial(card, board) }
    const inicio = inicioContagemEtapa(withHist)
    if (inicio !== withHist.etapaDesde) {
      return { ...withHist, etapaDesde: inicio }
    }
    return withHist
  }

  const corrigido = corrigirHistoricoLegado(card.historicoEtapa, card, board)
  let next = card
  if (corrigido !== card.historicoEtapa) {
    next = { ...next, historicoEtapa: corrigido }
  }

  const inicio = inicioContagemEtapa(next)
  if (inicio && inicio !== next.etapaDesde) {
    return { ...next, etapaDesde: inicio }
  }

  return next
}

export function textoHistorico(entry: HistoricoEtapaEntry): string {
  switch (entry.tipo) {
    case 'criado':
      return 'Pedido criado'
    case 'avancou':
      return `Avançou para ${entry.columnTitle}`
    case 'voltou':
      return entry.fromColumnTitle
        ? `Retornou de ${entry.fromColumnTitle} para ${entry.columnTitle}`
        : `Retornou para ${entry.columnTitle}`
    default:
      return entry.fromColumnTitle
        ? `Movido de ${entry.fromColumnTitle} para ${entry.columnTitle}`
        : `Movido para ${entry.columnTitle}`
  }
}

export function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
