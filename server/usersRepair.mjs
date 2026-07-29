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

async function readBoardVendedores() {
  await ensureStorageReady()
  const { boardFile } = getBoardPaths()
  try {
    const raw = await fs.readFile(boardFile, 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data?.vendedores) ? data.vendedores : []
  } catch {
    return []
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
