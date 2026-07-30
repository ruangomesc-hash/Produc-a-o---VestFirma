import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { recoverUsersFromBackups, mergeUsersById } from '../server/usersRecover.mjs'
import { assertUserDeleteAllowed } from '../server/dataProtection.mjs'
import { __resetStoragePathsForTests } from '../server/dataPaths.mjs'

test('assertUserDeleteAllowed: bloqueia redução sem exclusão explícita', () => {
  const current = [
    { id: '1', email: 'a@test.com' },
    { id: '2', email: 'b@test.com' },
  ]
  assert.throws(
    () => assertUserDeleteAllowed(current, [{ id: '1', email: 'a@test.com' }]),
    /PROTEÇÃO/,
  )
})

test('assertUserDeleteAllowed: permite exclusão com id confirmado', () => {
  const current = [
    { id: '1', email: 'a@test.com' },
    { id: '2', email: 'b@test.com' },
  ]
  assert.doesNotThrow(() =>
    assertUserDeleteAllowed(current, [{ id: '1', email: 'a@test.com' }], '2'),
  )
})

test('recoverUsersFromBackups: usa backup quando users.json sumiu', async () => {
  __resetStoragePathsForTests()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vestfirma-users-'))
  process.env.BOARD_DATA_DIR = dir
  process.env.VESTFIRMA_TEST_ISOLATE_DATA = '1'
  const file = path.join(dir, 'users.json')
  const backupsDir = path.join(dir, 'backups')
  await fs.mkdir(backupsDir, { recursive: true })
  const france = {
    id: 'fr1',
    email: 'france@vestfirma.com',
    name: 'France',
    role: 'vendedor',
    password: 'abc',
  }
  await fs.writeFile(
    `${file}.bak`,
    JSON.stringify({ users: [{ id: 'adm', email: 'admin@test.com', role: 'admin' }, france] }),
    'utf8',
  )
  const recovered = await recoverUsersFromBackups()
  assert.equal(recovered.length, 2)
  assert.ok(recovered.some((u) => u.email === 'france@vestfirma.com'))
})

test('mergeUsersById: nunca perde usuários existentes', () => {
  const a = [{ id: '1', email: 'a@test.com', role: 'admin' }]
  const b = [
    { id: '2', email: 'france@test.com', role: 'vendedor' },
    { id: '1', email: 'a@test.com', role: 'admin', name: 'Admin' },
  ]
  const merged = mergeUsersById(a, b)
  assert.equal(merged.length, 2)
})

test('syncMissingUsersFromClient: grava usuários enviados pelo navegador', async () => {
  __resetStoragePathsForTests()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vestfirma-users-sync-'))
  process.env.BOARD_DATA_DIR = dir
  process.env.VESTFIRMA_TEST_ISOLATE_DATA = '1'
  const file = path.join(dir, 'users.json')
  await fs.writeFile(
    file,
    JSON.stringify({
      users: [{ id: 'adm', email: 'admin@test.com', role: 'admin', password: 'x' }],
    }),
    'utf8',
  )
  const { syncMissingUsersFromClient } = await import('../server/users.mjs')
  const france = {
    id: 'fr1',
    email: 'france@vestfirma.com',
    name: 'France',
    role: 'vendedor',
    password: 'senha123',
  }
  const result = await syncMissingUsersFromClient([france])
  assert.equal(result.added, 1)
  const raw = JSON.parse(await fs.readFile(file, 'utf8'))
  assert.ok(raw.users.some((u) => u.email === 'france@vestfirma.com'))
})
