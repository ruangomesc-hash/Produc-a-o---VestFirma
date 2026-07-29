import { useMemo } from 'react'
import {
  agregarPorVendedor,
  rankingPorPedidos,
  rankingPorPecas,
  type VendedorResumo,
} from '../vendedorMetrics'
import type { BoardState } from '../types'
import { VendedoresAnalyticsAside } from './VendedoresAnalyticsAside'

import type { ManagedUser } from '../userRoles'

type Props = {
  board: BoardState
  managedVendedores?: ManagedUser[]
}

type RankingProps = {
  titulo: string
  criterio: 'pedidos' | 'pecas'
  linhas: VendedorResumo[]
  totais: { pedidos: number; pecas: number }
}

function RankingVendedores({ titulo, criterio, linhas, totais }: RankingProps) {
  const ativos = linhas.filter((l) => l.pedidos > 0)

  return (
    <section className="vendedor-ranking" aria-labelledby={`rank-${criterio}`}>
      <h2 id={`rank-${criterio}`} className="vendedor-ranking-title">
        {titulo}
      </h2>
      {ativos.length === 0 ? (
        <p className="vendedor-ranking-empty">Nenhum pedido no quadro ainda.</p>
      ) : (
        <ol className="vendedor-ranking-list">
          {ativos.map((linha, index) => {
            const pos = index + 1
            const principal = criterio === 'pedidos' ? linha.pedidos : linha.pecas
            const secundario = criterio === 'pedidos' ? linha.pecas : linha.pedidos
            const totalRef = criterio === 'pedidos' ? totais.pedidos : totais.pecas
            const pct = totalRef > 0 ? Math.round((principal / totalRef) * 100) : 0

            return (
              <li
                key={`${criterio}-${linha.vendedorId ?? 'sem'}`}
                className={`vendedor-rank-item ${pos <= 3 ? `vendedor-rank-item--top${pos}` : ''}`}
              >
                <span className="vendedor-rank-pos" aria-label={`${pos}º lugar`}>
                  {pos}º
                </span>
                <div className="vendedor-rank-body">
                  <span className="vendedor-rank-name">{linha.nome}</span>
                  <p className="vendedor-rank-line">
                    <span>
                      {principal}{' '}
                      {criterio === 'pedidos'
                        ? principal === 1
                          ? 'pedido'
                          : 'pedidos'
                        : principal === 1
                          ? 'peça'
                          : 'peças'}
                    </span>
                    <span className="vendedor-rank-sep" aria-hidden="true">
                      ·
                    </span>
                    <span>{pct}%</span>
                    <span className="vendedor-rank-sep" aria-hidden="true">
                      ·
                    </span>
                    <span>
                      {criterio === 'pedidos'
                        ? `${secundario} peças`
                        : `${secundario} ${secundario === 1 ? 'pedido' : 'pedidos'}`}
                    </span>
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

export function VendedoresOverviewPanel({ board, managedVendedores }: Props) {
  const { linhas, totais } = useMemo(
    () => agregarPorVendedor(board, { managedVendedores }),
    [board, managedVendedores],
  )
  const porPedidos = useMemo(() => rankingPorPedidos(linhas), [linhas])
  const porPecas = useMemo(() => rankingPorPecas(linhas), [linhas])

  return (
    <div className="vendedor-overview">
      <div className="vendedor-overview-inner">
        <div className="vendedor-overview-main">
          <div className="vendedor-overview-left-col">
            <div className="vendedor-overview-intro">
              <header className="vendedor-overview-top">
                <h1 className="vendedor-overview-title">Por vendedor</h1>
                <p className="vendedor-overview-sub">
                  Rankings à esquerda · visão analítica ocupa a metade direita da tela.
                </p>
              </header>

              <div className="vendedor-overview-totais">
                <span className="vendedor-total-pill">
                  <strong>{totais.pedidos}</strong> pedidos no total
                </span>
                <span className="vendedor-total-pill">
                  <strong>{totais.pecas}</strong> peças no total
                </span>
                <span className="vendedor-total-pill">
                  <strong>{totais.vendedoresComPedido}</strong> vendedor
                  {totais.vendedoresComPedido === 1 ? '' : 'es'} com pedido
                </span>
              </div>
            </div>

          {linhas.length === 0 ? (
            <p className="vendedor-overview-empty">
              Nenhum vendedor cadastrado. Use <strong>Usuários</strong> (perfil Vendedor) e configure
              WhatsApp em <strong>Vendedores</strong>.
            </p>
          ) : (
            <div className="vendedor-rankings">
              <RankingVendedores
                titulo="Ranking por pedidos"
                criterio="pedidos"
                linhas={porPedidos}
                totais={totais}
              />
              <RankingVendedores
                titulo="Ranking por peças"
                criterio="pecas"
                linhas={porPecas}
                totais={totais}
              />
            </div>
          )}
          </div>
        </div>
        <aside className="vendedor-overview-aside" aria-label="Gráficos e análises">
          <VendedoresAnalyticsAside board={board} managedVendedores={managedVendedores} />
        </aside>
      </div>
    </div>
  )
}
