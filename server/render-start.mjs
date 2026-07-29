#!/usr/bin/env node
/**
 * Start na Render: garante pasta de dados antes do servidor.
 */
import { initStoragePaths } from './dataPaths.mjs'

await initStoragePaths()
await import('./server.mjs')
