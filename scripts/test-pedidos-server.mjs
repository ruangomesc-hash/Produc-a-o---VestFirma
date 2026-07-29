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
