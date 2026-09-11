import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { test } from 'node:test'
import { deflateSync } from 'node:zlib'
import { storeOriginalImage } from '../server/imageUploads.mjs'
import { externalizeBoardLogos, resolveLogoFile } from '../server/boardLogos.mjs'
import { MAX_IMAGE_BYTES } from '../shared/imageFormats.mjs'

// PNG RGBA válido de 2400 px, com transparência: detecta a antiga redução para 1200 px/JPEG.
export function originalPng() {
  function crc32(bytes) {
    let crc = 0xffffffff
    for (const byte of bytes) {
      crc ^= byte
      for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    return (crc ^ 0xffffffff) >>> 0
  }
  function chunk(kind, bytes) {
    const body = Buffer.concat([Buffer.from(kind), bytes])
    const size = Buffer.alloc(4), crc = Buffer.alloc(4)
    size.writeUInt32BE(bytes.length)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([size, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(2400, 0)
  ihdr.writeUInt32BE(2, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const row = Buffer.alloc(2400 * 4 + 1)
  for (let i = 1; i < row.length; i += 4) { row[i] = 30; row[i + 1] = 170; row[i + 2] = 120; row[i + 3] = i % 8 ? 128 : 0 }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat([row, row]))), chunk('IEND', Buffer.alloc(0))])
}

test('preserva exatamente os bytes, resolução e transparência; troca de arte não altera a anterior', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vestfirma-originals-'))
  try {
    const original = originalPng()
    const first = await storeOriginalImage(original, dir)
    const filename = first.url.split('/').pop()
    const saved = await fs.readFile(path.join(dir, 'originals', filename))
    assert.deepEqual(saved, original)
    assert.equal(saved.readUInt32BE(16), 2400)
    assert.equal(saved[25], 6)
    assert.equal(first.mime, 'image/png')
    assert.equal(first.size, original.length)
    const other = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
    const replacement = await storeOriginalImage(other, dir)
    assert.notEqual(first.url, replacement.url)
    assert.equal(replacement.mime, 'image/gif')
    assert.deepEqual(await fs.readFile(path.join(dir, 'originals', filename)), original)
    assert.equal((await storeOriginalImage(original, dir)).url, first.url)
    assert.equal((await fs.readdir(path.join(dir, 'originals'))).length, 2)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('preserva os três anexos, inclusive aprovação, sem alterar pedidos ou links antigos', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vestfirma-approval-'))
  try {
    const bytes = originalPng()
    const image = `data:image/png;base64,${bytes.toString('base64')}`
    const board = { cards: [{ id: crypto.randomUUID(), cliente: 'Teste', logoEnviadaCliente: image, logoProntaImpressao: image, previewAprovacaoCliente: image }, { id: 'antigo', logoEnviadaCliente: '/api/logos/antigo/enviada' }] }
    const saved = await externalizeBoardLogos(board, dir)
    assert.equal(saved.cards.length, 2)
    for (const field of ['logoEnviadaCliente', 'logoProntaImpressao', 'previewAprovacaoCliente']) {
      assert.match(saved.cards[0][field][0], /^\/api\/images\/[a-f0-9]{64}\.png$/)
    }
    assert.deepEqual(saved.cards[1].logoEnviadaCliente, [board.cards[1].logoEnviadaCliente])
    assert.equal(board.cards[0].previewAprovacaoCliente, image)
    await fs.writeFile(path.join(dir, 'antigo-enviada.jpg'), 'existing-image')
    assert.equal((await resolveLogoFile(dir, 'antigo', 'enviada')).ext, 'jpg')
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('recusa arquivo vazio, formato inválido e arquivo acima de 25 MB', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vestfirma-invalid-image-'))
  try {
    await assert.rejects(storeOriginalImage(Buffer.alloc(0), dir), { status: 413 })
    await assert.rejects(storeOriginalImage(Buffer.from('<svg onload="alert(1)"></svg>'), dir), { status: 415 })
    await assert.rejects(storeOriginalImage(Buffer.alloc(MAX_IMAGE_BYTES + 1), dir), { status: 413 })
    assert.equal((await fs.readdir(dir)).length, 0)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})
