import { useEffect, useMemo, useState } from 'react'
import { COLUNA_DISPONIVEIS_APLICACAO_ID } from '../controleQualidade'
import { COLUNA_NOVO_PEDIDO_ID } from '../defaultBoard'
import { ordenarCardsPorNumeroPedido } from '../ordenarCardsKanban'
import { pedidoVisivelNoKanban } from '../pedidosPolicy'
import { quantidadeExibidaComResumo } from '../pedidoResumo'
import type { BoardState, OrderCard } from '../types'
import { PdfProducaoMarca } from './PdfProducaoMarca'

type Props = {
  open: boolean
  colunaId: string
  board: BoardState
  onClose: () => void
  onBaixar: (cards: OrderCard[]) => void
}

export function LogosPdfLoteModal({ open, colunaId, board, onClose, onBaixar }: Props) {
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const aplicacao = colunaId === COLUNA_DISPONIVEIS_APLICACAO_ID
  const etapa = colunaId || COLUNA_NOVO_PEDIDO_ID

  const pedidos = useMemo(
    () =>
      ordenarCardsPorNumeroPedido(
        board.cards.filter((card) => card.columnId === etapa && pedidoVisivelNoKanban(card)),
      ),
    [board.cards, etapa],
  )

  useEffect(() => {
    if (open) setEscolhidos([])
  }, [open])

  if (!open) return null

  const alternar = (id: string) => {
    setEscolhidos((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]))
  }
  const todosMarcados = pedidos.length > 0 && pedidos.every((card) => escolhidos.includes(card.id))

  return (
    <div
      className="modal-backdrop confirm-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="confirm-modal separacao-modal"
        role="dialog"
        aria-labelledby="pdf-lote-titulo"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="separacao-modal-topo">
          <h2 id="pdf-lote-titulo">Baixar PDFs</h2>
          <p>
            {aplicacao
              ? 'Disponíveis para aplicação. Marque os pedidos ou baixe todos. Na impressão, salve como PDF. A ficha traz peça, tamanho, quantidade e a observação.'
              : 'Logos liberadas para produção. Marque os pedidos ou baixe todos. Na impressão, salve como PDF. O card ganha a marca de enviado para produção.'}
          </p>
        </header>
        <div className="separacao-modal-corpo">
          <label className="separacao-linha separacao-linha-todos">
            <input
              type="checkbox"
              checked={todosMarcados}
              onChange={() => setEscolhidos(todosMarcados ? [] : pedidos.map((card) => card.id))}
            />
            <span>Selecionar os {pedidos.length} pedido{pedidos.length === 1 ? '' : 's'} desta etapa</span>
          </label>
          <ul className="separacao-lista">
            {pedidos.length === 0 ? (
              <li className="separacao-vazio">Nenhum pedido nesta etapa.</li>
            ) : (
              pedidos.map((card) => {
                const pecas = quantidadeExibidaComResumo(card)
                return (
                  <li key={card.id}>
                    <label className="separacao-linha">
                      <input
                        type="checkbox"
                        checked={escolhidos.includes(card.id)}
                        onChange={() => alternar(card.id)}
                      />
                      <span>
                        <strong>#{card.numeroPedido || 's/n'}</strong> {card.cliente}
                        <small>
                          {pecas} peça{pecas === 1 ? '' : 's'}
                        </small>
                      </span>
                      <PdfProducaoMarca em={card.pdfProducaoImpressoEm} />
                    </label>
                  </li>
                )
              })
            )}
          </ul>
        </div>
        <footer className="separacao-modal-acoes">
          <button type="button" className="btn ghost" onClick={onClose}>
            Fechar
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={escolhidos.length === 0}
            onClick={() => onBaixar(pedidos.filter((card) => escolhidos.includes(card.id)))}
          >
            Baixar selecionados
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={pedidos.length === 0}
            onClick={() => onBaixar(pedidos)}
          >
            Baixar todos
          </button>
        </footer>
      </div>
    </div>
  )
}
