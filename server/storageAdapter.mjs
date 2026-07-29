import fs from 'node:fs/promises'
import path from 'node:path'
import { getDataDir } from './dataPaths.mjs'

const BLOB_PREFIX = 'vestfirma/'

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
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

  const dir = getDataDir()
  try {
    const raw = await fs.readFile(path.join(dir, filename), 'utf8')
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

  const dir = getDataDir()
  await fs.mkdir(dir, { recursive: true })
  const full = path.join(dir, filename)
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

  const dir = getDataDir()
  await fs.mkdir(dir, { recursive: true })
  const full = path.join(dir, filename)
  const tmp = `${full}.tmp`
  await fs.writeFile(tmp, text, 'utf8')
  await fs.rename(tmp, full)
}
