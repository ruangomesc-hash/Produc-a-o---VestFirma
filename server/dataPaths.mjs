import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.join(__dirname, '..')

/** Pasta gravável escolhida na subida do servidor (nunca confiar só no env). */
let dataDir = null
let boardFile = null
let logoDir = null
let storageNote = ''
let initDone = false

const RENDER_APP_DATA = '/opt/render/project/src/data'

async function pathExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function canWriteDirectory(dir) {
  try {
    await fs.mkdir(dir, { recursive: true })
    const probe = path.join(dir, `.vestfirma-probe-${process.pid}`)
    await fs.writeFile(probe, 'ok', 'utf8')
    await fs.unlink(probe)
    return true
  } catch {
    return false
  }
}

function uniquePaths(list) {
  const seen = new Set()
  const out = []
  for (const p of list) {
    if (!p || typeof p !== 'string' || !p.trim()) continue
    const norm = path.resolve(p.trim())
    if (seen.has(norm)) continue
    seen.add(norm)
    out.push(norm)
  }
  return out
}

function defaultLocalDataDir() {
  return path.join(ROOT, 'data')
}

async function readUsersCount(dir) {
  try {
    const raw = await fs.readFile(path.join(dir, 'users.json'), 'utf8')
    if (!raw.trim()) return 0
    const data = JSON.parse(raw)
    return Array.isArray(data.users) ? data.users.length : 0
  } catch {
    return 0
  }
}

async function readBoardCardsCount(dir) {
  try {
    const raw = await fs.readFile(path.join(dir, 'board.json'), 'utf8')
    if (!raw.trim()) return 0
    const data = JSON.parse(raw)
    return Array.isArray(data.cards) ? data.cards.length : 0
  } catch {
    return 0
  }
}

/** Quanto dado real existe nesta pasta — evita escolher disco efêmero vazio. */
async function scoreDataDir(dir, envDirResolved) {
  if (!(await canWriteDirectory(dir))) return -1
  const users = await readUsersCount(dir)
  const cards = await readBoardCardsCount(dir)
  let score = users * 1000 + cards * 10
  if (dir === RENDER_APP_DATA || dir.includes('render/project/src/data')) score += 50
  if (dir === '/var/data') score += 40
  if (envDirResolved && dir === envDirResolved) score += 300
  return score
}

async function copyIfMissing(from, to) {
  if (!(await pathExists(from))) return false
  if (await pathExists(to)) return false
  await fs.mkdir(path.dirname(to), { recursive: true })
  await fs.copyFile(from, to)
  return true
}

/** Copia users/board/backups de pastas secundárias para a pasta escolhida. */
async function migrateDataIntoChosen(chosen, others) {
  let migrated = 0
  const files = ['users.json', 'board.json']
  for (const other of others) {
    if (other === chosen) continue
    for (const name of files) {
      const from = path.join(other, name)
      const to = path.join(chosen, name)
      const fromUsers = name === 'users.json' ? await readUsersCount(other) : 0
      const toUsers = name === 'users.json' ? await readUsersCount(chosen) : 0
      const fromCards = name === 'board.json' ? await readBoardCardsCount(other) : 0
      const toCards = name === 'board.json' ? await readBoardCardsCount(chosen) : 0
      const fromBetter =
        name === 'users.json' ? fromUsers > toUsers : fromCards > toCards
      if (fromBetter && (await pathExists(from))) {
        await fs.mkdir(path.dirname(to), { recursive: true })
        if (await pathExists(to)) {
          await fs.copyFile(to, `${to}.pre-migrate.bak`)
        }
        await fs.copyFile(from, to)
        migrated++
        console.warn(`[vestfirma] Migrou ${name} de ${other} → ${chosen}`)
      } else {
        await copyIfMissing(from, to)
      }
      await copyIfMissing(`${from}.bak`, `${to}.bak`)
    }
    const fromBackups = path.join(other, 'backups')
    const toBackups = path.join(chosen, 'backups')
    if (await pathExists(fromBackups)) {
      await fs.mkdir(toBackups, { recursive: true })
      const names = await fs.readdir(fromBackups)
      for (const n of names) {
        const dest = path.join(toBackups, n)
        if (!(await pathExists(dest))) {
          await fs.copyFile(path.join(fromBackups, n), dest)
          migrated++
        }
      }
    }
  }
  if (migrated > 0) {
    console.warn(`[vestfirma] Migração concluída: ${migrated} arquivo(s) → ${chosen}`)
  }
}

