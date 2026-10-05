import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { buscarPedidosNoQuadro } from '../pedidoSearch'
import type { BoardState, OrderCard } from '../types'

type Props = {
  board: BoardState
  onLocalizar: (card: OrderCard) => void
  onAbrirFicha: (card: OrderCard) => void
}

export function PedidoSearchBar({ board, onLocalizar, onAbrirFicha }: Props) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const results = useMemo(
    () => buscarPedidosNoQuadro(board, query),
    [board, query],
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [query, results.length])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        if (!query.trim()) setExpanded(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [query])

  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  const pick = (card: OrderCard, abrirFicha: boolean) => {
    if (abrirFicha) onAbrirFicha(card)
    else onLocalizar(card)
    setOpen(false)
    setExpanded(false)
    setQuery('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setExpanded(false)
      return
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter') && results.length > 0) {
      setOpen(true)
      return
    }
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = results[activeIndex]
      if (row) pick(row.card, e.shiftKey)
    }
  }

  const showList = expanded && open && query.trim().length > 0

  return (
    <div className={`pedido-search${expanded ? ' pedido-search--open' : ''}`} ref={rootRef}>
      {!expanded ? (
        <button
          type="button"
          className="pedido-search-toggle"
          aria-label="Pesquisar pedido"
          title="Pesquisar pedido (número, cliente ou empresa)"
          onClick={() => {
            setExpanded(true)
            setOpen(true)
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M15.2 15.2 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      ) : (
        <label className="pedido-search-label" htmlFor={listId}>
          <span className="pedido-search-label-text">Pesquisar pedido</span>
          <div className="pedido-search-field">
            <input
              ref={inputRef}
              id={listId}
              type="search"
              className="pedido-search-input"
              placeholder="Nº, cliente ou empresa…"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => {
                if (query.trim()) setOpen(true)
              }}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded={showList}
              aria-controls={`${listId}-list`}
              aria-autocomplete="list"
            />
            {query ? (
              <button
                type="button"
                className="pedido-search-clear"
                aria-label="Limpar pesquisa"
                onClick={() => {
                  setQuery('')
                  setOpen(false)
                  inputRef.current?.focus()
                }}
              >
                ×
              </button>
            ) : null}
            <button
              type="button"
              className="pedido-search-clear"
              aria-label="Fechar pesquisa"
              onClick={() => {
                setQuery('')
                setOpen(false)
                setExpanded(false)
              }}
            >
              ×
            </button>
          </div>
        </label>
      )}

      {showList ? (
        <ul
          id={`${listId}-list`}
          className="pedido-search-results"
          role="listbox"
          aria-label="Resultados da pesquisa"
        >
          {results.length === 0 ? (
            <li className="pedido-search-empty" role="option" aria-selected={false}>
              Nenhum pedido encontrado com “{query.trim()}”.
            </li>
          ) : (
            results.map((row, index) => (
              <li key={row.card.id} role="presentation">
                <div
                  className={`pedido-search-result${index === activeIndex ? ' active' : ''}`}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    className="pedido-search-result-main"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => pick(row.card, false)}
                  >
                    <span className="pedido-search-result-title">
                      <strong>{row.card.cliente}</strong>
                      <span className="pedido-search-result-num">Pedido {row.card.numeroPedido}</span>
                    </span>
                    <span className="pedido-search-result-meta">
                      {row.segmento} · {row.etapa}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn ghost small pedido-search-open-btn"
                    onClick={() => pick(row.card, true)}
                  >
                    Abrir ficha
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
