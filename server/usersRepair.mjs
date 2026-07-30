import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ensureStorageReady, getBoardPaths } from './dataPaths.mjs'
import { normalizeLoginEmail } from '../shared/loginEmail.mjs'
import { mutateUsersStore } from './usersPersist.mjs'

function normEmail(email) {
  return normalizeLoginEmail(String(email || ''))
}

function isEmailLikeId(id) {
  return String(id || '').includes('@')
}

async function readBoardPayload(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Vendedores do quadro atual, .bak e backups/board-*.json (união por e-mail). */
async function readBoardVendedoresFromAllSources() {
  await ensureStorageReady()
  const { boardFile } = getBoardPaths()
  const dir = path.dirname(boardFile)
  const backupsDir = path.join(dir, 'backups')
  const files = [boardFile, `${boardFile}.bak`]

  try {
    const names = (await fs.readdir(backupsDir))
      .filter((n) => n.startsWith('board-') && n.endsWith('.json'))
      .sort()
      .reverse()
    for (const n of names.slice(0, 16)) {
      files.push(path.join(backupsDir, n))
    }
  } catch {
    /* sem backups */
  }

  const byEmail = new Map()
  for (const file of files) {
    const data = await readBoardPayload(file)
    if (!data?.vendedores?.length) continue
    for (const v of data.vendedores) {
      if (!v?.email?.trim()) continue
      const em = normEmail(v.email)
      if (!em) continue
      const prev = byEmail.get(em)
      byEmail.set(em, prev ? { ...prev, ...v } : v)
    }
  }
  return [...byEmail.values()]
}

async function readBoardVendedores() {
  const all = await readBoardVendedoresFromAllSources()
  if (all.length) return all
  await ensureStorageReady()
  const { boardFile } = getBoardPaths()
  const data = await readBoardPayload(boardFile)
  return Array.isArray(data?.vendedores) ? data.vendedores : []
}

export async function repairUsersFromBoardReport() {
  const { loadUsersData } = await import('./usersPersist.mjs')
  const before = (await loadUsersData()).users ?? []
  const after = await repairUsersMissingFromBoard(before)
  const added = after.filter((u) => !before.some((x) => x.id === u.id))
  return {
    added: added.length,
    users: after,
    created: added.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      password: u.password,
    })),
    vendedoresNoQuadro: (await readBoardVendedoresFromAllSources()).length,
    message:
      added.length > 0
        ? `Recriou ${added.length} acesso(s) a partir do quadro/backups do board.`
        : (await readBoardVendedoresFromAllSources()).length === 0
          ? 'Nenhum vendedor com e-mail encontrado no quadro nem nos backups do board.'
          : 'Todos os vendedores do quadro já têm login em users.json.',
  }
}

function findUserForVendedor(users, v) {
  const email = normEmail(v.email)
  if (email) {
    const byEm = users.find((u) => normEmail(u.email) === email)
    if (byEm) return byEm
  }
  const uid = v.userId
  if (uid && !isEmailLikeId(uid) && uid !== 'admin-seed') {
    const byId = users.find((u) => u.id === uid)
    if (byId) return byId
  }
  return null
}

/**
 * Se users.json perdeu cadastros mas o quadro ainda tem vendedores, recria os acessos.
 */
export async function repairUsersMissingFromBoard(users) {
  const list = [...(users ?? [])]
  const vendedores = await readBoardVendedores()
  const additions = []

  for (const v of vendedores) {
    if (!v?.email?.trim()) continue
    if (v.userId === 'admin-seed') continue
    const role = v.managedRole || 'vendedor'
    if (role !== 'vendedor' && role !== 'admin') continue
    if (role === 'admin') continue
    if (findUserForVendedor(list, v)) continue

    const email = normEmail(v.email)
    if (!email) continue

    const id =
      v.userId && !isEmailLikeId(v.userId) && v.userId !== 'admin-seed'
        ? v.userId
        : crypto.randomBytes(8).toString('hex')

    additions.push({
      id,
      email,
      name: String(v.nome || email).trim() || email,
      role: 'vendedor',
      password: randomPassword(),
      createdAt: new Date().toISOString(),
      repairedFromBoardAt: new Date().toISOString(),
    })
  }

  if (additions.length === 0) return list

  console.warn(
    `[vestfirma] Reparando ${additions.length} usuário(s) a partir do quadro (users.json incompleto)`,
  )

  let merged = list
  await mutateUsersStore((current) => {
    const out = [...current]
    for (const add of additions) {
      if (findUserForVendedor(out, add)) continue
      if (out.some((u) => u.id === add.id)) continue
      out.push(add)
    }
    merged = out
    return out
  })

  return merged
}

function randomPassword(length = 12) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[crypto.randomInt(0, chars.length)]
  }
  return out
}

export async function countUsersOnDisk() {
  await ensureStorageReady()
  const { dataDir } = getBoardPaths()
  const file = path.join(dataDir, 'users.json')
  try {
    const raw = await fs.readFile(file, 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data?.users) ? data.users.length : 0
  } catch {
    return 0
  }
}
