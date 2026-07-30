import fs from 'node:fs/promises'
import path from 'node:path'
import { getDataDir, ensureStorageReady } from './dataPaths.mjs'

const USERS_BACKUP_RE = /^users-\d{4}-\d{2}-\d{2}T[\d\-Z]+\.json$/

function usersFile() {
  return path.join(getDataDir(), 'users.json')
}

function parseUsersPayload(raw) {
  try {
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.users)) return null
    return data.users.filter((u) => u?.id && u?.email)
  } catch {
    return null
  }
}

async function readUsersFromPath(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return parseUsersPayload(raw)
  } catch {
    return null
  }
}

/** Tenta recuperar usuários de .bak ou backups/ (maior lista encontrada). */
export async function recoverUsersFromBackups() {
  await ensureStorageReady()
  const file = usersFile()
  const dir = path.dirname(file)
  const backupsDir = path.join(dir, 'backups')

  const candidates = []
  const bak = await readUsersFromPath(`${file}.bak`)
  if (bak?.length) candidates.push(bak)

  try {
    const names = (await fs.readdir(backupsDir))
      .filter((n) => USERS_BACKUP_RE.test(n))
      .sort()
      .reverse()
    for (const name of names.slice(0, 12)) {
      const list = await readUsersFromPath(path.join(backupsDir, name))
      if (list?.length) candidates.push(list)
    }
  } catch {
    /* sem pasta */
  }

  if (candidates.length === 0) return []

  candidates.sort((a, b) => b.length - a.length)
  return candidates[0]
}

function mergeUserRecords(prev, incoming) {
  if (!prev) return incoming
  if (!incoming) return prev
  const tPrev = Date.parse(prev.createdAt || '') || 0
  const tIn = Date.parse(incoming.createdAt || '') || 0
  const newer = tIn >= tPrev ? incoming : prev
  const older = tIn >= tPrev ? prev : incoming
  const merged = { ...older, ...newer }
  const pwd =
    String(newer.password || '').trim() ||
    String(prev.password || '').trim() ||
    String(incoming.password || '').trim()
  if (pwd) merged.password = pwd
  return merged
}

export function mergeUsersById(a, b) {
  const byId = new Map()
  for (const u of a ?? []) {
    if (u?.id) byId.set(u.id, u)
  }
  for (const u of b ?? []) {
    if (!u?.id) continue
    byId.set(u.id, mergeUserRecords(byId.get(u.id), u))
  }
  return Array.from(byId.values())
}

/** Só adiciona usuários ausentes — nunca sobrescreve cadastro já no disco. */
export function mergeUsersAddingMissingOnly(current, incoming) {
  const list = [...(current ?? [])]
  for (const u of incoming ?? []) {
    if (!u?.id && !u?.email) continue
    const em = String(u.email || '').trim().toLowerCase()
    const exists = list.some(
      (x) =>
        x.id === u.id ||
        (em && String(x.email || '').trim().toLowerCase() === em),
    )
    if (!exists) list.push(u)
  }
  return list
}

export async function listUsersBackupSummaries() {
  await ensureStorageReady()
  const file = usersFile()
  const dir = path.dirname(file)
  const backupsDir = path.join(dir, 'backups')
  const current = await readUsersFromPath(file)
  const currentIds = new Set((current ?? []).map((u) => u.id))
  const entries = [{ file: 'users.json.bak', label: 'Cópia .bak (último save)' }]

  try {
    const names = (await fs.readdir(backupsDir))
      .filter((n) => USERS_BACKUP_RE.test(n))
      .sort()
      .reverse()
    for (const n of names.slice(0, 24)) entries.push({ file: n, label: n })
  } catch {
    /* ignore */
  }

  const summaries = []
  for (const { file: backupFile, label } of entries) {
    const full =
      backupFile === 'users.json.bak' ? `${file}.bak` : path.join(backupsDir, backupFile)
    const users = await readUsersFromPath(full)
    if (!users?.length) continue
    const missing = users.filter((u) => u?.id && !currentIds.has(u.id))
    summaries.push({
      file: backupFile,
      label,
      total: users.length,
      missingCount: missing.length,
      preview: missing.slice(0, 5).map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
      })),
    })
  }
  return { currentCount: current?.length ?? 0, backups: summaries }
}

export async function restoreMissingUsersFromBackup(backupFile) {
  await ensureStorageReady()
  const file = usersFile()
  const dir = path.dirname(file)
  const full =
    backupFile === 'users.json.bak'
      ? `${file}.bak`
      : path.join(dir, 'backups', backupFile)

  const fromBackup = await readUsersFromPath(full)
  if (!fromBackup?.length) throw new Error('Backup de usuários vazio ou inválido')

  const current = (await readUsersFromPath(file)) ?? []
  const merged = mergeUsersById(current, fromBackup)
  const added = merged.length - current.length
  if (added <= 0) {
    return { added: 0, total: merged.length, message: 'Nenhum usuário ausente neste backup.' }
  }

  const { mutateUsersStore } = await import('./usersPersist.mjs')
  await mutateUsersStore((current) => mergeUsersById(current, fromBackup))

  return {
    added,
    total: merged.length,
    message: `Restaurou ${added} usuário(s) do backup (${backupFile}).`,
  }
}
