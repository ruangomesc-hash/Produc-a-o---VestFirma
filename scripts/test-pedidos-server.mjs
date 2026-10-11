/**
 * Teste de integração: PUT no servidor preserva pedidos e aceita pedido novo.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  mergeBoardPreservingPedidos,
  mergeBoardAddingMissingPedidosOnly,
  countBoardCards,
  preservarColunasDoQuadroGravado,
  readBoardWithRecovery,
} from '../server/boardPersist.mjs'

const col = 'col-1'
const baseBoard = () => ({
  columns: [{ id: col, title: 'Entrada' }],
  vendedores: [{ id: 'v1', nome: 'Junior', email: 'junior@test' }],
  segmentos: [],
  cards: [
    {
      id: 'existente',
      columnId: col,
      cliente: 'Antigo',
      numeroPedido: '100',
      quantidade: 1,
      vendedorId: 'v1',
      createdAt: '2026-07-29T10:00:00.000Z',
      etapaDesde: '2026-07-29T10:00:00.000Z',
    },
  ],
})

test('gravação do quadro avisa os painéis abertos na hora', async () => {
  const { writeBoardAtomic } = await import('../server/boardPersist.mjs')
  const { addBoardLiveClient } = await import('../server/boardLive.mjs')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vf-live-'))
  const file = path.join(dir, 'board.json')
  const chunks = []
  const remove = addBoardLiveClient({
    write(line) {
      chunks.push(line)
    },
  })
  try {
    await writeBoardAtomic(file, { columns: [], cards: [], vendedores: [] })
    assert.equal(chunks.length, 1)
    assert.match(chunks[0], /event: board/)
  } finally {
    remove()
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('servidor: quadro atrasado não desfaz a etapa mais nova', () => {
  const latest = baseBoard()
  latest.cards[0] = {
    ...latest.cards[0],
    columnId: 'liberado-logistica',
    etapaDesde: '2026-10-11T21:00:00.000Z',
    historicoEtapa: [
      {
        id: 'h-novo',
        tipo: 'avancou',
        columnId: 'liberado-logistica',
        at: '2026-10-11T21:00:00.000Z',
      },
    ],
  }
  const stale = baseBoard()
  stale.cards[0] = {
    ...stale.cards[0],
    columnId: 'em-aplicacao',
    etapaDesde: '2026-10-11T18:00:00.000Z',
    historicoEtapa: [
      {
        id: 'h-velho',
        tipo: 'avancou',
        columnId: 'em-aplicacao',
        at: '2026-10-11T18:00:00.000Z',
      },
    ],
  }
  const merged = mergeBoardPreservingPedidos(latest, stale)
  assert.equal(merged.cards.find((c) => c.id === 'existente')?.columnId, 'liberado-logistica')
})

test('servidor: merge preserva existente e adiciona novo id', () => {
  const existing = baseBoard()
  const incoming = {
    ...baseBoard(),
    cards: [
      ...baseBoard().cards,
      {
        id: 'pedido-junior-hoje',
        columnId: col,
        cliente: 'Cliente Junior',
        numeroPedido: '200',
        quantidade: 2,
        vendedorId: 'v1',
        createdAt: '2026-07-29T15:00:00.000Z',
        etapaDesde: '2026-07-29T15:00:00.000Z',
      },
    ],
  }
  const merged = mergeBoardPreservingPedidos(existing, incoming)
  assert.equal(countBoardCards(merged), 2)
  assert.ok(merged.cards.some((c) => c.id === 'pedido-junior-hoje'))
})

test('servidor: mergeBoardAddingMissingPedidosOnly para restaurar backup', () => {
  const current = baseBoard()
  const backup = {
    ...baseBoard(),
    cards: [
      ...baseBoard().cards,
      {
        id: 'só-no-backup',
        columnId: col,
        cliente: 'Perdido',
        numeroPedido: '201',
        quantidade: 1,
        vendedorId: 'v1',
      },
    ],
  }
  const restored = mergeBoardAddingMissingPedidosOnly(current, backup)
  assert.equal(countBoardCards(restored), 2)
})

test('servidor: admin pode apagar último pedido arquivado (body vazio + header)', () => {
  const existing = {
    columns: [{ id: col, title: 'Entrada' }],
    vendedores: [],
    cards: [
      {
        id: '9599-id',
        columnId: col,
        cliente: 'testando dan',
        numeroPedido: '9599',
        arquivadoEm: '2026-07-29T20:09:00.000Z',
      },
    ],
  }
  const incoming = { ...existing, cards: [] }
  const removeIds = ['9599-id']
  const merged = mergeBoardPreservingPedidos(existing, incoming, removeIds)
  assert.equal(countBoardCards(merged), 0)
})

test('servidor: quadro vazio válido não ressuscita pedido do .bak', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vestfirma-empty-board-'))
  const file = path.join(dir, 'board.json')
  await fs.writeFile(
    `${file}.bak`,
    JSON.stringify({
      columns: [{ id: col, title: 'Entrada' }],
      cards: [{ id: '9599-id', columnId: col, numeroPedido: '9599', arquivadoEm: '2026-07-29T20:00:00.000Z' }],
    }),
    'utf8',
  )
  await fs.writeFile(
    file,
    JSON.stringify({ columns: [{ id: col, title: 'Entrada' }], cards: [] }),
    'utf8',
  )
  const data = await readBoardWithRecovery(file)
  assert.equal(countBoardCards(data), 0)
})

test('servidor: simula gravação em disco após merge', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vestfirma-board-'))
  const file = path.join(dir, 'board.json')
  const existing = baseBoard()
  await fs.writeFile(file, JSON.stringify(existing), 'utf8')

  const incoming = mergeBoardPreservingPedidos(existing, {
    ...existing,
    cards: [
      ...existing.cards,
      {
        id: 'novo',
        columnId: col,
        cliente: 'Novo',
        numeroPedido: '300',
        quantidade: 1,
        vendedorId: 'v1',
      },
    ],
  })
  await fs.writeFile(file, JSON.stringify(incoming), 'utf8')
  const raw = JSON.parse(await fs.readFile(file, 'utf8'))
  assert.equal(countBoardCards(raw), 2)
})

test('save do quadro inteiro não desfaz a coluna gravada, nem ao voltar etapa', () => {
  const latest = baseBoard()
  latest.columns = [
    { id: 'pedido-feito', title: 'Pedido feito' },
    { id: 'liberado-logistica', title: 'Liberado' },
  ]
  latest.cards[0] = {
    ...latest.cards[0],
    columnId: 'liberado-logistica',
    etapaDesde: '2026-10-11T18:00:00.000Z',
  }
  const stale = {
    ...latest,
    cards: [
      {
        ...latest.cards[0],
        columnId: 'pedido-feito',
        etapaDesde: '2026-10-11T21:30:00.000Z',
        historicoEtapa: [{ id: 'h', tipo: 'voltou', columnId: 'pedido-feito', at: '2026-10-11T21:30:00.000Z' }],
      },
    ],
  }
  const kept = preservarColunasDoQuadroGravado(latest, stale)
  assert.equal(kept.cards[0].columnId, 'liberado-logistica')
  assert.equal(countBoardCards(kept), 1)
})

test('save do quadro inteiro aceita pedido novo e coluna que foi apagada', () => {
  const latest = baseBoard()
  latest.columns = [
    { id: col, title: 'Entrada' },
    { id: 'custom', title: 'Extra' },
  ]
  latest.cards[0] = { ...latest.cards[0], columnId: 'custom' }
  const incoming = {
    ...latest,
    columns: [{ id: col, title: 'Entrada' }],
    cards: [
      { ...latest.cards[0], columnId: col },
      {
        id: 'novo',
        columnId: col,
        cliente: 'Novo',
        numeroPedido: '301',
        quantidade: 1,
        vendedorId: 'v1',
      },
    ],
  }
  const kept = preservarColunasDoQuadroGravado(latest, incoming)
  assert.equal(kept.cards.find((c) => c.id === 'existente').columnId, col)
  assert.equal(kept.cards.find((c) => c.id === 'novo').columnId, col)
  assert.equal(countBoardCards(kept), 2)
})

test('arraste grava só aquele pedido e avisa os painéis', async () => {
  const { applyBoardCardMove } = await import('../server/boardCardPatch.mjs')
  const { writeBoardAtomic, readExistingBoard, withBoardWriteLock, backupBoardBeforeWrite } = await import(
    '../server/boardPersist.mjs'
  )
  const { addBoardLiveClient } = await import('../server/boardLive.mjs')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vf-move-'))
  const file = path.join(dir, 'board.json')
  const board = baseBoard()
  board.columns = [
    { id: 'pedido-feito', title: 'Pedido feito' },
    { id: 'preview-em-andamento', title: 'Preview' },
  ]
  board.cards[0] = { ...board.cards[0], columnId: 'preview-em-andamento', shopifyOrderId: '1' }
  await writeBoardAtomic(file, board)
  const chunks = []
  const remove = addBoardLiveClient({
    write(line) {
      chunks.push(line)
    },
  })
  try {
    const result = await applyBoardCardMove(
      { cardId: 'existente', columnId: 'pedido-feito' },
      { user: 'Admin', email: 'a@test', role: 'admin' },
      {
        boardFilePath: () => file,
        backupBoardBeforeWrite,
        readExistingBoard,
        withBoardWriteLock,
        writeBoardAtomic,
      },
    )
    assert.equal(result.status, 200)
    assert.equal(result.body.columnId, 'pedido-feito')
    const saved = await readExistingBoard(file)
    assert.equal(saved.cards[0].columnId, 'pedido-feito')
    assert.equal(saved.cards[0].historicoEtapa.at(-1).tipo, 'voltou')
    assert.ok(chunks.some((line) => String(line).includes('event: board')))
  } finally {
    remove()
    await fs.rm(dir, { recursive: true, force: true })
  }
})