/**
 * Escolhe onde gravar board/users/logos.
 * Prefere a pasta com MAIS dados (users.json / board.json), não só a primeira gravável.
 */
export async function initStoragePaths() {
  if (initDone && dataDir) return getBoardPaths()

  const envDir = process.env.BOARD_DATA_DIR?.trim()
  const envBoard = process.env.BOARD_DATA_FILE?.trim()
  const envLogos = process.env.BOARD_LOGO_DIR?.trim()
  const fromEnvFile = envBoard ? path.dirname(path.resolve(envBoard)) : null

  const candidates = uniquePaths([
    RENDER_APP_DATA,
    envDir,
    fromEnvFile,
    '/var/data',
    defaultLocalDataDir(),
  ])

  const envDirResolved = envDir ? path.resolve(envDir) : null

  if (process.env.VESTFIRMA_TEST_ISOLATE_DATA === '1' && envDirResolved) {
    if (!(await canWriteDirectory(envDirResolved))) {
      throw new Error(`Pasta de teste não gravável: ${envDirResolved}`)
    }
    dataDir = envDirResolved
    boardFile =
      envBoard && path.dirname(path.resolve(envBoard)) === envDirResolved
        ? path.resolve(envBoard)
        : path.join(envDirResolved, 'board.json')
    logoDir = path.join(envDirResolved, 'logos')
    process.env.BOARD_DATA_DIR = dataDir
    process.env.BOARD_DATA_FILE = boardFile
    process.env.BOARD_LOGO_DIR = logoDir
    storageNote = `Teste isolado em ${dataDir}`
    await fs.mkdir(logoDir, { recursive: true })
    initDone = true
    return getBoardPaths()
  }

  const scored = []
  for (const dir of candidates) {
    const score = await scoreDataDir(dir, envDirResolved)
    if (score >= 0) scored.push({ dir, score })
  }

  if (scored.length === 0) {
    throw new Error('Nenhuma pasta gravável para dados do VestFirma.')
  }

  scored.sort((a, b) => b.score - a.score)
  const chosen = scored[0].dir
  const others = scored.slice(1).map((s) => s.dir)

  await migrateDataIntoChosen(chosen, others)

  dataDir = chosen
  boardFile =
    envBoard && path.dirname(path.resolve(envBoard)) === chosen
      ? path.resolve(envBoard)
      : path.join(chosen, 'board.json')
  logoDir =
    envLogos && path.resolve(envLogos).startsWith(chosen)
      ? path.resolve(envLogos)
      : path.join(chosen, 'logos')

  process.env.BOARD_DATA_DIR = dataDir
  process.env.BOARD_DATA_FILE = boardFile
  process.env.BOARD_LOGO_DIR = logoDir

  const usersNow = await readUsersCount(chosen)
  const onRenderMount =
    chosen === RENDER_APP_DATA || chosen.includes('render/project/src/data')
  if (onRenderMount) {
    storageNote = 'Disco persistente Render (/opt/render/project/src/data).'
  } else if (process.env.RENDER === 'true') {
    storageNote = `ATENÇÃO Render: dados em ${chosen} — monte disco em /opt/render/project/src/data.`
    console.warn('[vestfirma]', storageNote)
  } else if (chosen === '/var/data') {
    storageNote = 'Dados em /var/data (disco persistente).'
  } else {
    storageNote = `Dados em ${chosen}`
  }

  await fs.mkdir(logoDir, { recursive: true })
  initDone = true

  console.log('[vestfirma] BOARD_DATA_DIR =', dataDir)
  console.log('[vestfirma] BOARD_DATA_FILE =', boardFile)
  console.log('[vestfirma] BOARD_LOGO_DIR =', logoDir)
  console.log('[vestfirma] users.json nesta pasta:', usersNow, 'usuário(s)')

  return getBoardPaths()
}

export function getDataDir() {
  if (dataDir) return dataDir
  return defaultLocalDataDir()
}

export function getBoardPaths() {
  const dir = getDataDir()
  return {
    dataDir: dir,
    boardFile: boardFile || path.join(dir, 'board.json'),
    logoDir: logoDir || path.join(dir, 'logos'),
    storageNote,
    storageReady: initDone,
  }
}

export async function ensureStorageReady() {
  if (!initDone) await initStoragePaths()
  return getBoardPaths()
}

/** Só testes — permite trocar BOARD_DATA_DIR entre casos. */
export function __resetStoragePathsForTests() {
  dataDir = null
  boardFile = null
  logoDir = null
  initDone = false
}
