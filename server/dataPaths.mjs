import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.join(__dirname, '..')

/** Pasta gravável escolhida na subida do servidor. */
let dataDir = null
let boardFile = null
let logoDir = null
let storageNote = ''

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

/**
 * Escolhe onde gravar board/users/logos.
 * /var/data só funciona com disco persistente montado na Render.
 */
export async function initStoragePaths() {
  if (dataDir) return getBoardPaths()

  const envDir = process.env.BOARD_DATA_DIR?.trim()
  const envBoard = process.env.BOARD_DATA_FILE?.trim()
  const envLogos = process.env.BOARD_LOGO_DIR?.trim()

  const fromEnvFile = envBoard ? path.dirname(path.resolve(envBoard)) : null

  const candidates = uniquePaths([
    envDir,
    fromEnvFile,
    '/var/data',
    path.join(ROOT, 'data'),
    '/opt/render/project/src/data',
  ])

  let chosen = null
  for (const dir of candidates) {
    if (await canWriteDirectory(dir)) {
      chosen = dir
      break
    }
  }

  if (!chosen) {
    throw new Error(
      'Nenhuma pasta gravável para dados. Na Render: anexe disco em /var/data ou remova BOARD_DATA_DIR=/var/data até montar o disco.',
    )
  }

  dataDir = chosen
  boardFile = envBoard && path.dirname(path.resolve(envBoard)) === chosen
    ? path.resolve(envBoard)
    : path.join(chosen, 'board.json')
  logoDir = envLogos && path.resolve(envLogos).startsWith(chosen)
    ? path.resolve(envLogos)
    : path.join(chosen, 'logos')

  process.env.BOARD_DATA_DIR = dataDir
  process.env.BOARD_DATA_FILE = boardFile
  process.env.BOARD_LOGO_DIR = logoDir

  const wantedVar = envDir || fromEnvFile
  if (wantedVar && path.resolve(wantedVar) !== chosen) {
    storageNote = `Aviso: ${wantedVar} sem permissão — usando ${chosen}. Anexe disco Render em /var/data e redeploy.`
    console.warn('[vestfirma]', storageNote)
  } else if (chosen === '/var/data' || chosen.includes('/var/data')) {
    storageNote = 'Disco persistente /var/data ativo.'
  } else if (process.env.RENDER === 'true') {
    storageNote =
      'Dados na pasta do app (ephemeral). Anexe disco Render montado em /var/data para não perder pedidos no redeploy.'
    console.warn('[vestfirma]', storageNote)
  } else {
    storageNote = `Dados em ${chosen}`
  }

  await fs.mkdir(logoDir, { recursive: true })

  console.log('[vestfirma] BOARD_DATA_DIR =', dataDir)
  console.log('[vestfirma] BOARD_DATA_FILE =', boardFile)
  console.log('[vestfirma] BOARD_LOGO_DIR =', logoDir)

  return getBoardPaths()
}

export function getDataDir() {
  if (!dataDir) {
    return process.env.BOARD_DATA_DIR || path.join(ROOT, 'data')
  }
  return dataDir
}

export function getBoardPaths() {
  return {
    dataDir: dataDir || getDataDir(),
    boardFile: boardFile || process.env.BOARD_DATA_FILE || path.join(getDataDir(), 'board.json'),
    logoDir: logoDir || process.env.BOARD_LOGO_DIR || path.join(getDataDir(), 'logos'),
    storageNote,
  }
}
