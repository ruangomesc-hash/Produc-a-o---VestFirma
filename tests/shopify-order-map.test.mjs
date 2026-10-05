import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  COLUNA_PEDIDO_FEITO_ID,
  cardIdShopify,
  mapShopifyOrderToCard,
  mesclarCardShopify,
  mergeShopifyEtapaTags,
  parseEtapaTag,
  pedidoFaltaLogo,
} from '../shared/shopifyOrderMap.mjs'

const order = {
  id: 998877,
  name: '#1042',
  order_number: 1042,
  created_at: '2026-10-05T12:00:00Z',
  updated_at: '2026-10-05T12:05:00Z',
  financial_status: 'paid',
  processed_at: '2026-10-05T12:01:00Z',
  tags: '',
  note: 'Uniforme empresa X',
  shipping_address: {
    first_name: 'Maria',
    last_name: 'Silva',
    phone: '11988887777',
    address1: 'Rua A, 10',
    city: 'São Paulo',
    province: 'SP',
    zip: '01000-000',
    country: 'Brazil',
  },
  line_items: [
    { title: 'Polo', quantity: 5 },
    { title: 'Corta-vento', quantity: 2 },
  ],
}

describe('Shopify → kanban', () => {
  it('mapeia pedido novo para Pedido feito', () => {
    const card = mapShopifyOrderToCard(order)
    assert.equal(card.id, cardIdShopify(998877))
    assert.equal(card.columnId, COLUNA_PEDIDO_FEITO_ID)
    assert.equal(card.cliente, 'Maria Silva')
    assert.equal(card.numeroPedido, '1042')
    assert.equal(card.canal, 'ecommerce')
    assert.equal(card.quantidade, 7)
    assert.equal(card.linhasPedido.length, 2)
    assert.equal(card.linhasPedido[0].quantidade, 5)
    assert.equal(card.linhasPedido[0].titulo, 'Polo')
    assert.equal(card.origem, 'shopify')
    assert.equal(pedidoFaltaLogo(card), true)
  })

  it('não apaga nem regride etapa local sem tag mais nova', () => {
    const mapped = mapShopifyOrderToCard(order)
    const existing = {
      ...mapped,
      columnId: 'logos-producao',
      etapaDesde: '2026-10-05T13:00:00Z',
      logoEnviadaCliente: ['https://img/logo.png'],
      comentarios: [{ id: 'c1', texto: 'ok', autorNome: 'A', autorEmail: 'a@a', at: '2026-10-05T13:00:00Z' }],
    }
    const out = mesclarCardShopify(existing, mapped, '2026-10-05T12:05:00Z')
    assert.equal(out.columnId, 'logos-producao')
    assert.equal(out.logoEnviadaCliente.length, 1)
    assert.equal(out.comentarios.length, 1)
  })

  it('lê e grava tag de etapa', () => {
    assert.equal(parseEtapaTag('vip, vestfirma-etapa:logos-prontas'), 'logos-prontas')
    assert.equal(mergeShopifyEtapaTags('vip, vestfirma-etapa:pedido-feito', 'em-aplicacao'), 'vip, vestfirma-etapa:em-aplicacao')
  })
})
