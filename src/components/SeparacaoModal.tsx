import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { pedidoVisivelNoKanban } from '../pedidosPolicy'
import { linhasResumoDoPedido, quantidadeExibidaComResumo } from '../pedidoResumo'
import { ordenarCardsPorNumeroPedido } from '../ordenarCardsKanban'
import { rotuloLocalLogo } from '../logoLocal'
import { textoListaSeparacao, textoOndaSeparacao, resumirPecasSeparacao, type PedidoSeparacaoTexto } from '../separacaoLista'
import type { BoardState, OrderCard } from '../types'
import { nomeSegmento, nomeVendedor } from '../types'

type ModoImpressao = 'pedidos' | 'onda'

const COLUNA_SEPARACAO_PADRAO_ID = 'logos-prontas'

type Props = {
  open: boolean
  board: BoardState
  onClose: () => void
  onImpressa: (cardIds: string[]) => void
}

function quandoAgora() {
  return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function pedidoParaTexto(card: OrderCard): PedidoSeparacaoTexto {
  return {
    numero: card.numeroPedido || 's/n',
    cliente: card.cliente || 'Sem cliente',
    linhas: linhasResumoDoPedido(card),
    observacao: card.observacao?.trim() || undefined,
  }
}

function imagensUteis(lista: string[] | undefined) {
  return (lista ?? []).filter(
    (src) => src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:image'),
  )
}

function FolhaSeparacao({ impressaEm }: { impressaEm?: string | null }) {
  if (!impressaEm) return null
  const quando = new Date(impressaEm)
  const titulo = Number.isNaN(quando.getTime())
    ? 'Lista de separação impressa'
    : `Lista de separação impressa em ${quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
  return (
    <span className="separacao-folha" title={titulo} aria-label={titulo}>
      <FolhaIcone />
    </span>
  )
}

export function FolhaIcone() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="separacao-folha-icone">
      <path
        d="M7 3.5h7.2L19 8.2V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1.5-1.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M14 3.8V8.4h4.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 12.2h6M9 15.4h6M9 18.4h3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function SeparacaoModal({ open, board, onClose, onImpressa }: Props) {
  const [colunaId, setColunaId] = useState(COLUNA_SEPARACAO_PADRAO_ID)
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const [texto, setTexto] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [pacote, setPacote] = useState<OrderCard[] | null>(null)
  const [modo, setModo] = useState<ModoImpressao>('pedidos')
  const [imprimirAoMontar, setImprimirAoMontar] = useState(false)
  const jaAbriu = useRef(false)

  const coluna = board.columns.find((item) => item.id === colunaId) ?? board.columns[0]
  const pedidos = useMemo(() => {
    if (!coluna) return []
    return ordenarCardsPorNumeroPedido(
      board.cards.filter((card) => pedidoVisivelNoKanban(card) && card.columnId === coluna.id),
    )
  }, [board.cards, coluna])

  useEffect(() => {
    if (!open) {
      jaAbriu.current = false
      return
    }
    if (jaAbriu.current) return
    jaAbriu.current = true
    const temPadrao = board.columns.some((item) => item.id === COLUNA_SEPARACAO_PADRAO_ID)
    setColunaId(temPadrao ? COLUNA_SEPARACAO_PADRAO_ID : board.columns[0]?.id || '')
    setEscolhidos([])
    setTexto('')
    setCopiado(false)
    setPacote(null)
    setModo('pedidos')
  }, [open, board.columns])

  useEffect(() => {
    if (!imprimirAoMontar || !pacote?.length) return
    const quadro = requestAnimationFrame(() => {
      window.print()
      setImprimirAoMontar(false)
    })
    return () => cancelAnimationFrame(quadro)
  }, [imprimirAoMontar, pacote])

  if (!open) {
    return pacote?.length && coluna ? (
      <FolhasImpressas board={board} etapa={coluna.title} pedidos={pacote} resumo={texto} modo={modo} />
    ) : null
  }
  if (!coluna) return null

  const alternar = (id: string) => {
    setEscolhidos((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]))
  }

  const todosMarcados = pedidos.length > 0 && pedidos.every((card) => escolhidos.includes(card.id))

  const gerar = (lista: OrderCard[], proximoModo: ModoImpressao) => {
    if (!lista.length) return
    const quando = quandoAgora()
    const pedidosTexto = lista.map((card) => pedidoParaTexto(card))
    const corpo =
      proximoModo === 'onda'
        ? textoOndaSeparacao({ quando, etapa: coluna.title, pedidos: pedidosTexto })
        : textoListaSeparacao({ quando, etapa: coluna.title, pedidos: pedidosTexto })
    setTexto(corpo)
    setCopiado(false)
    setModo(proximoModo)
    setPacote(lista)
    setImprimirAoMontar(true)
    onImpressa(lista.map((card) => card.id))
  }

  const copiar = async () => {
    if (!texto) return
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <>
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
          aria-labelledby="separacao-titulo"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="separacao-modal-topo">
            <h2 id="separacao-titulo">Lista de separação</h2>
            <p>
              A etapa começa em Logos prontas. Imprimir gera cada pedido. Separação em ondas soma o mesmo produto — dos pedidos marcados, ou de todos desta etapa se nenhum estiver marcado.
            </p>
          </header>
          <div className="separacao-modal-corpo">
            <label className="separacao-etapa">
              Etapa
              <select value={coluna.id} onChange={(event) => { setColunaId(event.target.value); setEscolhidos([]) }}>
                {board.columns.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
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
                pedidos.map((card) => (
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
                          {quantidadeExibidaComResumo(card)} peça{quantidadeExibidaComResumo(card) === 1 ? '' : 's'}
                          {linhasResumoDoPedido(card).length
                            ? ` · ${linhasResumoDoPedido(card)
                                .map((item) => `${item.quantidade}× ${item.titulo}${item.detalhe ? ` (${item.detalhe})` : ''}`)
                                .join(', ')}`
                            : ''}
                        </small>
                      </span>
                      <FolhaSeparacao impressaEm={card.separacaoImpressaEm} />
                    </label>
                  </li>
                ))
              )}
            </ul>
            {texto ? (
              <div className="separacao-copia">
                <label htmlFor="separacao-texto">Texto para colar no WhatsApp</label>
                <textarea id="separacao-texto" readOnly value={texto} rows={8} />
                <button type="button" className="btn secondary small" onClick={() => void copiar()}>
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
                <p>Na janela de impressão, escolha salvar como PDF.</p>
              </div>
            ) : null}
          </div>
          <footer className="separacao-modal-acoes">
            <button type="button" className="btn ghost" onClick={onClose}>
              Fechar
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={escolhidos.length === 0}
              onClick={() => gerar(pedidos.filter((card) => escolhidos.includes(card.id)), 'pedidos')}
            >
              Imprimir selecionados
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={pedidos.length === 0}
              onClick={() => gerar(pedidos, 'pedidos')}
            >
              Imprimir todos
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={(escolhidos.length ? escolhidos.length : pedidos.length) === 0}
              onClick={() =>
                gerar(
                  escolhidos.length ? pedidos.filter((card) => escolhidos.includes(card.id)) : pedidos,
                  'onda',
                )
              }
            >
              Separação em ondas
            </button>
          </footer>
        </div>
      </div>
      {pacote?.length ? (
        <FolhasImpressas board={board} etapa={coluna.title} pedidos={pacote} resumo={texto} modo={modo} />
      ) : null}
    </>
  )
}

function FolhasImpressas({
  board,
  etapa,
  pedidos,
  resumo,
  modo,
}: {
  board: BoardState
  etapa: string
  pedidos: OrderCard[]
  resumo: string
  modo: ModoImpressao
}) {
  const pecas = resumirPecasSeparacao(pedidos.map((card) => pedidoParaTexto(card)))
  const folha = (
    <div className="separacao-print" id="separacao-print" aria-hidden="true">
      {modo === 'onda' ? (
        <section className="separacao-print-onda">
          <h1>Separação em ondas</h1>
          <p>{etapa}</p>
          <p>
            {pedidos.length} pedido{pedidos.length === 1 ? '' : 's'} · {pecas.reduce((soma, item) => soma + item.quantidade, 0)} peças
          </p>
          {pecas.length ? (
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {pecas.map((item) => (
                  <tr key={`${item.titulo}-${item.detalhe || ''}`}>
                    <td>
                      {item.titulo}
                      {item.detalhe ? ` ${item.detalhe}` : ''}
                    </td>
                    <td>{item.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Sem peças informadas nos pedidos.</p>
          )}
        </section>
      ) : (
        <>
      <section className="separacao-print-capa">
        <h1>Lista de separação</h1>
        <p>{etapa}</p>
        <pre>{resumo}</pre>
      </section>
      {pedidos.map((card) => {
        const linhas = linhasResumoDoPedido(card)
        const logos = [
          ['Logo enviada pelo cliente', imagensUteis(card.logoEnviadaCliente)],
          ['Logo pronta para impressão', imagensUteis(card.logoProntaImpressao)],
          ['Preview aprovado', imagensUteis(card.previewAprovacaoCliente)],
        ] as const
        return (
          <article key={card.id} className="separacao-print-pedido">
            <h2>Pedido #{card.numeroPedido || 's/n'}</h2>
            <p>{card.cliente} · {etapa}</p>
            <dl>
              <div><dt>Peças</dt><dd>{quantidadeExibidaComResumo(card)}</dd></div>
              <div><dt>Vendedor</dt><dd>{nomeVendedor(board, card.vendedorId) || '—'}</dd></div>
              <div><dt>Segmento</dt><dd>{nomeSegmento(board, card.segmentoId) || '—'}</dd></div>
              <div><dt>Canal</dt><dd>{card.canal === 'ecommerce' ? 'E-commerce' : 'WhatsApp'}</dd></div>
              <div><dt>WhatsApp</dt><dd>{card.whatsappCliente || '—'}</dd></div>
              <div><dt>Endereço</dt><dd>{card.endereco || '—'}</dd></div>
              <div><dt>Local da logo</dt><dd>{rotuloLocalLogo(card.localLogo) || '—'}</dd></div>
              <div><dt>Pedido em</dt><dd>{card.dataPedido || '—'}</dd></div>
              <div><dt>Pagamento</dt><dd>{card.dataPagamento || '—'}</dd></div>
            </dl>
            <h3>Produtos</h3>
            {linhas.length ? (
              <ul>
                {linhas.map((item, index) => (
                  <li key={`${item.titulo}-${index}`}>
                    {item.quantidade}× {item.titulo}
                    {item.detalhe ? ` (${item.detalhe})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Sem peças informadas.</p>
            )}
            {card.observacao?.trim() ? (
              <>
                <h3>Observação</h3>
                <p>{card.observacao.trim()}</p>
              </>
            ) : null}
            {(card.comentarios ?? []).length ? (
              <>
                <h3>Comentários</h3>
                <ul>
                  {card.comentarios.map((comentario) => (
                    <li key={comentario.id}>
                      {comentario.autorNome ? `${comentario.autorNome}: ` : ''}
                      {comentario.texto}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {logos.map(([titulo, srcs]) =>
              srcs.length ? (
                <div key={titulo}>
                  <h3>{titulo}</h3>
                  <div className="separacao-print-logos">
                    {srcs.map((src) => (
                      <img key={src.slice(0, 80)} src={src} alt={titulo} />
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </article>
        )
      })}
        </>
      )}
    </div>
  )
  return createPortal(folha, document.body)
}
