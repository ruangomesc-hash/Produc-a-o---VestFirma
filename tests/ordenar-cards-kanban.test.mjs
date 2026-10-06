import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { compararNumeroPedido, ordenarCardsPorNumeroPedido } from '../src/ordenarCardsKanban.ts'

describe('ordenarCardsPorNumeroPedido', () => {
  it('coloca o menor número do pedido no topo', () => {
    const ordered = ordenarCardsPorNumeroPedido([
      { id: 'c', numeroPedido: '1052' },
      { id: 'a', numeroPedido: '1046' },
      { id: 'b', numeroPedido: '1048' },
    ])
    assert.deepEqual(
      ordered.map((c) => c.numeroPedido),
      ['1046', '1048', '1052'],
    )
  })

  it('números puros ficam na frente de códigos tipo WPP-01', () => {
    assert.ok(compararNumeroPedido('1046', 'WPP-01') < 0)
    assert.ok(compararNumeroPedido('1046', '1048') < 0)
  })
})
