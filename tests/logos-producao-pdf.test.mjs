import assert from 'node:assert/strict'
import test from 'node:test'
import {
  contarLogosDoPedido,
  dataPedidoImpressao,
  nomeArquivoPdfPedido,
  nomeArquivoPdfPedidos,
  nomeArquivoZipPedidos,
  resumoPecasPdf,
} from '../shared/logosProducao.mjs'

test('frente conta só logo pequena, vezes as peças', () => {
  assert.deepEqual(contarLogosDoPedido('frente', 8), { pequenas: 8, grandes: 0 })
})

test('costas conta só logo grande, vezes as peças', () => {
  assert.deepEqual(contarLogosDoPedido('costas', 5), { pequenas: 0, grandes: 5 })
})

test('frente e costas soma uma de cada e multiplica pelas peças', () => {
  assert.deepEqual(contarLogosDoPedido('frente-costas', 10), { pequenas: 10, grandes: 10 })
})

test('sem local da logo a ficha não inventa quantidade', () => {
  assert.deepEqual(contarLogosDoPedido(null, 4), { pequenas: 0, grandes: 0 })
  assert.deepEqual(contarLogosDoPedido('frente', 0), { pequenas: 0, grandes: 0 })
})

test('o PDF do pedido usa o nome pedido #número - vestfirma, sem data', () => {
  assert.equal(nomeArquivoPdfPedido('1205'), 'pedido #1205 - vestfirma')
  assert.equal(nomeArquivoPdfPedido('#1205'), 'pedido #1205 - vestfirma')
  assert.equal(nomeArquivoPdfPedido(''), 'pedido #s/n - vestfirma')
  assert.equal(dataPedidoImpressao('2026-11-24'), '24/11/2026')
  assert.equal(dataPedidoImpressao(''), '')
  assert.equal(nomeArquivoPdfPedidos(['1205', '1206']), 'pedidos - vestfirma')
  assert.equal(nomeArquivoPdfPedidos(['#1205']), 'pedido #1205 - vestfirma')
  assert.equal(
    nomeArquivoZipPedidos(['1205', '1206'], new Date('2026-11-26T21:54:09Z')),
    'pedidos - vestfirma 26-11-2026 18h54m09s.zip',
  )
})

test('o resumo da aplicação lista peça, tamanho e quantidade', () => {
  assert.deepEqual(
    resumoPecasPdf([
      { titulo: 'Corta-vento Personalizado Time Azul', quantidade: 12, detalhe: 'G' },
      { titulo: 'Camiseta Personalizada Escola Municipal G', quantidade: 3 },
      { titulo: 'Camisa Polo Time', quantidade: 2, detalhe: 'Estampa frente / M' },
    ]),
    [
      { quantidade: 12, peca: 'Corta-vento Personalizado Time Azul', tamanho: 'G', extra: '' },
      { quantidade: 3, peca: 'Camiseta Personalizada Escola Municipal', tamanho: 'G', extra: '' },
      { quantidade: 2, peca: 'Camisa Polo Time', tamanho: 'M', extra: 'Estampa frente / M' },
    ],
  )
})
