/**
 * Integração: criar usuário persiste no disco e sobrevive reload simulado.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { __resetStoragePathsForTests } from '../server/dataPaths.mjs'

test('createUser + loadRaw: persiste após simular novo request', async () => {
  __resetStoragePathsForTests()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vestfirma-users-live-'))
  process.env.BOARD_DATA_DIR = dir
  process.env.VESTFIRMA_TEST_ISOLATE_DATA = '1'
  process.env.REQUIRE_LOGIN = 'false'

  const { createUser, listUsers } = await import('../server/users.mjs')

  const user = await createUser('france@test.com', 'vendedor', 'France')
  assert.ok(user.id)
  assert.equal(user.email, 'france@test.com')

  const raw = JSON.parse(await fs.readFile(path.join(dir, 'users.json'), 'utf8'))
  assert.ok(raw.users.some((u) => u.email === 'france@test.com'), 'users.json no disco')

  const list = await listUsers()
  assert.ok(list.some((u) => u.email === 'france@test.com'), 'listUsers retorna France')

  __resetStoragePathsForTests()
  process.env.BOARD_DATA_DIR = dir
  process.env.VESTFIRMA_TEST_ISOLATE_DATA = '1'
  const { listUsers: listAgain } = await import('../server/users.mjs')
  const reloaded = await listAgain()
  assert.ok(
    reloaded.some((u) => u.email === 'france@test.com'),
    'sobrevive simulação de restart (mesmo disco)',
  )
})
