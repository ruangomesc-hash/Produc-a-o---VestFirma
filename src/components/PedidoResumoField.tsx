import type { OrderCard, PedidoLinhaResumo } from '../types'
import { linhasResumoDoPedido, quantidadeExibidaComResumo } from '../pedidoResumo'

type Props = {
  card?: Pick<OrderCard, 'linhasPedido' | 'itensProduto' | 'tipoProduto' | 'quantidade' | 'origem'>
  linhas?: PedidoLinhaResumo[]
}

export function PedidoResumoField({ card, linhas }: Props) {
  const lista = linhas?.length ? linhas : card ? linhasResumoDoPedido(card) : []
  const total = card ? quantidadeExibidaComResumo(card) : lista.reduce((s, i) => s + i.quantidade, 0)
  const daShopify = Boolean(card?.origem === 'shopify' || (card?.linhasPedido && card.linhasPedido.length > 0))

  return (
    <div className="field span-2 pedido-produtos-field pedido-resumo-field">
      <span>Resumo do pedido</span>
      {lista.length === 0 ? (
        <p className="field-hint">
          {daShopify
            ? 'Os produtos desta venda ainda não chegaram da Shopify. No próximo webhook eles aparecem aqui.'
            : 'Não precisa preencher peça por peça. Pedido da loja traz o resumo sozinho. Pedido manual: anote na observação, se quiser.'}
        </p>
      ) : (
        <>
          <p className="field-hint">
            {daShopify ? 'Como veio da Shopify — não preenche no kanban.' : 'Peças já registradas neste pedido.'}
          </p>
          <ul className="pedido-resumo-lista">
            {lista.map((item, i) => (
              <li key={`${item.titulo}-${i}`}>
                <span>
                  {item.titulo}
                  {item.detalhe ? <em> · {item.detalhe}</em> : null}
                </span>
                <strong>{item.quantidade}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="pedido-produtos-total" aria-live="polite">
        Total: <strong>{total}</strong> peça{total === 1 ? '' : 's'}
      </p>
    </div>
  )
}
