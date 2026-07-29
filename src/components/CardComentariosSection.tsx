import { useState } from 'react'
import { formatarDataHora } from '../historicoEtapa'
import { ordenarComentariosPedido } from '../pedidoComentarios'
import { USER_ROLE_LABELS, type UserRole } from '../userRoles'
import type { PedidoComentario } from '../types'

type Props = {
  comentarios: PedidoComentario[]
  onAdd: (texto: string) => void
  /** Nome exibido no placeholder (quem está comentando). */
  autorNome?: string
  /** Coluna lateral do modal de pedido — sempre visível, sem recolher. */
  layout?: 'default' | 'aside'
}

function rotuloAutor(c: PedidoComentario): string {
  const role = c.autorRole ? USER_ROLE_LABELS[c.autorRole as UserRole] : null
  if (role && c.autorNome) return `${c.autorNome} · ${role}`
  return c.autorNome || c.autorEmail || 'Equipe'
}

export function CardComentariosSection({
  comentarios,
  onAdd,
  autorNome,
  layout = 'default',
}: Props) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(true)
  const ordered = ordenarComentariosPedido(comentarios)

  const enviar = () => {
    const texto = draft.trim()
    if (!texto) return
    onAdd(texto)
    setDraft('')
  }

  const compose = (
    <div className="comentarios-compose">
      <label className="comentarios-label">
        <span className="sr-only">Novo comentário</span>
        <textarea
          rows={layout === 'aside' ? 4 : 3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            autorNome
              ? `${autorNome}: descreva o que mudou ou o motivo do atraso…`
              : 'Descreva o que mudou ou o motivo do atraso…'
          }
          maxLength={4000}
        />
      </label>
      <button
        type="button"
        className="btn ghost comentarios-add-btn"
        disabled={!draft.trim()}
        onClick={enviar}
      >
        Adicionar comentário
      </button>
    </div>
  )

  const list =
    ordered.length > 0 ? (
      <ol className="card-comentarios-list">
        {ordered.map((c) => (
          <li key={c.id} className="card-comentarios-item">
            <div className="card-comentarios-meta">
              <strong className="card-comentarios-autor">{rotuloAutor(c)}</strong>
              <time className="card-comentarios-data" dateTime={c.at}>
                {formatarDataHora(c.at)}
              </time>
            </div>
            <p className="card-comentarios-texto">{c.texto}</p>
          </li>
        ))}
      </ol>
    ) : (
      <p className="comentarios-vazio">Nenhum comentário ainda.</p>
    )

  if (layout === 'aside') {
    return (
      <div
        className={`card-comentarios-aside ${ordered.length > 0 ? 'card-comentarios-aside--has-items' : ''}`}
        aria-labelledby="pedido-comentarios-title"
      >
        <header className="card-comentarios-aside-head">
          <h3 id="pedido-comentarios-title" className="card-comentarios-aside-title">
            Comentários do pedido
            <span className="card-comentarios-count">{ordered.length}</span>
          </h3>
          <p className="field-hint comentarios-intro">
            Avisos, atrasos e alterações — visíveis para toda a equipe.
          </p>
        </header>
        <div className="card-comentarios-aside-scroll">{list}</div>
        {compose}
      </div>
    )
  }

  return (
    <div className="field span-2 modal-comentarios-wrap">
      <details className="card-comentarios" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>Comentários do pedido ({ordered.length})</summary>
        <p className="field-hint comentarios-intro">
          Registre atrasos, alterações ou combinações — todos veem o histórico aqui.
        </p>
        {list}
        {compose}
      </details>
    </div>
  )
}
