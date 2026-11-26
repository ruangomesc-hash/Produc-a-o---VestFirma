import { useEffect, useMemo, useRef, useState } from 'react'
import {
  hojeNoBrasil,
  periodoDesteMes,
  periodoMesPassado,
  resumirPecasFinanceiro,
  timelinePedidosFinanceiro,
  type DiaFinanceiro,
  type ProdutoFinanceiro,
} from '../financeiroPecas'
import type { BoardState } from '../types'

function dataBr(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}/${ano}`
}

const CORES = ['#f5c400', '#38bdf8', '#fb7185', '#4ade80', '#c084fc', '#fb923c', '#f9a8d4', '#a3e635']

function pecas(n: number) {
  return `${n} ${n === 1 ? 'peça' : 'peças'}`
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function partesDia(iso: string) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const data = new Date(Date.UTC(ano, (mes || 1) - 1, dia || 1))
  const mesCurto = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
    .format(data)
    .replace('.', '')
  return { dia: String(dia || '').padStart(2, '0'), semana: SEMANA[data.getUTCDay()] || '', mes: mesCurto }
}

function TimelinePedidos({
  dias,
  cortado,
  de,
  ate,
}: {
  dias: DiaFinanceiro[]
  cortado: boolean
  de: string
  ate: string
}) {
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const trilho = useRef<HTMLDivElement>(null)
  const ultimoComPedido = [...dias].reverse().find((dia) => dia.pedidos.length > 0)?.data ?? null
  const ativo = dias.some((dia) => dia.data === escolhido) ? escolhido : ultimoComPedido
  const diaAtivo = dias.find((dia) => dia.data === ativo) ?? null
  const pico = Math.max(1, ...dias.map((dia) => dia.pecas + dia.pecasFora))
  const temFora = dias.some((dia) => dia.pecasFora > 0)

  useEffect(() => {
    const pai = trilho.current
    const marcado = pai?.querySelector<HTMLElement>('.is-on')
    if (!pai || !marcado) return
    pai.scrollLeft = marcado.offsetLeft - pai.clientWidth / 2 + marcado.clientWidth / 2
  }, [ativo, de, ate])

  return (
    <section className="financeiro-timeline">
      <h2>Pedidos por dia</h2>
      {cortado ? <p className="financeiro-timeline-nota">Mostrando os últimos 400 dias do período.</p> : null}
      <div className="financeiro-dias" ref={trilho}>
        {dias.map((dia, index) => {
          const partes = partesDia(dia.data)
          const total = dia.pecas + dia.pecasFora
          const altura = total > 0 ? Math.max(10, Math.round((total / pico) * 72)) : 4
          const alturaUsados = total > 0 ? Math.round((dia.pecas / total) * altura) : 0
          const mostraMes = index === 0 || partes.dia === '01'
          return (
            <button
              key={dia.data}
              type="button"
              className={dia.data === ativo ? 'financeiro-dia is-on' : 'financeiro-dia'}
              aria-pressed={dia.data === ativo}
              aria-label={`${partes.dia} de ${partes.mes}, ${dia.pedidos.length} ${dia.pedidos.length === 1 ? 'pedido' : 'pedidos'}, ${dia.pecas} peças`}
              onClick={() => setEscolhido(dia.data)}
            >
              <span className="financeiro-dia-trilho" aria-hidden="true">
                <span className={total > 0 ? 'financeiro-dia-barra' : 'financeiro-dia-barra is-vazio'} style={{ height: altura }}>
                  {dia.pecas > 0 ? <i className="usados" style={{ height: Math.max(2, alturaUsados) }} /> : null}
                  {dia.pecasFora > 0 ? <i className="fora" style={{ height: Math.max(2, altura - alturaUsados) }} /> : null}
                </span>
              </span>
              <span className="financeiro-dia-mes">{mostraMes ? partes.mes : ''}</span>
              <span className="financeiro-dia-num">{partes.dia}</span>
              <span className="financeiro-dia-sem">{partes.semana}</span>
            </button>
          )
        })}
      </div>
      {temFora ? <p className="financeiro-timeline-nota">Barra escura entrou na conta. Faixa marrom não entrou.</p> : null}
      {diaAtivo ? (
        <div className="financeiro-dia-detalhe">
          <p>
            {dataBr(diaAtivo.data)} · {diaAtivo.pedidos.length} {diaAtivo.pedidos.length === 1 ? 'pedido' : 'pedidos'} · {pecas(diaAtivo.pecas)}
            {diaAtivo.pecasFora > 0 ? ` · ${pecas(diaAtivo.pecasFora)} de fora` : ''}
          </p>
          {diaAtivo.pedidos.length === 0 ? (
            <p className="financeiro-timeline-nota">Nenhum pedido neste dia.</p>
          ) : (
            <ul className="financeiro-dia-lista">
              {diaAtivo.pedidos.map((pedido) => (
                <li key={pedido.id} className={pedido.fora ? 'is-fora' : undefined}>
                  <strong>#{pedido.numero}</strong>
                  <span>
                    {pecas(pedido.pecas)}
                    {pedido.produtos.length > 0 ? ` · ${pedido.produtos.slice(0, 2).join(', ')}` : ''}
                  </span>
                  {pedido.fora ? <em>não entrou</em> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="financeiro-timeline-nota">Nenhum pedido nestas datas.</p>
      )}
    </section>
  )
}

function CartaoProduto({ produto }: { produto: ProdutoFinanceiro }) {
  return (
    <article className="financeiro-produto">
      <header className="financeiro-produto-topo">
        <h2>{produto.nome}</h2>
        <p className="financeiro-numero">{produto.total}</p>
      </header>
      <p className="financeiro-meta">
        {pecas(produto.total)} · {produto.pedidos} {produto.pedidos === 1 ? 'pedido' : 'pedidos'}
      </p>
      {produto.tamanhos.length > 1 ? (
        <div className="financeiro-barra" aria-hidden="true">
          {produto.tamanhos.map((item, index) => (
            <span
              key={item.tamanho}
              style={{ width: `${(item.quantidade / produto.total) * 100}%`, background: CORES[index % CORES.length] }}
            />
          ))}
        </div>
      ) : null}
      <ul className="financeiro-pills">
        {produto.tamanhos.map((item, index) => (
          <li key={item.tamanho} style={{ borderColor: CORES[index % CORES.length] }}>
            <strong>{item.tamanho}</strong>
            <span>{item.quantidade}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

export function FinanceiroPanel({ board }: { board: BoardState }) {
  const hoje = hojeNoBrasil()
  const mesAtual = periodoDesteMes(hoje)
  const [inicio, setInicio] = useState(mesAtual.inicio)
  const [fim, setFim] = useState(mesAtual.fim)

  const de = inicio && fim && inicio > fim ? fim : inicio
  const ate = inicio && fim && inicio > fim ? inicio : fim
  const resumo = useMemo(
    () => resumirPecasFinanceiro(board.cards, de, ate),
    [board.cards, de, ate],
  )
  const timeline = useMemo(
    () => timelinePedidosFinanceiro(board.cards, de, ate),
    [board.cards, de, ate],
  )
  const esteMes = inicio === mesAtual.inicio && fim === mesAtual.fim
  const passado = periodoMesPassado(hoje)
  const mesPassado = inicio === passado.inicio && fim === passado.fim

  return (
    <div className="financeiro">
      <header className="financeiro-topo">
        <div>
          <h1>Financeiro</h1>
          <p>
            Peças usadas de {dataBr(de)} até {dataBr(ate)}. Links de venda diferentes entram no mesmo produto. Corta-vento é um só, com os tamanhos e o total.
          </p>
        </div>
        <div className="financeiro-totais">
          <span>{pecas(resumo.pecasUsadas)}</span>
          <span>
            {resumo.pedidosUsados} {resumo.pedidosUsados === 1 ? 'pedido' : 'pedidos'}
          </span>
        </div>
      </header>

      <div className="financeiro-filtros">
        <button
          type="button"
          className={esteMes ? 'is-on' : undefined}
          onClick={() => {
            setInicio(mesAtual.inicio)
            setFim(mesAtual.fim)
          }}
        >
          Este mês
        </button>
        <button
          type="button"
          className={mesPassado ? 'is-on' : undefined}
          onClick={() => {
            setInicio(passado.inicio)
            setFim(passado.fim)
          }}
        >
          Mês passado
        </button>
        <label>
          De
          <input type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} />
        </label>
        <label>
          Até
          <input type="date" value={fim} onChange={(event) => setFim(event.target.value)} />
        </label>
      </div>

      <TimelinePedidos dias={timeline.dias} cortado={timeline.periodoCortado} de={de} ate={ate} />

      {resumo.usados.length === 0 ? (
        <p className="financeiro-vazio">Nenhuma peça usada neste período.</p>
      ) : (
        <div className="financeiro-lista">
          {resumo.usados.map((produto) => (
            <CartaoProduto key={produto.nome} produto={produto} />
          ))}
        </div>
      )}

      <section className="financeiro-fora">
        <h2>Não entrou na conta</h2>
        <p>
          {resumo.pecasFora === 0
            ? 'Nenhuma peça de pedido cancelado ou expirado neste período.'
            : `${pecas(resumo.pecasFora)} em pedidos cancelados ou expirados. Pedido teste não entra.`}
        </p>
        {resumo.fora.length > 0 ? (
          <div className="financeiro-lista">
            {resumo.fora.map((produto) => (
              <CartaoProduto key={`fora-${produto.nome}`} produto={produto} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
