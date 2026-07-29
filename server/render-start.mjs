#!/usr/bin/env node
/**
 * Start na Render: garante pasta de dados antes do servidor.
 */
import { initStoragePaths } from './dataPaths.mjs'

const RENDER_DATA = '/opt/render/project/src/data'
if (process.env.RENDER === 'true') {
  process.env.BOARD_DATA_DIR = RENDER_DATA
  process.env.BOARD_DATA_FILE = `${RENDER_DATA}/board.json`
  process.env.BOARD_LOGO_DIR = `${RENDER_DATA}/logos`
}

await initStoragePaths()
await import('./server.mjs')
