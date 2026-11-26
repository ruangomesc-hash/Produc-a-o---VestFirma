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

function pecas(n: number) {
  return `${n} ${n === 1 ? 'peça' : 'peças'}`
}

function TabelaProduto({ produto }: { produto: ProdutoFinanceiro }) {
  return (
    <article className="financeiro-produto">
      <header className="financeiro-produto-topo">
        <h2>{produto.nome}</h2>
        <p>
          <strong>{pecas(produto.total)}</strong>
          <span>
            {produto.pedidos} {produto.pedidos === 1 ? 'pedido' : 'pedidos'}
          </span>
        </p>
      </header>
      <table className="financeiro-tamanhos">
        <thead>
          <tr>
            <th>Tamanho</th>
            <th>Quantidade</th>
          </tr>
        </thead>
        <tbody>
          {produto.tamanhos.map((item) => (
            <tr key={item.tamanho}>
              <td>{item.tamanho}</td>
              <td>{item.quantidade}</td>
            </tr>
          ))}
          <tr className="financeiro-geral">
            <th>Geral</th>
            <td>{produto.total}</td>
          </tr>
        </tbody>
      </table>
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
            Peças usadas de {dataBr(de)} até {dataBr(ate)}. O mesmo nome entra junto: corta-vento é um produto, com cada tamanho e o geral.
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
            <TabelaProduto key={produto.nome} produto={produto} />
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
              <TabelaProduto key={`fora-${produto.nome}`} produto={produto} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
