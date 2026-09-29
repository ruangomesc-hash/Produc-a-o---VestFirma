/**
 * Testes de regressão de merge (sem dependência do bundler Vite).
 * Mantém paridade com src/pedidosPolicy.ts e src/boardLoadMerge.ts.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  mergeBoardPreservingPedidos,
  mergeBoardAddingMissingPedidosOnly,
  countBoardCards,
} from '../server/boardPersist.mjs'

function pedidoRevisionMs(card) {
  let max = 0
  for (const e of card.historicoEtapa ?? []) {
    if (e?.at) {
      const t = Date.parse(e.at)
      if (!Number.isNaN(t)) max = Math.max(max, t)
    }
  }
  for (const iso of [card.etapaDesde, card.createdAt, card.arquivadoEm]) {
    if (iso) {
      const t = Date.parse(iso)
      if (!Number.isNaN(t)) max = Math.max(max, t)
    }
  }
  return max
}

function mergeOrderCard(existing, incoming) {
  const tExist = pedidoRevisionMs(existing)
  const tIn = pedidoRevisionMs(incoming)
  if (tIn >= tExist) return { ...existing, ...incoming }
  return { ...incoming, ...existing }
}

function mergeBoardShell(existing, incoming) {
  return {
    columns: incoming.columns?.length ? incoming.columns : (existing?.columns ?? incoming.columns),
    vendedores: incoming.vendedores?.length ? incoming.vendedores : (existing?.vendedores ?? []),
    segmentos: incoming.segmentos?.length ? incoming.segmentos : (existing?.segmentos ?? []),
  }
}

function mergeBoardRemotePrimary(remote, local) {
  const shell = mergeBoardShell(remote, local ?? remote)
  const byId = new Map()
  for (const c of remote.cards ?? []) {
    if (c?.id) byId.set(c.id, c)
  }
  for (const c of local?.cards ?? []) {
    if (!c?.id || !byId.has(c.id)) continue
    byId.set(c.id, mergeOrderCard(byId.get(c.id), c))
  }
  return { ...remote, ...shell, cards: [...byId.values()] }
}

function mergeBoardLoggedInFromServer(remote, local) {
  let board = mergeBoardRemotePrimary(remote, local)
  if (local?.cards?.length) {
    board = mergeBoardAddingMissingPedidosOnly(board, local)
  }
  return board
}

function boardComCards(...cards) {
  const col = 'logos-recebidas'
  return {
    columns: [{ id: col, title: 'Logos recebidas' }],
    vendedores: [],
    segmentos: [],
    cards: cards.map((c, i) => ({
      id: c.id ?? `card-${i}`,
      columnId: col,
      cliente: c.cliente ?? 'Cliente',
      numeroPedido: c.numeroPedido ?? String(1000 + i),
      quantidade: 1,
      vendedorId: c.vendedorId ?? null,
      createdAt: '2026-07-29T12:00:00.000Z',
      etapaDesde: '2026-07-29T12:00:00.000Z',
      historicoEtapa: [],
      arquivadoEm: c.arquivadoEm ?? null,
    })),
  }
}

describe('merge — pedido novo só no navegador (vendedor)', () => {
  it('mergeBoardRemotePrimary sozinho remove pedido local não enviado', () => {
    const remote = boardComCards({ id: 'a', numeroPedido: '1' })
    const local = boardComCards(
      { id: 'a', numeroPedido: '1' },
      { id: 'novo-junior', numeroPedido: '999', cliente: 'Junior' },
    )
    const merged = mergeBoardRemotePrimary(remote, local)
    assert.equal(countBoardCards(merged), 1)
    assert.ok(!merged.cards.some((c) => c.id === 'novo-junior'))
  })

  it('mergeBoardLoggedInFromServer mantém pedido local ausente no servidor', () => {
    const remote = boardComCards({ id: 'a', numeroPedido: '1' })
    const local = boardComCards(
      { id: 'a', numeroPedido: '1' },
      { id: 'novo-junior', numeroPedido: '999', cliente: 'Junior' },
    )
    const merged = mergeBoardLoggedInFromServer(remote, local)
    assert.equal(countBoardCards(merged), 2)
    assert.ok(merged.cards.some((c) => c.id === 'novo-junior'))
  })

  it('mergeBoardPreservingPedidos inclui pedido novo no PUT', () => {
    const remote = boardComCards({ id: 'a', numeroPedido: '1' })
    const incoming = boardComCards(
      { id: 'a', numeroPedido: '1' },
      { id: 'novo-junior', numeroPedido: '999' },
    )
    const merged = mergeBoardPreservingPedidos(remote, incoming)
    assert.equal(countBoardCards(merged), 2)
  })

  it('mergeBoardAddingMissingPedidosOnly não remove pedidos do servidor', () => {
    const primary = boardComCards({ id: 'srv', numeroPedido: '1' })
    const secondary = boardComCards({ id: 'fantasma', numeroPedido: '2' })
    const merged = mergeBoardAddingMissingPedidosOnly(primary, secondary)
    assert.equal(countBoardCards(merged), 2)
  })
})

describe('merge — comentários, logos e observação não se apagam', () => {
  it('une comentários de dois usuários no mesmo pedido', () => {
    const existing = boardComCards({ id: 'p1', numeroPedido: '1001' })
    existing.cards[0].comentarios = [
      { id: 'c-admin', texto: 'Na hora que for aplicar, me liga', at: '2026-09-24T17:13:00.000Z' },
    ]
    const incoming = boardComCards({ id: 'p1', numeroPedido: '1001' })
    incoming.cards[0].comentarios = [
      { id: 'c-prod', texto: 'Logo ok na máquina', at: '2026-09-24T18:00:00.000Z' },
    ]
    incoming.cards[0].etapaDesde = '2026-09-24T18:30:00.000Z'
    const merged = mergeBoardPreservingPedidos(existing, incoming)
    const ids = merged.cards[0].comentarios.map((c) => c.id).sort()
    assert.deepEqual(ids, ['c-admin', 'c-prod'])
    assert.equal(countBoardCards(merged), 1)
  })

  it('não descarta logo de impressão quando a outra cópia veio sem imagem', () => {
    const existing = boardComCards({ id: 'p1', numeroPedido: '1001' })
    existing.cards[0].logoProntaImpressao = ['/api/images/abc', '/api/images/def']
    const incoming = boardComCards({ id: 'p1', numeroPedido: '1001' })
    incoming.cards[0].logoProntaImpressao = []
    incoming.cards[0].etapaDesde = '2026-09-29T12:00:00.000Z'
    const merged = mergeBoardPreservingPedidos(existing, incoming)
    assert.deepEqual(merged.cards[0].logoProntaImpressao, ['/api/images/abc', '/api/images/def'])
    assert.equal(countBoardCards(merged), 1)
  })

  it('não apaga observação com texto vazio de outra aba', () => {
    const existing = boardComCards({ id: 'p1', numeroPedido: '1001' })
    existing.cards[0].observacao = 'Corta vento e calça, é um kit.'
    const incoming = boardComCards({ id: 'p1', numeroPedido: '1001' })
    incoming.cards[0].observacao = ''
    incoming.cards[0].etapaDesde = '2026-09-29T12:00:00.000Z'
    const merged = mergeBoardPreservingPedidos(existing, incoming)
    assert.equal(merged.cards[0].observacao, 'Corta vento e calça, é um kit.')
    assert.equal(countBoardCards(merged), 1)
  })
})

describe('pedidoGravadoNoServidor (contrato SaveBoardResult)', () => {
  it('exige ok e remote true', () => {
    const pedidoGravadoNoServidor = (r) => r.ok && r.remote === true
    assert.equal(pedidoGravadoNoServidor({ ok: true, remote: true }), true)
    assert.equal(pedidoGravadoNoServidor({ ok: true, remote: false }), false)
    assert.equal(pedidoGravadoNoServidor({ ok: false, remote: true, error: 'x' }), false)
  })
})
