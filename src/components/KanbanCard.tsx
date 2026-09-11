import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { etapaDevePiscar } from '../etapas'
import { rotuloLocalLogo } from '../logoLocal'
import { primeiraImagemPedido } from '../pedidoImagens'
import { rotuloTipoProduto } from '../tiposProduto'
import type { BoardState, OrderCard } from '../types'
import { nomeSegmento, nomeVendedor } from '../types'
import { EtapaPrazoBadge } from './EtapaPrazoBadge'
import { CardHistoricoTimeline } from './CardHistoricoTimeline'
import { ImageActions } from './ImageActions'

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
  srcs,
  emptyText,
  actions = false,
}: {
  label: string
  srcs: string[]
  emptyText: string
  actions?: boolean
}) {
  if (srcs.length === 0) {
    return (
      <div className="card-logo-block">
        <span className="card-logo-label">{label}</span>
        <div className="card-logo card-logo-empty">{emptyText}</div>
      </div>
    )
  }

  return (
    <div className="card-logo-block">
      <span className="card-logo-label">
        {label}
        {srcs.length > 1 ? ` · ${srcs.length} imagens` : ''}
      </span>
      <div className={`card-logo-grid${srcs.length === 1 ? ' card-logo-grid--single' : ''}`}>
        {srcs.map((src, index) => (
          <div key={`${src}-${index}`} className="card-logo-grid-item">
            <div className="card-logo">
              <img src={src} alt={`${label} ${index + 1}`} loading="lazy" />
            </div>
            {actions ? <ImageActions src={src} label={`${label} ${index + 1}`} /> : null}
          </div>
        ))}
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
  const qtdComentarios = (card.comentarios ?? []).length
  const observacao = card.observacao?.trim() ?? ''
  const tipoProduto = rotuloTipoProduto(card.tipoProduto)
  const logoClientePreview = primeiraImagemPedido(card.logoEnviadaCliente)

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`kanban-card ${isDragging ? 'dragging' : ''} ${piscar ? 'card-logistica-piscando' : ''} ${expanded ? 'kanban-card--expanded' : 'kanban-card--collapsed'} ${qtdComentarios > 0 ? 'kanban-card--has-comentarios' : ''}`}
    >
      <div className="card-drag-header" {...listeners} {...attributes} title="Arrastar pedido">
        <div className="card-drag-badges">
          <EtapaPrazoBadge
            columnId={card.columnId}
            columnTitle={columnTitle}
            card={card}
          />
          {qtdComentarios > 0 ? (
            <span
              className="card-comentarios-tag"
              title={`${qtdComentarios} comentário${qtdComentarios === 1 ? '' : 's'} — abra o pedido para ler`}
            >
              Comentário{qtdComentarios === 1 ? '' : 's'} · {qtdComentarios}
            </span>
          ) : null}
        </div>
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
          <div className="card-collapsed-preview">
            <CardLogoBlock
              label="Logo enviada pelo cliente"
              srcs={logoClientePreview ? [logoClientePreview] : []}
              emptyText="Sem logo do cliente"
            />
            <div className="card-collapsed-summary">
              <p className="card-collapsed-caption">
                <strong>{card.cliente}</strong>
                <span className="card-collapsed-sep">·</span>
                Pedido {card.numeroPedido}
                <span className="card-collapsed-sep">·</span>
                {card.quantidade} peças
                {qtdComentarios > 0 ? (
                  <>
                    <span className="card-collapsed-sep">·</span>
                    <span className="card-comentarios-tag card-comentarios-tag--inline">
                      Comentário{qtdComentarios === 1 ? '' : 's'}
                    </span>
                  </>
                ) : null}
              </p>
              <span className="card-collapsed-cta">Toque para expandir</span>
            </div>
          </div>
        </button>
      ) : (
        <>
          <div className="card-logos">
            {card.previewAprovacaoCliente.length > 0 ? (
              <div className="card-approved-preview">
                <CardLogoBlock
                  label="Preview aprovado pelo cliente"
                  srcs={card.previewAprovacaoCliente}
                  emptyText=""
                  actions
                />
                <p className="logo-hint">Referência para aplicar a estampa conforme aprovado.</p>
              </div>
            ) : null}
            <CardLogoBlock
              label="Logo enviada pelo cliente"
              srcs={card.logoEnviadaCliente}
              emptyText="Sem logo do cliente"
              actions
            />
            {card.logoProntaImpressao.length > 0 ? (
              <CardLogoBlock
                label="Logo pronta para impressão"
                srcs={card.logoProntaImpressao}
                emptyText="Aguardando arte da produção"
                actions
              />
            ) : (
              <p className="card-logo-awaiting">Aguardando logo pronta para impressão</p>
            )}
          </div>

          <div className="card-body">
            <div className="card-top">
              <h3>{card.cliente}</h3>
              <div className="card-top-badges">
                {qtdComentarios > 0 ? (
                  <span className="card-comentarios-tag" title="Pedido com comentários / avisos">
                    Comentário{qtdComentarios === 1 ? '' : 's'} · {qtdComentarios}
                  </span>
                ) : null}
                <span className={`badge canal-${card.canal}`}>
                  {card.canal === 'whatsapp' ? 'WhatsApp' : 'E-commerce'}
                </span>
              </div>
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
            {tipoProduto && (
              <p className="card-meta">
                <strong>Produto</strong> {tipoProduto}
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
            {observacao ? (
              <p className="card-meta card-observacao">
                <strong>Observação</strong>
                <span className="card-observacao-texto">{observacao}</span>
              </p>
            ) : null}
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
