import assert from 'node:assert/strict'
import test from 'node:test'
import {
  periodoDesteMes,
  periodoMesPassado,
  resumirPecasFinanceiro,
  separarProdutoTamanho,
  timelinePedidosFinanceiro,
} from '../shared/financeiroPecas.mjs'

function card(extra) {
  return {
    id: extra.id || 'p1',
    columnId: 'logos-prontas',
    dataPedido: '2026-11-10',
    linhasPedido: [],
    ...extra,
  }
}

test('corta-vento é um produto só, com tamanho e o geral', () => {
  const resumo = resumirPecasFinanceiro(
    [
      card({
        id: 'a',
        linhasPedido: [{ titulo: 'Corta-vento Personalizado Time Azul', quantidade: 2, detalhe: 'G' }],
      }),
      card({
        id: 'b',
        linhasPedido: [{ titulo: 'Link corta venda feminino', quantidade: 16, detalhe: 'g' }],
      }),
      card({
        id: 'c',
        linhasPedido: [{ titulo: 'Corta Vento Masculino', quantidade: 4, detalhe: 'M' }],
      }),
    ],
    '2026-11-01',
    '2026-11-26',
  )
  assert.equal(resumo.pecasUsadas, 22)
  assert.equal(resumo.usados.length, 1)
  assert.equal(resumo.usados[0].nome, 'Corta-vento')
  assert.equal(resumo.usados[0].total, 22)
  assert.deepEqual(
    resumo.usados[0].tamanhos.map((item) => [item.tamanho, item.quantidade]),
    [
      ['M', 4],
      ['G', 18],
    ],
  )
})

test('camiseta não se mistura com corta-vento e o tamanho pode vir no nome', () => {
  const separado = separarProdutoTamanho('Camiseta G', '')
  assert.deepEqual(separado, { nome: 'Camiseta', tamanho: 'G' })
  const resumo = resumirPecasFinanceiro(
    [
      card({
        linhasPedido: [
          { titulo: 'Camiseta Personalizada Escola Municipal G', quantidade: 3 },
          { titulo: 'Camisa Polo Time do Bairro', quantidade: 2, detalhe: 'M' },
          { titulo: 'Corta-vento Empresa Norte', quantidade: 1, detalhe: 'Estampa frente / GG' },
        ],
      }),
    ],
    '2026-11-01',
    '2026-11-30',
  )
  assert.deepEqual(
    resumo.usados.map((item) => [item.nome, item.total, item.tamanhos.map((tamanho) => tamanho.tamanho).join(',')]),
    [
      ['Camiseta', 3, 'G'],
      ['Camisa polo', 2, 'M'],
      ['Corta-vento', 1, 'GG'],
    ],
  )
})

test('o período limita o mês e cancelado fica fora da conta', () => {
  assert.deepEqual(periodoDesteMes('2026-11-26'), { inicio: '2026-11-01', fim: '2026-11-26' })
  assert.deepEqual(periodoMesPassado('2026-11-26'), { inicio: '2026-10-01', fim: '2026-10-31' })
  const resumo = resumirPecasFinanceiro(
    [
      card({ id: 'dentro', dataPedido: '2026-11-02', linhasPedido: [{ titulo: 'Camiseta', quantidade: 5, detalhe: 'M' }] }),
      card({ id: 'antes', dataPedido: '2026-10-20', linhasPedido: [{ titulo: 'Camiseta', quantidade: 9, detalhe: 'G' }] }),
      card({
        id: 'cancelado',
        columnId: 'cancelados-expirados',
        linhasPedido: [{ titulo: 'Camiseta', quantidade: 7, detalhe: 'P' }],
      }),
      card({
        id: 'teste',
        pedidoTeste: true,
        linhasPedido: [{ titulo: 'Camiseta', quantidade: 100, detalhe: 'GG' }],
      }),
    ],
    '2026-11-01',
    '2026-11-26',
  )
  assert.equal(resumo.pecasUsadas, 5)
  assert.equal(resumo.pecasFora, 7)
  assert.equal(resumo.pedidosUsados, 1)
  assert.equal(resumo.usados[0].tamanhos[0].tamanho, 'M')
  assert.equal(resumo.fora[0].tamanhos[0].tamanho, 'P')
})

test('a timeline segue o período e junta os pedidos do dia', () => {
  const linha = timelinePedidosFinanceiro(
    [
      card({
        id: 'a',
        numeroPedido: '1205',
        dataPedido: '2026-11-02',
        linhasPedido: [{ titulo: 'Corta-vento Time', quantidade: 4, detalhe: 'G' }],
      }),
      card({
        id: 'b',
        numeroPedido: '#1206',
        dataPedido: '2026-11-02',
        linhasPedido: [{ titulo: 'Link corta venda', quantidade: 2, detalhe: 'M' }],
      }),
      card({
        id: 'c',
        numeroPedido: '99',
        dataPedido: '2026-10-20',
        linhasPedido: [{ titulo: 'Camiseta', quantidade: 9, detalhe: 'G' }],
      }),
      card({
        id: 'd',
        numeroPedido: '7',
        dataPedido: '2026-11-02',
        columnId: 'cancelados-expirados',
        linhasPedido: [{ titulo: 'Camiseta', quantidade: 1, detalhe: 'P' }],
      }),
      card({
        id: 'e',
        numeroPedido: '8',
        dataPedido: '2026-11-02',
        pedidoTeste: true,
        linhasPedido: [{ titulo: 'Camiseta', quantidade: 50, detalhe: 'G' }],
      }),
    ],
    '2026-11-01',
    '2026-11-03',
  )
  assert.equal(linha.periodoCortado, false)
  assert.equal(linha.dias.length, 30)
  assert.equal(linha.dias[0].data, '2026-11-01')
  assert.equal(linha.dias[0].dentro, true)
  assert.equal(linha.dias[29].data, '2026-11-30')
  assert.equal(linha.dias[29].dentro, false)
  assert.equal(linha.dias[3].dentro, false)
  assert.equal(linha.dias[0].pedidos.length, 0)
  assert.equal(linha.dias[1].pecas, 6)
  assert.equal(linha.dias[1].pecasFora, 1)
  assert.deepEqual(
    linha.dias[1].pedidos.map((pedido) => [pedido.numero, pedido.pecas, pedido.fora, pedido.produtos.join('|')]),
    [
      ['7', 1, true, 'Camiseta'],
      ['1205', 4, false, 'Corta-vento'],
      ['1206', 2, false, 'Corta-vento'],
    ],
  )
  assert.equal(linha.dias[2].pedidos.length, 0)
})
