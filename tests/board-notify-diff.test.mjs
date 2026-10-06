import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { contarNovosPedidosShopify, diffBoardAlerts } from '../src/boardNotifyDiff.ts'

function board(cards) {
  return {
    columns: [
      { id: 'a', title: 'Novo' },
      { id: 'b', title: 'Produção' },
    ],
    cards,
    vendedores: [],
  }
}

function card(id, columnId, extra = {}) {
  return {
    id,
    columnId,
    cliente: 'Cliente ' + id,
    whatsappCliente: '',
    vendedorId: null,
    segmentoId: null,
    quantidade: 1,
    numeroPedido: id,
    canal: 'whatsapp',
    endereco: '',
    dataPedido: '',
    dataPagamento: '',
    logoEnviadaCliente: [],
    logoProntaImpressao: [],
    previewAprovacaoCliente: [],
    localLogo: null,
    etapaDesde: '',
    createdAt: '',
    historicoEtapa: [],
    comentarios: [],
    ...extra,
  }
}

describe('diffBoardAlerts', () => {
  it('não avisa na primeira carga', () => {
    assert.deepEqual(diffBoardAlerts(null, board([card('1', 'a')])), [])
  })

  it('avisa pedido novo, movimento e arquivamento', () => {
    const prev = board([card('1', 'a'), card('2', 'a')])
    const next = board([
      card('1', 'b'),
      card('2', 'a', { arquivadoEm: '2026-01-01T00:00:00.000Z' }),
      card('3', 'a'),
    ])
    const tags = diffBoardAlerts(prev, next).map((x) => x.tag)
    assert.ok(tags.includes('mov-1-b'))
    assert.ok(tags.includes('arq-2'))
    assert.ok(tags.includes('novo-3'))
  })

  it('toca uma campainha por pedido Shopify novo, não na primeira carga', () => {
    assert.equal(contarNovosPedidosShopify(null, board([card('s1', 'a', { origem: 'shopify' })])), 0)
    const prev = board([card('1', 'a')])
    const next = board([
      card('1', 'a'),
      card('s2', 'a', { origem: 'shopify', shopifyOrderId: '99' }),
      card('s3', 'a', { origem: 'shopify', shopifyOrderId: '100' }),
      card('manual', 'a'),
    ])
    assert.equal(contarNovosPedidosShopify(prev, next), 2)
  })
})
