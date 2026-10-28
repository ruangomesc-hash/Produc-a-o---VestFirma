import { useMemo, type CSSProperties } from 'react'
import { resolveCardColumnId } from '../boardColumns'
import { etapaDevePiscar, resumirPrazosColuna } from '../etapas'
import { useRelogioPrazo } from '../hooks/useRelogioPrazo'
import { pedidoVisivelNoKanban } from '../pedidosPolicy'
import type { BoardState } from '../types'
import type { SessionProfile } from '../userRoles'

type Props = {
  board: BoardState
  session?: SessionProfile | null
  tvMode?: boolean
  onExitTv?: () => void
}

const TRILHA_VISAO = 60
const COLUNAS_VISAO_RODAPE = new Set(['liberado-logistica', 'pedido-enviado', 'cancelados-expirados'])

/** Em tela larga: duas linhas, a de baixo leva a sobra, sem vão na grade. */
function spansVisaoTv(total: number): number[] {
  if (total <= 0) return []
  const linhas = total <= 4 ? 1 : 2
  const base = Math.floor(total / linhas)
  const sobra = total % linhas
  const contagens = Array.from({ length: linhas }, (_, i) => base + (i >= linhas - sobra ? 1 : 0))
  return contagens.flatMap((qtd) => {
    const span = Math.floor(TRILHA_VISAO / qtd)
    const resto = TRILHA_VISAO - span * qtd
    return Array.from({ length: qtd }, (_, i) => span + (i < resto ? 1 : 0))
  })
}

const TEMA_POR_COLUNA: Record<string, string> = {
  'pedido-feito': 'visao-card--pedido-feito',
  'preview-em-andamento': 'visao-card--preview',
  'logos-recebidas': 'visao-card--recebidas',
  'logos-producao': 'visao-card--producao',
  'logos-prontas': 'visao-card--prontas',
  'disponiveis-aplicacao': 'visao-card--disponiveis',
  'em-aplicacao': 'visao-card--aplicacao',
  'liberado-logistica': 'visao-card--logistica visao-card--wide',
  'pedido-enviado': 'visao-card--enviado visao-card--wide',
  'cancelados-expirados': 'visao-card--cancelados visao-card--wide',
}

export function VisaoGeralPanel({ board, session = null, tvMode = false, onExitTv }: Props) {
  const agora = useRelogioPrazo()
  const escopoVendedor = session?.role === 'vendedor'

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, typeof board.cards>()
    for (const col of board.columns) map.set(col.id, [])
    for (const card of board.cards) {
      if (!pedidoVisivelNoKanban(card)) continue
      const columnId = resolveCardColumnId(board, card)
      if (!columnId) continue
      map.get(columnId)!.push(
        columnId === card.columnId ? card : { ...card, columnId },
      )
    }
    return map
  }, [board.columns, board.cards])

  const totais = useMemo(() => {
    let noPrazo = 0
    let atrasado = 0
    let logistica = 0
    for (const col of board.columns) {
      const cards = cardsByColumn.get(col.id) ?? []
      if (etapaDevePiscar(col.id, col.title)) {
        logistica += cards.length
        continue
      }
      const resumo = resumirPrazosColuna(col.id, col.title, cards, agora)
      if (resumo.temContagemPrazo) {
        noPrazo += resumo.noPrazo
        atrasado += resumo.atrasado
      }
    }
    return { noPrazo, atrasado, logistica }
  }, [board.columns, cardsByColumn, agora])

  const fluxo = board.columns.filter((col) => !COLUNAS_VISAO_RODAPE.has(col.id))
  const rodape = board.columns.filter((col) => COLUNAS_VISAO_RODAPE.has(col.id))
  const spansFluxo = spansVisaoTv(fluxo.length)

  const renderCard = (col: (typeof board.columns)[number], span?: number) => {
    const cards = cardsByColumn.get(col.id) ?? []
    const logistica = etapaDevePiscar(col.id, col.title)
    const resumo = resumirPrazosColuna(col.id, col.title, cards, agora)
    const tema = TEMA_POR_COLUNA[col.id] ?? 'visao-card--extra'

    return (
      <article
        key={col.id}
        className={`visao-card ${tema}`}
        style={span ? ({ '--visao-span': String(span) } as CSSProperties) : undefined}
      >
        <h2 className="visao-card-title">{col.title}</h2>
        {logistica ? (
          <div className="visao-card-logistica">
            <span className="visao-metric-value solo">{cards.length}</span>
            <span className="visao-metric-label">Aguardando envio à logística</span>
          </div>
        ) : resumo.temContagemPrazo ? (
          <div className="visao-card-metrics">
            <div className="visao-metric">
              <span className="visao-metric-value">{resumo.noPrazo}</span>
              <span className="visao-metric-label">No prazo</span>
            </div>
            <div className="visao-metric visao-metric--atrasado">
              <span className="visao-metric-value">{resumo.atrasado}</span>
              <span className="visao-metric-label">Atrasado</span>
            </div>
          </div>
        ) : (
          <div className="visao-card-logistica">
            <span className="visao-metric-value solo">{cards.length}</span>
            <span className="visao-metric-label">Pedidos nesta etapa</span>
          </div>
        )}
      </article>
    )
  }

  return (
    <div className={`visao-geral ${tvMode ? 'visao-geral--tv' : ''}`}>
      {tvMode && (
        <header className="visao-tv-logo-bar">
          <div className="visao-tv-logo-bar-spacer" aria-hidden />
          <div className="visao-tv-logo-bar-brand">
            <img
              src={`${import.meta.env.BASE_URL}vestfirma-logo.png`}
              alt="VestFirma"
              className="visao-tv-logo"
            />
          </div>
          <div className="visao-tv-logo-bar-actions">
            <button type="button" className="visao-tv-exit" onClick={onExitTv}>
              Sair do modo TV
            </button>
          </div>
        </header>
      )}
      <div className="visao-geral-inner">
        <header className="visao-geral-top">
          <div className="visao-geral-brand">
            <h1 className="visao-geral-title">Visão geral</h1>
            {escopoVendedor ? (
              <p className="visao-equipe-sub">Seus pedidos no fluxo — igual ao kanban (sem arquivados).</p>
            ) : (
              <p className="visao-equipe-sub">Totais do quadro em tempo real — sem pedidos arquivados.</p>
            )}
          </div>
          <div className="visao-geral-totais">
            <span className="visao-total-pill no-prazo">{totais.noPrazo} no prazo</span>
            <span className="visao-total-pill atrasado">
              {totais.atrasado} atrasado{totais.atrasado === 1 ? '' : 's'}
            </span>
            {totais.logistica > 0 && (
              <span className="visao-total-pill logistica">
                {totais.logistica} aguardando logística
              </span>
            )}
          </div>
        </header>

        <div className="visao-board">
          <div className="visao-grid visao-grid--fluxo">
            {fluxo.map((col, index) => renderCard(col, spansFluxo[index]))}
          </div>
          {rodape.length > 0 && (
            <div className="visao-grid visao-grid--fechamento">
              {rodape.map((col) => renderCard(col))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
