import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ensureStorageReady, getBoardPaths } from './dataPaths.mjs'
import { mergeVendedoresUnion } from '../shared/boardVendedoresMerge.mjs'
import {
  backupBoardBeforeWrite,
  mergeBoardPreservingPedidos,
  readExistingBoard,
} from './boardPersist.mjs'

function vendedorFromUser(user) {
  return {
    id: crypto.randomUUID(),
    nome: String(user.name || user.email || '').trim() || user.email,
    email: user.email,
    userId: user.id,
    managedRole: user.role,
  }
}

function findVendedorForUser(vendedores, user) {
  const email = String(user.email || '').trim().toLowerCase()
  return (
    vendedores.find(
      (v) =>
        v.userId === user.id ||
        (email && v.email?.trim().toLowerCase() === email),
    ) ?? null
  )
}

/** Garante linha de vendedor no board.json quando um login de vendedor é criado/restaurado. */
export async function syncBoardVendedorFromUser(user) {
  if (!user?.id || !user?.email || user.role !== 'vendedor') return false

  await ensureStorageReady()
  const { boardFile } = getBoardPaths()
  const existing = (await readExistingBoard(boardFile)) ?? {
    columns: [],
    vendedores: [],
    segmentos: [],
    cards: [],
  }

  const current = existing.vendedores ?? []
  const found = findVendedorForUser(current, user)
  const nextRow = found
    ? {
        ...found,
        nome: String(user.name || found.nome || user.email).trim() || user.email,
        email: user.email,
        userId: user.id,
        managedRole: 'vendedor',
      }
    : vendedorFromUser(user)

  const vendedores = found
    ? current.map((v) => (v.id === found.id ? nextRow : v))
    : [...current, nextRow]

  const incoming = {
    ...existing,
    vendedores: mergeVendedoresUnion(current, vendedores),
  }
  const merged = mergeBoardPreservingPedidos(existing, incoming)

  await backupBoardBeforeWrite(boardFile)
  const out = JSON.stringify(merged)
  await fs.mkdir(path.dirname(boardFile), { recursive: true })
  const tmp = `${boardFile}.tmp`
  await fs.writeFile(tmp, out, 'utf8')
  await fs.rename(tmp, boardFile)
  return true
}
