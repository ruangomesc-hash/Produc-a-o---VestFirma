import assert from 'node:assert/strict'
import test from 'node:test'
import { contarLogosDoPedido } from '../shared/logosProducao.mjs'

test('a contagem é do pedido, sem juntar outro pedido', () => {
  const pedido = contarLogosDoPedido([
    { titulo: 'Jaqueta — Estampa pequena na frente', quantidade: 2, detalhe: 'G' },
    { titulo: 'Jaqueta — Estampa frente e trás', quantidade: 3, detalhe: 'M' },
  ])
  assert.deepEqual(pedido, { pequenas: 2, grandes: 3 })
})

test('grande e frente e costas entram na quantidade grande', () => {
  const pedido = contarLogosDoPedido([
    { titulo: 'Camisa', detalhe: 'Estampa grande', quantidade: 4 },
    { titulo: 'Camisa estampa pequena', quantidade: 1 },
    { titulo: 'Camisa frente e costas', quantidade: 2 },
  ])
  assert.deepEqual(pedido, { pequenas: 1, grandes: 6 })
})
