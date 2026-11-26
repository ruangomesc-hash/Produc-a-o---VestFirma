import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import { zipArquivos } from '../shared/zipArquivos.mjs'

const exec = promisify(execFile)

test('o zip abre e cada pedido fica no próprio PDF', async () => {
  const blob = await zipArquivos([
    { nome: 'pedido #1138 - vestfirma.pdf', dados: new TextEncoder().encode('%PDF-1138') },
    { nome: 'pedido #1205 - vestfirma.pdf', blob: new Blob([new TextEncoder().encode('%PDF-1205')]) },
  ])
  assert.equal(blob.type, 'application/zip')
  const pasta = await mkdtemp(join(tmpdir(), 'vestfirma-zip-'))
  const caminho = join(pasta, 'pedidos - vestfirma.zip')
  await writeFile(caminho, Buffer.from(await blob.arrayBuffer()))
  try {
    const lista = await exec('python3', [
      '-c',
      'import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print("\\n".join(n + "\\t" + z.read(n).decode() for n in z.namelist()))',
      caminho,
    ])
    assert.equal(
      lista.stdout,
      'pedido #1138 - vestfirma.pdf\t%PDF-1138\npedido #1205 - vestfirma.pdf\t%PDF-1205\n',
    )
  } finally {
    await rm(pasta, { recursive: true, force: true })
  }
})

test('nome vazio no zip vira arquivo', async () => {
  const blob = await zipArquivos([{ nome: '', dados: new Uint8Array([1, 2, 3]) }])
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const texto = new TextDecoder().decode(bytes)
  assert.equal(texto.includes('arquivo'), true)
})
