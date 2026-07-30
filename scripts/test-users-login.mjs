import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { __resetStoragePathsForTests } from '../server/dataPaths.mjs'

test('login: francejunior@vestfirma entra com senha gravada', async () => {
  __resetStoragePathsForTests()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vestfirma-login-'))
  process.env.BOARD_DATA_DIR = dir
  process.env.VESTFIRMA_TEST_ISOLATE_DATA = '1'
  process.env.REQUIRE_LOGIN = 'false'

  const { createUser, verifyUserPassword, userExistsOnServer } = await import('../server/users.mjs')

  const created = await createUser('francejunior@vestfirma', 'vendedor', 'France Junior')
  assert.ok(created.password)

  assert.equal(await userExistsOnServer('francejunior@vestfirma'), true)

  const ok = await verifyUserPassword('francejunior@vestfirma', created.password)
  assert.ok(ok)
  assert.equal(ok.email, 'francejunior@vestfirma')

  const bad = await verifyUserPassword('francejunior@vestfirma', 'senha-errada')
  assert.equal(bad, null)

  const ghost = await verifyUserPassword('naoexiste@vestfirma', 'x')
  assert.equal(ghost, null)
})

test('mergeUsersById: backup não apaga senha nova do disco', async () => {
  const { mergeUsersById } = await import('../server/usersRecover.mjs')
  const disk = [
    {
      id: 'fr1',
      email: 'francejunior@vestfirma',
      password: 'senhaNova123',
      createdAt: '2026-07-30T15:00:00.000Z',
    },
  ]
  const backup = [
    {
      id: 'fr1',
      email: 'francejunior@vestfirma',
      password: 'senhaVelha999',
      createdAt: '2026-07-29T10:00:00.000Z',
    },
  ]
  const merged = mergeUsersById(disk, backup)
  assert.equal(merged[0].password, 'senhaNova123')
})
