import { useMemo } from 'react'
import {
  formatStorageBytes,
  measureBoardStorage,
  storagePercent,
  storageUsageLevel,
} from '../boardStorageStats'
import type { BoardState } from '../types'

type Props = {
  board: BoardState
}

export function BoardStorageMeter({ board }: Props) {
  const stats = useMemo(() => measureBoardStorage(board), [board])
  const level = storageUsageLevel(stats.totalBytes, stats.vercelLimitBytes)
  const pct = storagePercent(stats.totalBytes, stats.vercelLimitBytes)
  const logosPct =
    stats.totalBytes > 0 ? Math.round((stats.logoBytes / stats.totalBytes) * 100) : 0

  return (
    <section className="storage-meter" aria-labelledby="storage-meter-title">
      <header className="storage-meter-head">
        <div>
          <h2 id="storage-meter-title" className="storage-meter-title">
            Espaço dos pedidos
          </h2>
          <p className="storage-meter-sub">
            Tamanho do quadro completo ao salvar no servidor (pedidos + logos + colunas). Logos
            comprimidas entram na conta.
          </p>
        </div>
        <div className={`storage-meter-total storage-meter-${level}`}>
          <span className="storage-meter-total-value">{formatStorageBytes(stats.totalBytes)}</span>
          <span className="storage-meter-total-label">
            {stats.cardCount} pedido{stats.cardCount === 1 ? '' : 's'}
          </span>
        </div>
      </header>

      <div className="storage-meter-bar-wrap">
        <div
          className={`storage-meter-bar storage-meter-bar-${level}`}
          role="meter"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Uso em relação ao limite de envio na Vercel: ${pct}%`}
        >
          <div className="storage-meter-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="storage-meter-bar-caption">
          {pct}% do limite de referência para envio ({formatStorageBytes(stats.vercelLimitBytes)} —
          Vercel Hobby)
        </p>
      </div>

      <ul className="storage-meter-breakdown">
        <li>
          <span>Logos nos pedidos</span>
          <strong>
            {formatStorageBytes(stats.logoBytes)} ({stats.logoFileCount} arquivo
            {stats.logoFileCount === 1 ? '' : 's'}) · {logosPct}%
          </strong>
        </li>
        <li>
          <span>Dados dos pedidos (sem logos)</span>
          <strong>{formatStorageBytes(stats.pedidosMetaBytes)}</strong>
        </li>
        <li>
          <span>Colunas, vendedores e segmentos</span>
          <strong>{formatStorageBytes(stats.structureBytes)}</strong>
        </li>
      </ul>

      {level !== 'ok' && (
        <p className={`storage-meter-alert storage-meter-alert-${level}`}>
          {level === 'error'
            ? 'Quadro muito grande: o salvamento na Vercel pode falhar. Remova logos antigas ou arquive pedidos.'
            : 'O quadro está ficando pesado. Considere limpar logos duplicadas ou pedidos muito antigos.'}
        </p>
      )}

      {stats.topCards.length > 0 && (
        <div className="storage-meter-top">
          <h3 className="storage-meter-top-title">Pedidos que mais ocupam espaço</h3>
          <table className="storage-meter-table">
            <thead>
              <tr>
                <th>Cliente / nº</th>
                <th>Total</th>
                <th>Logos</th>
              </tr>
            </thead>
            <tbody>
              {stats.topCards.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="storage-meter-client">{row.cliente}</span>
                    {row.numeroPedido ? (
                      <span className="storage-meter-order"> #{row.numeroPedido}</span>
                    ) : null}
                  </td>
                  <td>{formatStorageBytes(row.totalBytes)}</td>
                  <td>{formatStorageBytes(row.logoBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
