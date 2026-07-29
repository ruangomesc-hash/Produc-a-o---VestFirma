import fs from 'node:fs/promises'
import path from 'node:path'
import { ensureStorageReady, getDataDir } from './dataPaths.mjs'

const USERS_FILE = 'users.json'
const MAX_BACKUPS = 32

/** Serializa gravações — evita corrida que apaga usuários recém-cadastrados. */
let writeChain = Promise.resolve()

function usersPath() {
  return path.join(getDataDir(), USERS_FILE)
}

async function pathExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function mergeUsersById(a, b) {
  const byId = new Map()
  for (const u of a ?? []) {
    if (u?.id) byId.set(u.id, u)
  }
  for (const u of b ?? []) {
    if (!u?.id) continue
    const prev = byId.get(u.id)
    byId.set(u.id, prev ? { ...prev, ...u } : u)
  }
  return Array.from(byId.values())
}

async function readUsersFileOrNull() {
  await ensureStorageReady()
  const file = usersPath()
  if (!(await pathExists(file))) return null

  const raw = await fs.readFile(file, 'utf8')
  if (!raw.trim()) {
    throw new Error('users.json existe mas está vazio — não sobrescrever')
  }
  const data = JSON.parse(raw)
  if (!data || !Array.isArray(data.users)) {
    throw new Error('users.json inválido — não sobrescrever')
  }
  return data
}

async function readUsersFromBackup() {
  const file = usersPath()
  const bak = `${file}.bak`
  if (!(await pathExists(bak))) return null
  const raw = await fs.readFile(bak, 'utf8')
  const data = JSON.parse(raw)
  if (!data?.users?.length) return null
  return data
}

/** Lê users.json; se falhar, tenta .bak; nunca devolve lista vazia “fantasma” se o arquivo existir. */
export async function loadUsersData() {
  try {
    const data = await readUsersFileOrNull()
    if (data) return data
    return { users: [] }
  } catch (err) {
    const backup = await readUsersFromBackup()
    if (backup) {
      console.warn('[vestfirma] users.json ilegível — restaurando de .bak')
      return backup
    }
    throw err
  }
}

async function backupUsersBeforeWrite(file, payload) {
  if (!(await pathExists(file))) return
  const dir = path.dirname(file)
  const backupsDir = path.join(dir, 'backups')
  await fs.mkdir(backupsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await fs.writeFile(path.join(backupsDir, `users-${stamp}.json`), payload, 'utf8')
  await fs.writeFile(`${file}.bak`, payload, 'utf8')

  try {
    const names = (await fs.readdir(backupsDir))
      .filter((n) => n.startsWith('users-') && n.endsWith('.json'))
      .sort()
    while (names.length > MAX_BACKUPS) {
      const old = names.shift()
      if (old) await fs.unlink(path.join(backupsDir, old)).catch(() => {})
    }
  } catch {
    /* ignore */
  }
}

async function writeUsersAtomic(users) {
  await ensureStorageReady()
  const file = usersPath()
  const json = JSON.stringify({ users }, null, 2)
  const tmp = `${file}.tmp`
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(tmp, json, 'utf8')
  await fs.rename(tmp, file)
}

/**
 * @param {(users: object[]) => object[] | Promise<object[]>} mutate
 * @param {{ replace?: boolean }} opts — replace=true grava a lista exata (exclusão); senão faz merge por id.
 */
export function mutateUsersStore(mutate, opts = {}) {
  const replace = Boolean(opts.replace)
  writeChain = writeChain.then(async () => {
    const disk = await loadUsersData()
    const current = disk.users ?? []
    const next = await mutate([...current])
    if (!Array.isArray(next)) {
      throw new Error('mutateUsersStore: lista inválida')
    }
    let merged = next
    if (!replace) {
      let againUsers = []
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const again = await loadUsersData()
          againUsers = again.users ?? []
          break
        } catch {
          await new Promise((r) => setTimeout(r, 40 * (attempt + 1)))
        }
      }
      merged = mergeUsersById(againUsers, next)
    }
    const file = usersPath()
    if (await pathExists(file)) {
      try {
        const prev = await fs.readFile(file, 'utf8')
        await backupUsersBeforeWrite(file, prev)
      } catch {
        /* ignore */
      }
    }
    await writeUsersAtomic(merged)
    const verify = await readUsersFileOrNull()
    if (!verify || !Array.isArray(verify.users)) {
      throw new Error('Falha ao verificar users.json após gravação')
    }
    for (const u of merged) {
      if (!u?.id) continue
      if (!verify.users.some((x) => x.id === u.id)) {
        throw new Error(`users.json não contém o usuário recém-gravado (${u.email || u.id})`)
      }
    }
    return merged
  })
  return writeChain
}

export async function usersStoreFileExists() {
  await ensureStorageReady()
  return pathExists(usersPath())
}
