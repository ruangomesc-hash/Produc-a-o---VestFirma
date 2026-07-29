import { useMemo } from 'react'
import { etapaDevePiscar, resumirPrazosColuna } from '../etapas'
import { useRelogioPrazo } from '../hooks/useRelogioPrazo'
import type { BoardState } from '../types'

type Props = {
  board: BoardState
  tvMode?: boolean
  onExitTv?: () => void
}

const TEMA_POR_COLUNA: Record<string, string> = {
  'logos-recebidas': 'visao-card--recebidas',
  'logos-producao': 'visao-card--producao',
  'logos-prontas': 'visao-card--prontas',
  'disponiveis-aplicacao': 'visao-card--disponiveis',
  'em-aplicacao': 'visao-card--aplicacao',
  'liberado-logistica': 'visao-card--logistica visao-card--wide',
}

export function VisaoGeralPanel({ board, tvMode = false, onExitTv }: Props) {
  const agora = useRelogioPrazo()

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, typeof board.cards>()
    for (const col of board.columns) map.set(col.id, [])
    const fallback = board.columns[0]?.id
    for (const card of board.cards) {
      const columnId = map.has(card.columnId) ? card.columnId : fallback
      if (columnId) map.get(columnId)!.push(card)
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

        <div className="visao-grid">
          {board.columns.map((col) => {
            const cards = cardsByColumn.get(col.id) ?? []
            const logistica = etapaDevePiscar(col.id, col.title)
            const resumo = resumirPrazosColuna(col.id, col.title, cards, agora)
            const tema = TEMA_POR_COLUNA[col.id] ?? 'visao-card--extra'

            return (
              <article key={col.id} className={`visao-card ${tema}`}>
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
          })}
        </div>
      </div>
    </div>
  )
}
