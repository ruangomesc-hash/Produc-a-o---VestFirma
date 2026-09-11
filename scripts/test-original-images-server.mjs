import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { once } from 'node:events'

const root = fileURLToPath(new URL('../', import.meta.url))

test('API: originais e aprovação sobrevivem ao reinício completo, com login e download íntegro', { timeout: 25000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vestfirma-image-api-'))
  const password = crypto.randomBytes(24).toString('hex')
  const env = { ...process.env, BOARD_DATA_DIR: dir, BOARD_DATA_FILE: path.join(dir, 'board.json'), VESTFIRMA_TEST_ISOLATE_DATA: '1', REQUIRE_LOGIN: 'true', SEED_ADMIN_EMAIL: 'test@example.test', SEED_ADMIN_PASSWORD: password, SESSION_SECRET: crypto.randomBytes(32).toString('hex'), SESSION_MODE: 'jwt', HOST: '127.0.0.1', PORT: '0', EXTERNALIZE_BOARD_LOGOS: '1' }
  for (const key of ['RENDER', 'VERCEL', 'BLOB_READ_WRITE_TOKEN', 'API_ONLY', 'WHATSAPP_WEBHOOK_URL']) delete env[key]
  let child
  async function start() {
    child = spawn(process.execPath, [path.join(root, 'server/server.mjs')], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
    return new Promise((resolve, reject) => {
      let output = ''
      const timer = setTimeout(() => reject(new Error(`Servidor não iniciou: ${output}`)), 7000)
      child.stdout.on('data', (bytes) => {
        output += bytes
        const match = output.match(/VestFirma Kanban — (http:\/\/127\.0\.0\.1:\d+)/)
        if (match) { clearTimeout(timer); resolve(match[1]) }
      })
      child.stderr.on('data', (bytes) => { output += bytes })
      child.on('error', (err) => { clearTimeout(timer); reject(err) })
      child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Servidor encerrou (${code}): ${output}`)) })
    })
  }
  async function stop() {
    if (child && child.exitCode === null && child.signalCode === null) {
      const done = once(child, 'exit')
      child.kill('SIGTERM')
      await done
    }
  }
  try {
    let base = await start()
    assert.equal((await fetch(`${base}/api/board`)).status, 401)
    assert.equal((await fetch(`${base}/api/images`, { method: 'POST', body: 'unauthorized' })).status, 401)
    const health = await (await fetch(`${base}/api/health`)).json()
    assert.equal(health.originalImageUploads, true)
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: env.SEED_ADMIN_EMAIL, password }) })
    assert.equal(login.status, 200)
    const { token } = await login.json()
    const auth = { Authorization: `Bearer ${token}` }
    const bytes = await fs.readFile(path.join(root, 'tests/fixtures/original-2400px.png'))
    const upload = await fetch(`${base}/api/images`, { method: 'POST', headers: { ...auth, 'Content-Type': 'image/png' }, body: bytes })
    assert.equal(upload.status, 201)
    const image = await upload.json()
    assert.equal(image.size, bytes.length)
    const board = { columns: [{ id: 'entrada', title: 'Entrada' }], vendedores: [], cards: [{ id: 'image-api-test', columnId: 'entrada', cliente: 'Teste', numeroPedido: 'IMAGE-TEST', quantidade: 1, logoEnviadaCliente: image.url, logoProntaImpressao: image.url, previewAprovacaoCliente: image.url }] }
    const save = await fetch(`${base}/api/board`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(board) })
    assert.equal(save.status, 200, await save.text())
    assert.equal((await fetch(`${base}/api/images`, { method: 'POST', headers: auth, body: '<svg>invalid</svg>' })).status, 415)
    assert.equal((await fetch(`${base}/api/images`, { method: 'POST', headers: auth, body: Buffer.alloc(25 * 1024 * 1024 + 1) })).status, 413)
    await stop()
    base = await start()
    const reloaded = await fetch(`${base}/api/board`, { headers: auth })
    assert.equal(reloaded.status, 200)
    const saved = await reloaded.json()
    for (const field of ['logoEnviadaCliente', 'logoProntaImpressao', 'previewAprovacaoCliente']) {
      const value = saved.cards[0][field]
      assert.equal(Array.isArray(value) ? value[0] : value, image.url)
    }
    const download = await fetch(`${base}${image.url}?download=1`)
    assert.equal(download.status, 200)
    assert.equal(download.headers.get('Content-Type'), 'image/png')
    assert.match(download.headers.get('Content-Disposition'), /^attachment;/)
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes)
    assert.equal((await fetch(`${base}${image.url}`, { method: 'HEAD' })).status, 200)
  } finally {
    await stop()
    await fs.rm(dir, { recursive: true, force: true })
  }
})
