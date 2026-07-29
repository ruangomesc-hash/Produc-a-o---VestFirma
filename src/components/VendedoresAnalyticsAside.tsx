import { useMemo } from 'react'
import {
  fatiasVendedorPedidos,
  fatiasVendedorPecas,
  topSegmentosPorPedido,
} from '../boardChartsMetrics'
import { agregarPorEstado } from '../pedidoLocalidade'
import type { BoardState } from '../types'
import { agregarPorVendedor } from '../vendedorMetrics'
import { BrazilOrdersMap } from './charts/BrazilOrdersMap'
import { EstadosList } from './charts/EstadosList'
import { HorizontalBarChart } from './charts/HorizontalBarChart'
import { PieChart } from './charts/PieChart'

type Props = {
  board: BoardState
}

export function VendedoresAnalyticsAside({ board }: Props) {
  const { linhas } = useMemo(() => agregarPorVendedor(board), [board])
  const fatiasPedidos = useMemo(() => fatiasVendedorPedidos(linhas), [linhas])
  const fatiasPecas = useMemo(() => fatiasVendedorPecas(linhas), [linhas])
  const segmentos = useMemo(() => topSegmentosPorPedido(board), [board])
  const estados = useMemo(() => agregarPorEstado(board.cards), [board.cards])
  const totalPedidosComUf = useMemo(
    () => estados.reduce((s, e) => s + e.pedidos, 0),
    [estados],
  )

  return (
    <div className="analytics-panel">
      <header className="analytics-panel-head">
        <p className="analytics-panel-eyebrow">Indicadores</p>
        <h2 className="analytics-panel-title">Visão analítica</h2>
        <p className="analytics-panel-lead">Resumo do quadro: equipe, segmentos e região.</p>
      </header>

      <div className="analytics-panel-body">
        <section className="analytics-zone analytics-zone--charts-row" aria-label="Vendedores e segmentos">
          <div className="analytics-charts-row">
            <PieChart
              embedded
              titulo="Por pedidos"
              slices={fatiasPedidos}
              unidade="pedidos"
            />
            <PieChart embedded titulo="Por peças" slices={fatiasPecas} unidade="peças" />
            <div className="chart-tile chart-tile--segmentos">
              <h4 className="chart-tile-title">Segmentos</h4>
              <HorizontalBarChart embedded itens={segmentos} />
            </div>
          </div>
        </section>

        <section className="analytics-zone analytics-zone--regiao" aria-labelledby="zone-regiao">
          <h3 id="zone-regiao" className="analytics-zone-label">
            Região
          </h3>
          <div className="analytics-regiao">
            <div className="analytics-regiao-map">
              <BrazilOrdersMap embedded estados={estados} />
            </div>
            <div className="analytics-regiao-list">
              <p className="analytics-regiao-list-title">Estados</p>
              <EstadosList
                embedded
                estados={estados}
                totalPedidos={totalPedidosComUf}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
