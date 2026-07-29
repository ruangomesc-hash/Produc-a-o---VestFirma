import fs from 'node:fs/promises'
import path from 'node:path'
import { mergeBoardShell } from '../shared/boardVendedoresMerge.mjs'

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
function pedidoRevisionMs(card) {
  let max = 0
  for (const e of card?.historicoEtapa ?? []) {
    if (e?.at) {
      const t = Date.parse(e.at)
      if (!Number.isNaN(t)) max = Math.max(max, t)
    }
  }
  for (const iso of [card?.etapaDesde, card?.createdAt, card?.arquivadoEm]) {
    if (iso) {
      const t = Date.parse(iso)
      if (!Number.isNaN(t)) max = Math.max(max, t)
    }
  }
  return max
}

function mergeOrderCard(existing, incoming) {
  const tExist = pedidoRevisionMs(existing)
  const tIn = pedidoRevisionMs(incoming)
  if (tIn >= tExist) return { ...existing, ...incoming }
  return { ...incoming, ...existing }
}

export function mergeBoardPreservingPedidos(existing, incoming, removeCardIds = []) {
  const shell = mergeBoardShell(existing, incoming)
  const removeSet = new Set(Array.isArray(removeCardIds) ? removeCardIds.filter(Boolean) : [])
  if (!existing?.cards?.length) {
    const cards = (incoming.cards ?? []).filter((c) => !c?.id || !removeSet.has(c.id))
    return { ...incoming, ...shell, cards }
  }

  const byId = new Map()
  const legacy = []
  for (const c of existing.cards) {
    if (c?.id) {
      if (removeSet.has(c.id)) continue
      byId.set(c.id, c)
    } else legacy.push(c)
  }
  for (const c of incoming.cards ?? []) {
    if (!c?.id) continue
    if (removeSet.has(c.id)) {
      byId.delete(c.id)
      continue
    }
    const prev = byId.get(c.id)
    byId.set(c.id, prev ? mergeOrderCard(prev, c) : c)
  }

  return {
    ...incoming,
    ...shell,
    cards: [...legacy, ...Array.from(byId.values())],
  }
}

/** Só inclui pedidos que faltam em `primary` — ideal para restaurar backup. */
export function mergeBoardAddingMissingPedidosOnly(existing, incoming) {
  if (!incoming?.cards?.length) return existing
  const primary = existing ?? { cards: [], columns: incoming.columns, vendedores: [], segmentos: [] }
  const byId = new Map((primary.cards ?? []).map((c) => [c.id, c]))
  let added = 0
  for (const c of incoming.cards) {
    if (c?.id && !byId.has(c.id)) {
      byId.set(c.id, c)
      added++
    }
  }
  if (added === 0) return primary
  const shell = mergeBoardShell(primary, incoming)
  return { ...primary, ...shell, cards: [...byId.values()] }
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

/** Só administrador pode arquivar ou desarquivar no servidor. */
export function preserveArquivadoEmUnlessAdmin(existing, board, session) {
  if (!existing?.cards?.length || session?.role === 'admin') return board
  const prevById = new Map(
    existing.cards.filter((c) => c?.id).map((c) => [c.id, c.arquivadoEm ?? null]),
  )
  let changed = false
  const cards = (board.cards ?? []).map((c) => {
    if (!c?.id || !prevById.has(c.id)) return c
    const prevArq = prevById.get(c.id)
    const nextArq = c.arquivadoEm ?? null
    if (prevArq === nextArq) return c
    changed = true
    return { ...c, arquivadoEm: prevArq }
  })
  return changed ? { ...board, cards } : board
}

/** Se board.json estiver ausente ou ilegível, tenta .bak e backups/. Quadro vazio válido não ressuscita pedidos. */
export async function readBoardWithRecovery(DATA_FILE) {
  let data = null
  try {
    data = await readExistingBoard(DATA_FILE)
  } catch {
    data = null
  }
  if (data !== null) return data

  const bak = await readExistingBoard(`${DATA_FILE}.bak`)
  if (countBoardCards(bak) > 0) {
    const payload = JSON.stringify(bak)
    await fs.writeFile(DATA_FILE, payload, 'utf8')
    return bak
  }

  try {
    const dir = path.dirname(DATA_FILE)
    const backupsDir = path.join(dir, 'backups')
    const names = (await fs.readdir(backupsDir))
      .filter((n) => n.startsWith('board-') && n.endsWith('.json'))
      .sort()
    const latest = names.at(-1)
    if (latest) {
      const raw = await fs.readFile(path.join(backupsDir, latest), 'utf8')
      const recovered = JSON.parse(raw)
      if (countBoardCards(recovered) > 0) {
        const payload = JSON.stringify(recovered)
        await fs.writeFile(DATA_FILE, payload, 'utf8')
        await fs.writeFile(`${DATA_FILE}.bak`, payload, 'utf8')
        return recovered
      }
    }
  } catch {
    /* sem pasta de backups */
  }

  return data
}
