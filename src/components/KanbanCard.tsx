import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { etapaDevePiscar } from '../etapas'
import { rotuloLocalLogo } from '../logoLocal'
import type { BoardState, OrderCard } from '../types'
import { nomeSegmento, nomeVendedor } from '../types'
import { EtapaPrazoBadge } from './EtapaPrazoBadge'
import { CardHistoricoTimeline } from './CardHistoricoTimeline'

function formatDate(value: string) {
  if (!value) return '—'
  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('pt-BR')
  }
  const [y, m, d] = value.split('-')
  if (y && m && d) return `${d}/${m}/${y}`
  return value
}

function whatsappHref(numero: string) {
  const digits = numero.replace(/\D/g, '')
  if (!digits) return '#'
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${withCountry}`
}

function CardLogoBlock({
  label,
  src,
  emptyText,
}: {
  label: string
  src: string | null
  emptyText: string
}) {
  return (
    <div className="card-logo-block">
      <span className="card-logo-label">{label}</span>
      <div className={`card-logo ${src ? '' : 'card-logo-empty'}`}>
        {src ? <img src={src} alt="" /> : emptyText}
      </div>
    </div>
  )
}

type Props = {
  card: OrderCard
  board: BoardState
  columnTitle: string
  onEdit: () => void
  onArchive?: () => void
}

export function KanbanCard({ card, board, columnTitle, onEdit, onArchive }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
  }

  const vendedor = nomeVendedor(board, card.vendedorId)
  const segmento = nomeSegmento(board, card.segmentoId)
  const localLogo = rotuloLocalLogo(card.localLogo)
  const piscar = etapaDevePiscar(card.columnId, columnTitle)
  const [expanded, setExpanded] = useState(false)

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`kanban-card ${isDragging ? 'dragging' : ''} ${piscar ? 'card-logistica-piscando' : ''} ${expanded ? 'kanban-card--expanded' : 'kanban-card--collapsed'}`}
    >
      <div className="card-drag-header" {...listeners} {...attributes} title="Arrastar pedido">
        <EtapaPrazoBadge
          columnId={card.columnId}
          columnTitle={columnTitle}
          etapaDesde={card.etapaDesde}
        />
        <span className="drag-dots" aria-hidden />
      </div>

      {!expanded ? (
        <button
          type="button"
          className="card-collapsed-hit"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-label={`Expandir pedido ${card.numeroPedido} de ${card.cliente}`}
        >
          <CardLogoBlock
            label="Logo enviada pelo cliente"
            src={card.logoEnviadaCliente}
            emptyText="Sem logo do cliente"
          />
          <p className="card-collapsed-caption">
            <strong>{card.cliente}</strong>
            <span className="card-collapsed-sep">·</span>
            Pedido {card.numeroPedido}
            <span className="card-collapsed-sep">·</span>
            {card.quantidade} peças
          </p>
          <span className="card-collapsed-cta">Toque para expandir</span>
        </button>
      ) : (
        <>
          <div className="card-logos">
            <CardLogoBlock
              label="Logo enviada pelo cliente"
              src={card.logoEnviadaCliente}
              emptyText="Sem logo do cliente"
            />
            <CardLogoBlock
              label="Logo pronta para impressão"
              src={card.logoProntaImpressao}
              emptyText="Aguardando arte da produção"
            />
          </div>

          <div className="card-body">
            <div className="card-top">
              <h3>{card.cliente}</h3>
              <span className={`badge canal-${card.canal}`}>
                {card.canal === 'whatsapp' ? 'WhatsApp' : 'E-commerce'}
              </span>
            </div>
            <p className="card-meta">
              <strong>Pedido</strong> {card.numeroPedido} · <strong>{card.quantidade}</strong> peças
            </p>
            {localLogo && (
              <p className="card-meta">
                <strong>Local da logo</strong>{' '}
                <span className="card-local-logo">{localLogo}</span>
              </p>
            )}
            {vendedor && (
              <p className="card-meta">
                <strong>Vendedor</strong> {vendedor}
              </p>
            )}
            {segmento && (
              <p className="card-meta">
                <strong>Segmento</strong> {segmento}
              </p>
            )}
            {card.whatsappCliente.trim() && (
              <p className="card-meta">
                <strong>WhatsApp</strong>{' '}
                <a className="card-whatsapp" href={whatsappHref(card.whatsappCliente)}>
                  {card.whatsappCliente}
                </a>
              </p>
            )}
            {card.endereco && <p className="card-address">{card.endereco}</p>}
            <p className="card-dates">
              Pedido: {formatDate(card.dataPedido)}
              {card.dataPagamento ? ` · Pago: ${formatDate(card.dataPagamento)}` : ''}
            </p>
            <CardHistoricoTimeline entries={card.historicoEtapa} />
          </div>

          <div className="card-actions">
            <button type="button" className="btn-text" onClick={() => setExpanded(false)}>
              Recolher
            </button>
            <button type="button" className="btn-text" onClick={onEdit}>
              Editar
            </button>
            {onArchive ? (
              <button type="button" className="btn-text" onClick={onArchive}>
                Arquivar
              </button>
            ) : null}
          </div>
        </>
      )}
    </article>
  )
}
