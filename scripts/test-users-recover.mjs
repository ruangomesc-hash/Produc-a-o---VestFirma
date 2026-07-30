import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { recoverUsersFromBackups, mergeUsersById } from '../server/usersRecover.mjs'

test('recoverUsersFromBackups: usa backup quando users.json sumiu', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vestfirma-users-'))
  process.env.BOARD_DATA_DIR = dir
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
