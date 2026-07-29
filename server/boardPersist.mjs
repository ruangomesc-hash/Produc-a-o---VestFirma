import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_BACKUPS = 48

export async function readExistingBoard(DATA_FILE) {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return data
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') return null
    throw err
  }
}

/** Nunca remove pedidos já gravados — só adiciona ou atualiza por id. */
export function mergeBoardPreservingPedidos(existing, incoming) {
  if (!existing?.cards?.length) return incoming
  const byId = new Map()
  for (const c of existing.cards) {
    if (c?.id) byId.set(c.id, c)
  }
  for (const c of incoming.cards ?? []) {
    if (!c?.id) continue
    const prev = byId.get(c.id)
    byId.set(c.id, prev ? { ...prev, ...c } : c)
  }
  return {
    ...incoming,
    cards: Array.from(byId.values()),
  }
}

export async function backupBoardBeforeWrite(DATA_FILE) {
  const existing = await readExistingBoard(DATA_FILE)
  if (!existing?.cards?.length) return

  const dir = path.dirname(DATA_FILE)
  const backupsDir = path.join(dir, 'backups')
  await fs.mkdir(backupsDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const payload = JSON.stringify(existing)
  await fs.writeFile(path.join(backupsDir, `board-${stamp}.json`), payload, 'utf8')
  await fs.writeFile(`${DATA_FILE}.bak`, payload, 'utf8')

  try {
    const names = (await fs.readdir(backupsDir))
      .filter((n) => n.startsWith('board-') && n.endsWith('.json'))
      .sort()
    while (names.length > MAX_BACKUPS) {
      const old = names.shift()
      if (old) await fs.unlink(path.join(backupsDir, old))
    }
  } catch {
    /* ignore rotation errors */
  }
}

export function countBoardCards(board) {
  return Array.isArray(board?.cards) ? board.cards.length : 0
}
