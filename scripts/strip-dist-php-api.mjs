#!/usr/bin/env node
/** Remove PHP da pasta dist/api — na Vercel eles viram arquivos estáticos e quebram login. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'api')
if (!fs.existsSync(dir)) process.exit(0)
for (const name of fs.readdirSync(dir)) {
  if (name.endsWith('.php')) fs.unlinkSync(path.join(dir, name))
}
try {
  fs.rmSync(path.join(dir, 'lib'), { recursive: true, force: true })
} catch {
  /* ignore */
}
