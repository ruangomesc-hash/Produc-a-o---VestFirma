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

test('administrador adicional: mantém acesso principal, persiste e exige autorização administrativa', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vestfirma-secondary-admin-'))
  __resetStoragePathsForTests()
  process.env.BOARD_DATA_DIR = dir
  process.env.VESTFIRMA_TEST_ISOLATE_DATA = '1'
  process.env.REQUIRE_LOGIN = 'true'
  process.env.ADDITIONAL_ADMIN_EMAILS = 'socia@example.test'
  const {
    ensureUsersSeeded, listUsers, createUser, verifyUserPassword, updateUser, handleUsersApi,
  } = await import('../server/users.mjs')
  try {
    await ensureUsersSeeded()
    const [owner] = await listUsers()
    const secondary = await createUser('socia@example.test', 'admin', 'Sócia')
    assert.equal(secondary.role, 'admin')
    assert.notEqual(secondary.id, owner.id)
    assert.notEqual(secondary.password, owner.password)

    __resetStoragePathsForTests()
    const reloaded = await listUsers()
    assert.equal(reloaded.length, 2)
    assert.deepEqual(reloaded.find((user) => user.id === owner.id), owner)
    assert.equal((await verifyUserPassword(secondary.email, secondary.password))?.role, 'admin')
    assert.equal((await verifyUserPassword(owner.email, owner.password))?.role, 'admin')
    await assert.rejects(updateUser(owner.id, { role: 'vendedor' }), /administrador geral/)
    await assert.rejects(createUser('outro@example.test', 'admin', 'Outro'), /não está autorizado/)
    await assert.rejects(updateUser(secondary.id, { email: 'outro@example.test' }), /não está autorizado/)
    const renamed = await updateUser(secondary.id, { name: 'Sócia administradora' })
    assert.equal(renamed.name, 'Sócia administradora')
    assert.equal(renamed.email, secondary.email)

    for (const role of ['gerente', 'expedicao', 'impressao', 'vendedor']) {
      let status
      let bodyRead = false
      const res = { writeHead: (value) => { status = value }, end: () => {} }
      await handleUsersApi(
        { method: 'POST' }, res,
        async () => { bodyRead = true; return JSON.stringify({ email: 'intruso@example.test', role: 'admin' }) },
        async () => ({ role, userId: 'secondary-test' }),
        () => ({}),
      )
      assert.equal(status, 403)
      assert.equal(bodyRead, false)
    }
    assert.equal((await listUsers()).length, 2)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
    delete process.env.ADDITIONAL_ADMIN_EMAILS
    __resetStoragePathsForTests()
  }
})
