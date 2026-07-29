import { useState } from 'react'
import { formatarDataHora } from '../historicoEtapa'
import {
  introVisibilidadeComentarios,
  ordenarComentariosPedido,
  placeholderNovoComentario,
  rotuloAutorComentario,
  type ComentarioAutor,
} from '../pedidoComentarios'
import type { PedidoComentario } from '../types'

type Props = {
  comentarios: PedidoComentario[]
  onAdd?: (texto: string) => void
  comentarioAutor?: ComentarioAutor | null
  podeComentar?: boolean
  layout?: 'default' | 'aside'
}

export function CardComentariosSection({
  comentarios,
  onAdd,
  comentarioAutor = null,
  layout = 'default',
  podeComentar = true,
}: Props) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(true)
  const ordered = ordenarComentariosPedido(comentarios)

  const enviar = () => {
    const texto = draft.trim()
    if (!texto || !onAdd) return
    onAdd(texto)
    setDraft('')
  }

  const intro = introVisibilidadeComentarios(comentarioAutor?.role)
  const placeholder = comentarioAutor
    ? placeholderNovoComentario(comentarioAutor)
    : 'Escreva aqui — atualização, atraso, dúvida ou combinação sobre este pedido…'

  const compose =
    podeComentar && onAdd ? (
      <div className="comentarios-compose">
        <label className="comentarios-label">
          <span className="sr-only">Novo comentário</span>
          <textarea
            rows={layout === 'aside' ? 4 : 3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
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
    ) : null

  const list =
    ordered.length > 0 ? (
      <ol className="card-comentarios-list">
        {ordered.map((c) => (
          <li key={c.id} className="card-comentarios-item">
            <div className="card-comentarios-meta">
              <strong className="card-comentarios-autor">{rotuloAutorComentario(c)}</strong>
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
          <p className="field-hint comentarios-intro">{intro}</p>
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
        <p className="field-hint comentarios-intro">{intro}</p>
        {list}
        {compose}
      </details>
    </div>
  )
}
