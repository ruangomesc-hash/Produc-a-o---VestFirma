import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useState } from 'react'
import { calcularEtapaPrazo, etapaDevePiscar } from '../etapas'
import { useRelogioPrazo } from '../hooks/useRelogioPrazo'
import { pedidoFaltaLogo } from '../pedidoShopify'
import { abrirWhatsAppSeloWpp, linkWhatsAppSeloLogo } from '../whatsappRedirect'
import { rotuloLocalLogo } from '../logoLocal'
import { primeiraImagemPedido } from '../pedidoImagens'
import { quantidadeExibidaComResumo, textoResumoPedido } from '../pedidoResumo'
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

function pararArrasteCard(e: { stopPropagation: () => void }) {
  e.stopPropagation()
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
  highlighted?: boolean
  onEdit: () => void
  onArchive?: () => void
}

export function KanbanCard({ card, board, columnTitle, highlighted = false, onEdit, onArchive }: Props) {
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
  const faltaLogo = pedidoFaltaLogo(card)
  const linkLogo = faltaLogo ? linkWhatsAppSeloLogo(card) : null
  const agora = useRelogioPrazo()
  const prazo = calcularEtapaPrazo(card.columnId, columnTitle, card, agora)
  const atrasado = prazo.tipo === 'prazo' && prazo.atrasado
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (highlighted) setExpanded(true)
  }, [highlighted])
  const qtdComentarios = (card.comentarios ?? []).length
  const observacao = card.observacao?.trim() ?? ''
  const totalPecas = quantidadeExibidaComResumo(card)
  const produtosResumo = textoResumoPedido(card)
  const logoClientePreview = primeiraImagemPedido(card.logoEnviadaCliente)

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-pedido-id={card.id}
      className={`kanban-card ${isDragging ? 'dragging' : ''} ${piscar ? 'card-logistica-piscando' : ''} ${faltaLogo ? 'card-falta-logo-piscando' : ''} ${expanded ? 'kanban-card--expanded' : 'kanban-card--collapsed'} ${qtdComentarios > 0 ? 'kanban-card--has-comentarios' : ''} ${highlighted ? 'kanban-card--search-highlight' : ''}`}
    >
      <div className="card-drag-header" {...listeners} {...attributes} title="Arraste para mover. No celular e no tablet, segure um segundo.">
        <div className="card-drag-badges">
          <EtapaPrazoBadge
            columnId={card.columnId}
            columnTitle={columnTitle}
            card={card}
          />
          {faltaLogo ? (
            <a
              className="card-falta-logo-tag"
              href={linkLogo?.ok ? linkLogo.url : undefined}
              target="_blank"
              rel="noopener noreferrer"
              title="Solicitar logo no WhatsApp do cliente"
              onPointerDown={pararArrasteCard}
              onMouseDown={pararArrasteCard}
              onTouchStart={pararArrasteCard}
              onClick={(e) => {
                e.stopPropagation()
                const linked = linkLogo ?? linkWhatsAppSeloLogo(card)
                if (!linked.ok) {
                  e.preventDefault()
                  window.alert(linked.error)
                }
              }}
            >
              Solicitar logo
            </a>
          ) : null}
          {atrasado ? (
            <button
              type="button"
              className="card-wpp-tag"
              title="Avisar o cliente no WhatsApp — pedido atrasado nesta etapa"
              onPointerDown={pararArrasteCard}
              onMouseDown={pararArrasteCard}
              onTouchStart={pararArrasteCard}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const result = abrirWhatsAppSeloWpp(card, columnTitle)
                if (!result.ok) window.alert(result.error)
              }}
            >
              WPP
            </button>
          ) : null}
          {card.origem === 'shopify' ? (
            <span className="card-shopify-tag" title={card.shopifyOrderName || 'Shopify'}>
              Shopify
            </span>
          ) : null}
          {card.shopifyPedidoStatus === 'cancelado' ? (
            <span className="card-cancelado-tag" title="Cancelado na Shopify">
              Cancelado
            </span>
          ) : null}
          {card.shopifyPedidoStatus === 'expirado' ? (
            <span className="card-expirado-tag" title="Não pago ou expirado na Shopify">
              Expirado
            </span>
          ) : null}
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
        <div className="card-collapsed-preview">
          <button
            type="button"
            className="card-collapsed-hit"
            onClick={onEdit}
            aria-label={`Abrir resumo do pedido ${card.numeroPedido} de ${card.cliente}`}
          >
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
                {totalPecas} peças
                {qtdComentarios > 0 ? (
                  <>
                    <span className="card-collapsed-sep">·</span>
                    <span className="card-comentarios-tag card-comentarios-tag--inline">
                      Comentário{qtdComentarios === 1 ? '' : 's'}
                    </span>
                  </>
                ) : null}
              </p>
              <span className="card-collapsed-cta">Toque para abrir</span>
            </div>
          </button>
          <button
            type="button"
            className="card-collapsed-expand"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(true)
            }}
          >
            Expandir
          </button>
        </div>
      ) : (
        <>
          <div
            className="card-expanded-main"
            onClick={(e) => {
              const el = e.target as HTMLElement
              if (el.closest('a, button, input, textarea, select, summary')) return
              onEdit()
            }}
          >
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
              <strong>Pedido</strong> {card.numeroPedido} · <strong>{totalPecas}</strong> peças
            </p>
            {produtosResumo ? (
              <p className="card-meta card-produtos-resumo">
                <strong>Produtos</strong> {produtosResumo}
              </p>
            ) : null}
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
