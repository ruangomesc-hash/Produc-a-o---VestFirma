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

/**
 * Escolhe onde gravar board/users/logos.
 * Ignora BOARD_DATA_* do painel se a pasta não for gravável (evita EACCES em /var/data).
 */
export async function initStoragePaths() {
  if (initDone && dataDir) return getBoardPaths()

  const envDir = process.env.BOARD_DATA_DIR?.trim()
  const envBoard = process.env.BOARD_DATA_FILE?.trim()
  const envLogos = process.env.BOARD_LOGO_DIR?.trim()
  const fromEnvFile = envBoard ? path.dirname(path.resolve(envBoard)) : null

  const candidates = uniquePaths([
    process.env.RENDER === 'true' ? RENDER_APP_DATA : null,
    envDir,
    fromEnvFile,
    '/var/data',
    defaultLocalDataDir(),
    RENDER_APP_DATA,
  ])

  let chosen = null
  for (const dir of candidates) {
    if (await canWriteDirectory(dir)) {
      chosen = dir
      break
    }
  }

  if (!chosen) {
    throw new Error('Nenhuma pasta gravável para dados do VestFirma.')
  }

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

  const wanted = envDir || fromEnvFile
  const wantedResolved = wanted ? path.resolve(wanted) : null
  if (wantedResolved && wantedResolved !== chosen) {
    storageNote = `Pasta ${wanted} sem permissão; usando ${chosen}.`
    console.warn('[vestfirma]', storageNote)
  } else if (chosen === RENDER_APP_DATA || chosen.includes('render/project/src/data')) {
    storageNote = 'Disco/pasta persistente na Render ativa.'
  } else if (process.env.RENDER === 'true') {
    storageNote = 'Dados graváveis OK (confira disco persistente no painel Render).'
  } else {
    storageNote = `Dados em ${chosen}`
  }

  await fs.mkdir(logoDir, { recursive: true })
  initDone = true

  console.log('[vestfirma] BOARD_DATA_DIR =', dataDir)
  console.log('[vestfirma] BOARD_DATA_FILE =', boardFile)
  console.log('[vestfirma] BOARD_LOGO_DIR =', logoDir)

  return getBoardPaths()
}

/** Sempre usa pasta já validada — nunca /var/data só porque está no env. */
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
