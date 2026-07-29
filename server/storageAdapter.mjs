import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA_DIR = process.env.BOARD_DATA_DIR || path.join(ROOT, 'data')

const BLOB_PREFIX = 'vestfirma/'

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL)
}

async function blobModule() {
  return import('@vercel/blob')
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

  try {
    const raw = await fs.readFile(path.join(DATA_DIR, filename), 'utf8')
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

  await fs.mkdir(DATA_DIR, { recursive: true })
  const full = path.join(DATA_DIR, filename)
  const tmp = `${full}.tmp`
  await fs.writeFile(tmp, json, 'utf8')
  await fs.rename(tmp, full)
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

  try {
    return await fs.readFile(path.join(DATA_DIR, filename), 'utf8')
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

  await fs.mkdir(DATA_DIR, { recursive: true })
  const full = path.join(DATA_DIR, filename)
  const tmp = `${full}.tmp`
  await fs.writeFile(tmp, text, 'utf8')
  await fs.rename(tmp, full)
}
