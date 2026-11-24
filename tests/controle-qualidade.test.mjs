import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COLUNA_CONTROLE_QUALIDADE_ID,
  COLUNA_DISPONIVEIS_APLICACAO_ID,
  COLUNA_LOGO_SOLICITADA_ID,
  aplicarControleQualidade,
} from '../shared/controleQualidade.mjs'

const colunas = [
  { id: 'pedido-feito', title: 'Pedido feito' },
  { id: 'logos-recebidas', title: 'Logos liberadas para produção' },
  { id: 'logos-prontas', title: 'Logos prontas' },
  { id: 'disponiveis-aplicacao', title: 'Disponíveis para aplicação' },
  { id: 'liberado-logistica', title: 'Liberado para logística' },
  { id: COLUNA_LOGO_SOLICITADA_ID, title: 'logo solicitada' },
  { id: 'etapa-extra', title: 'Costura especial' },
  { id: 'pedido-enviado', title: 'Pedido enviado' },
]

function card(id, columnId, extra = {}) {
  return { id, columnId, numeroPedido: id, historicoEtapa: [], ...extra }
}

test('leva logo solicitada para controle de qualidade e mantém os pedidos', () => {
  const cards = [
    card('a', COLUNA_LOGO_SOLICITADA_ID),
    card('b', COLUNA_LOGO_SOLICITADA_ID, { arquivadoEm: '2026-11-01T00:00:00.000Z' }),
    card('c', 'logos-recebidas'),
    card('d', 'etapa-extra'),
    card('e', 'pedido-enviado'),
  ]
  const primeiro = aplicarControleQualidade({ columns: colunas, cards, vendedores: [{ id: 'v1' }] })
  assert.equal(primeiro.changed, true)
  assert.equal(primeiro.board.cards.length, cards.length)
  assert.deepEqual(
    primeiro.board.cards.map((item) => item.id),
    ['a', 'b', 'c', 'd', 'e'],
  )
  assert.equal(primeiro.board.cards[0].columnId, COLUNA_CONTROLE_QUALIDADE_ID)
  assert.equal(primeiro.board.cards[1].columnId, COLUNA_CONTROLE_QUALIDADE_ID)
  assert.equal(primeiro.board.cards[1].arquivadoEm, '2026-11-01T00:00:00.000Z')
  assert.equal(primeiro.board.cards[2].columnId, 'logos-recebidas')
  assert.equal(primeiro.board.cards[3].columnId, 'etapa-extra')
  assert.equal(primeiro.board.vendedores[0].id, 'v1')
  assert.equal(
    primeiro.board.cards[0].historicoEtapa[0].detalhe,
    'Entrou em Controle de qualidade no lugar de logo solicitada',
  )
  assert.equal(primeiro.board.columns.some((col) => col.id === COLUNA_LOGO_SOLICITADA_ID), false)
  assert.equal(primeiro.board.columns.some((col) => col.id === 'etapa-extra'), true)
  assert.equal(primeiro.board.columns.some((col) => col.id === 'logos-recebidas'), true)
  const qualidade = primeiro.board.columns.findIndex((col) => col.id === COLUNA_CONTROLE_QUALIDADE_ID)
  const aplicacao = primeiro.board.columns.findIndex((col) => col.id === COLUNA_DISPONIVEIS_APLICACAO_ID)
  assert.equal(aplicacao, qualidade + 1)

  const segundo = aplicarControleQualidade(primeiro.board)
  assert.equal(segundo.changed, false)
  assert.equal(segundo.board.cards.length, cards.length)
})

test('reconhece a coluna pelo título e pelo id mesmo sem a coluna', () => {
  const porTitulo = aplicarControleQualidade({
    columns: [{ id: 'custom-logo', title: 'Logos solicitadas' }, { id: 'disponiveis-aplicacao', title: 'Disponíveis para aplicação' }],
    cards: [card('x', 'custom-logo')],
  })
  assert.equal(porTitulo.board.cards[0].columnId, COLUNA_CONTROLE_QUALIDADE_ID)
  assert.equal(porTitulo.board.columns.some((col) => col.id === 'custom-logo'), false)

  const orfa = aplicarControleQualidade({
    columns: [{ id: 'disponiveis-aplicacao', title: 'Disponíveis para aplicação' }],
    cards: [card('y', COLUNA_LOGO_SOLICITADA_ID)],
  })
  assert.equal(orfa.board.cards[0].columnId, COLUNA_CONTROLE_QUALIDADE_ID)
  assert.equal(orfa.board.cards.length, 1)
})
