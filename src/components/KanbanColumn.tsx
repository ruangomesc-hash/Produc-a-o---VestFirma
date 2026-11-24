import { useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import { COLUNA_NOVO_PEDIDO_ID, COLUNA_PEDIDO_FEITO_ID, COLUNA_PREVIEW_EM_ANDAMENTO_ID } from '../defaultBoard'
import { COLUNA_CANCELADOS_EXPIRADOS_ID, COLUNA_PEDIDO_ENVIADO_ID } from '../boardColumns'
import { COLUNA_CONTROLE_QUALIDADE_ID, textoMarcaControleQualidade, type MarcaControleQualidade } from '../controleQualidade'
import { etapaCanceladosExpirados, etapaDevePiscar, etapaPedidoEnviado, resumirPrazosColuna } from '../etapas'
import { useRelogioPrazo } from '../hooks/useRelogioPrazo'
import type { BoardState, Column as ColumnType, OrderCard } from '../types'
import { ConfirmModal } from './ConfirmModal'
import { KanbanCard } from './KanbanCard'

type Props = {
  column: ColumnType
  board: BoardState
  cards: OrderCard[]
  canDelete: boolean
  onAddCard: () => void
  onEditCard: (card: OrderCard) => void
  onRequestArchiveCard: (card: OrderCard) => void
  canArchivePedidos?: boolean
  onDeleteColumn: (columnId: string, deleteCards: boolean) => void
  onMarcarControle?: (cardId: string, marca: MarcaControleQualidade) => void
  onAprovarControle?: (cardId: string) => void
  highlightPedidoId?: string | null
}

export function KanbanColumn({
  column,
  board,
  cards,
  canDelete,
  onAddCard,
  onEditCard,
  onRequestArchiveCard,
  canArchivePedidos = false,
  onDeleteColumn,
  onMarcarControle,
  onAprovarControle,
  highlightPedidoId = null,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const agora = useRelogioPrazo()

  const handleConfirmDeleteColumn = () => {
    onDeleteColumn(column.id, false)
    setConfirmDeleteOpen(false)
  }

  const colunaLogistica = etapaDevePiscar(column.id, column.title)
  const colunaEnviado =
    column.id === COLUNA_PEDIDO_ENVIADO_ID || etapaPedidoEnviado(column.id, column.title)
  const colunaCancelados =
    column.id === COLUNA_CANCELADOS_EXPIRADOS_ID || etapaCanceladosExpirados(column.id, column.title)
  const resumoPrazos = resumirPrazosColuna(column.id, column.title, cards, agora)

  const colunaQualidade = column.id === COLUNA_CONTROLE_QUALIDADE_ID
  const gruposQualidade = colunaQualidade
    ? [
        {
          id: 'analise',
          titulo: 'Em análise',
          lista: cards.filter((card) => !card.controleQualidade),
        },
        {
          id: 'reprovado',
          titulo: textoMarcaControleQualidade('reprovado'),
          lista: cards.filter((card) => card.controleQualidade === 'reprovado'),
        },
        {
          id: 'retrabalho',
          titulo: textoMarcaControleQualidade('retrabalho'),
          lista: cards.filter((card) => card.controleQualidade === 'retrabalho'),
        },
      ]
    : null

  const destinoTitulo = board.columns.find((c) => c.id !== column.id)?.title ?? 'a primeira etapa'
  const deleteMessage =
    cards.length > 0
      ? `A etapa “${column.title}” será removida. ${cards.length} pedido${cards.length === 1 ? '' : 's'} será${cards.length === 1 ? '' : 'ão'} movido${cards.length === 1 ? '' : 's'} para “${destinoTitulo}”.`
      : `A etapa “${column.title}” será removida do quadro.`

  const renderCard = (card: OrderCard) => (
    <KanbanCard
      key={card.id}
      card={card}
      board={board}
      columnTitle={column.title}
      highlighted={highlightPedidoId === card.id}
      onEdit={() => onEditCard(card)}
      onArchive={canArchivePedidos ? () => onRequestArchiveCard(card) : undefined}
      onMarcarControle={
        colunaQualidade && onMarcarControle
          ? (marca) => onMarcarControle(card.id, marca)
          : undefined
      }
      onAprovarControle={
        colunaQualidade && onAprovarControle ? () => onAprovarControle(card.id) : undefined
      }
    />
  )

  return (
    <section
      className={`kanban-column ${isOver ? 'over' : ''} ${colunaLogistica ? 'column-logistica' : ''} ${colunaEnviado ? 'column-pedido-enviado' : ''} ${colunaCancelados ? 'column-cancelados-expirados' : ''} ${colunaQualidade ? 'column-controle-qualidade' : ''} ${column.id === COLUNA_PEDIDO_FEITO_ID ? 'column-pedido-feito' : ''} ${column.id === COLUNA_PREVIEW_EM_ANDAMENTO_ID ? 'column-preview-andamento' : ''}`}
    >
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Excluir coluna?"
        message={`${deleteMessage} Tem certeza de que deseja continuar?`}
        confirmLabel="Sim, excluir coluna"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDeleteColumn}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <header className="column-header">
        <div>
          {colunaLogistica && <span className="column-logistica-badge">Prioridade logística</span>}
          {colunaEnviado && <span className="column-enviado-badge">Concluídos</span>}
          {colunaCancelados && <span className="column-cancelados-badge">Cancelados / expirados</span>}
          <h2>{column.title}</h2>
          {colunaQualidade ? (
            <span className="column-count">Aprovado segue para Disponíveis para aplicação</span>
          ) : colunaLogistica ? (
            <span className="column-count">{cards.length} pedidos aguardando</span>
          ) : colunaEnviado ? (
            <span className="column-count">{cards.length} enviado{cards.length === 1 ? '' : 's'}</span>
          ) : colunaCancelados ? (
            <span className="column-count">
              {cards.length} pedido{cards.length === 1 ? '' : 's'} — arquivar se quiser ocultar
            </span>
          ) : resumoPrazos.temContagemPrazo ? (
            <div className="column-prazo-resumo" aria-label="Resumo de prazos na coluna">
              <span className="column-prazo-stat no-prazo">
                {resumoPrazos.noPrazo} no prazo
              </span>
              <span className="column-prazo-stat atrasado">
                {resumoPrazos.atrasado} atrasado{resumoPrazos.atrasado === 1 ? '' : 's'}
              </span>
            </div>
          ) : (
            <span className="column-count">{cards.length}</span>
          )}
        </div>
        <div className="column-header-actions">
          {canDelete && !colunaCancelados ? (
            <button
              type="button"
              className="icon-btn small column-delete-btn"
              title="Excluir coluna"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Excluir
            </button>
          ) : null}
        </div>
      </header>

      <div ref={setNodeRef} className="column-cards">
        {gruposQualidade
          ? gruposQualidade.map((grupo) => (
              <section key={grupo.id} className="cq-grupo">
                <h3 className="cq-grupo-titulo">
                  {grupo.titulo}
                  <span>{grupo.lista.length}</span>
                </h3>
                {grupo.lista.map(renderCard)}
              </section>
            ))
          : cards.map(renderCard)}
      </div>

      {column.id === COLUNA_NOVO_PEDIDO_ID && (
        <button type="button" className="add-card-btn" onClick={onAddCard}>
          + Novo pedido
        </button>
      )}
    </section>
  )
}
