import { useMemo, useState } from 'react'
import {
  hojeNoBrasil,
  periodoDesteMes,
  periodoMesPassado,
  resumirPecasFinanceiro,
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
