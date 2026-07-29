import fs from 'node:fs/promises'
import path from 'node:path'
import { getDataDir, ROOT, ensureStorageReady } from './dataPaths.mjs'

const BLOB_PREFIX = 'vestfirma/'

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

async function blobModule() {
  return import('@vercel/blob')
}

async function resolveWriteDir() {
  await ensureStorageReady()
  return getDataDir()
}

async function writeFileAtomic(filename, contents) {
  const dir = await resolveWriteDir()
  try {
    await fs.mkdir(dir, { recursive: true })
    const full = path.join(dir, filename)
    const tmp = `${full}.tmp`
    await fs.writeFile(tmp, contents, 'utf8')
    await fs.rename(tmp, full)
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? err.code : ''
    if (code !== 'EACCES' && code !== 'EPERM') throw err
    const fallback = path.join(ROOT, 'data')
    process.env.BOARD_DATA_DIR = fallback
    await fs.mkdir(fallback, { recursive: true })
    const full = path.join(fallback, filename)
    const tmp = `${full}.tmp`
    await fs.writeFile(tmp, contents, 'utf8')
    await fs.rename(tmp, full)
    console.warn('[vestfirma] Gravando em', fallback, '(fallback)')
  }
}

export async function readJsonStore(filename) {
  if (useBlob()) {
    try {
      const { head } = await blobModule()
      const meta = await head(`${BLOB_PREFIX}${filename}`)
      const res = await fetch(meta.url)
      if (!res.ok) return null
      const text = await res.text()
      if (!text.trim()) return null
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  await ensureStorageReady()
  try {
    const raw = await fs.readFile(path.join(getDataDir(), filename), 'utf8')
    if (!raw.trim()) return null
    return JSON.parse(raw)
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return null
    }
    return null
  }
}

export async function writeJsonStore(filename, data) {
  const json = JSON.stringify(data, null, 2)

  if (useBlob()) {
    const { put } = await blobModule()
    await put(`${BLOB_PREFIX}${filename}`, json, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
    return
  }

  await writeFileAtomic(filename, json)
}

export async function readTextStore(filename) {
  if (useBlob()) {
    try {
      const { head } = await blobModule()
      const meta = await head(`${BLOB_PREFIX}${filename}`)
      const res = await fetch(meta.url)
      if (!res.ok) return null
      return await res.text()
    } catch {
      return null
    }
  }

  await ensureStorageReady()
  try {
    return await fs.readFile(path.join(getDataDir(), filename), 'utf8')
  } catch {
    return null
  }
}

export async function writeTextStore(filename, text) {
  if (useBlob()) {
    const { put } = await blobModule()
    await put(`${BLOB_PREFIX}${filename}`, text, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
    return
  }

  await writeFileAtomic(filename, text)
}
