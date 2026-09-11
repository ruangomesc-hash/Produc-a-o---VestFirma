import { useMemo } from 'react'
import {
  TIPOS_PRODUTO,
  type PedidoItemProduto,
  type TipoProdutoId,
  ordenarItensProduto,
  quantidadeTotalItensProduto,
} from '../tiposProduto'

type Props = {
  value: PedidoItemProduto[]
  onChange: (itens: PedidoItemProduto[]) => void
}

function qtyMapFromItens(itens: PedidoItemProduto[]): Record<TipoProdutoId, string> {
  const map = {} as Record<TipoProdutoId, string>
  for (const tipo of TIPOS_PRODUTO) map[tipo.id] = ''
  for (const item of itens) map[item.tipoProduto] = String(item.quantidade)
  return map
}

export function PedidoProdutosField({ value, onChange }: Props) {
  const qtyMap = useMemo(() => qtyMapFromItens(value), [value])
  const total = quantidadeTotalItensProduto(value)

  const setQty = (tipoId: TipoProdutoId, raw: string) => {
    const digits = raw.replace(/\D/g, '')
    const next = value.filter((item) => item.tipoProduto !== tipoId)
    if (digits) {
      const quantidade = Math.max(1, parseInt(digits, 10) || 1)
      next.push({ tipoProduto: tipoId, quantidade })
    }
    onChange(ordenarItensProduto(next))
  }

  return (
    <div className="field span-2 pedido-produtos-field">
      <span>Produtos do pedido *</span>
      <p className="field-hint">
        Informe a quantidade de cada tipo de peça. Deixe em branco ou zero o que não entra no pedido.
      </p>
      <div className="pedido-produtos-table-wrap">
        <table className="pedido-produtos-table">
          <thead>
            <tr>
              <th scope="col">Produto</th>
              <th scope="col">Qtd.</th>
            </tr>
          </thead>
          <tbody>
            {TIPOS_PRODUTO.map((tipo) => (
              <tr key={tipo.id}>
                <th scope="row">{tipo.label}</th>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="pedido-produtos-qty"
                    value={qtyMap[tipo.id]}
                    placeholder="0"
                    aria-label={`Quantidade — ${tipo.label}`}
                    onChange={(e) => setQty(tipo.id, e.target.value)}
                    onBlur={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      if (!digits) setQty(tipo.id, '')
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pedido-produtos-total" aria-live="polite">
        Total: <strong>{total}</strong> peça{total === 1 ? '' : 's'}
      </p>
    </div>
  )
}
