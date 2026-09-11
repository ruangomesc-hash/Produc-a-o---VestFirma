import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { IMAGE_MIME, MAX_IMAGE_BYTES, detectImageType } from '../shared/imageFormats.mjs'

export async function storeOriginalImage(bytes, logoDir) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error('A imagem deve ter entre 1 byte e 25 MB.'), { status: 413 })
  }
  const type = detectImageType(bytes)
  if (!type) throw Object.assign(new Error('Escolha uma imagem PNG, JPG, WEBP ou GIF.'), { status: 415 })
  const hash = crypto.createHash('sha256').update(bytes).digest('hex')
  const filename = `${hash}.${type.ext}`
  const dir = path.join(logoDir, 'originals')
  await fs.mkdir(dir, { recursive: true })
  const tmp = path.join(dir, `.${filename}-${crypto.randomUUID()}.tmp`)
  try {
    await fs.writeFile(tmp, bytes)
    await fs.rename(tmp, path.join(dir, filename))
  } finally {
    await fs.rm(tmp, { force: true })
  }
  return { url: `/api/images/${filename}`, size: bytes.length, mime: type.mime }
}

export async function handleImageApi(req, res, url, { logoDir, requireSession, corsHeaders, requireLogin }) {
  const sendError = (status, error) => {
    res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error }))
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }
  if (url.pathname === '/api/images' && req.method === 'POST') {
    if (requireLogin && !(await requireSession(req, res))) return
    if (Number(req.headers['content-length'] || 0) > MAX_IMAGE_BYTES) {
      sendError(413, 'A imagem deve ter no máximo 25 MB.')
      return
    }
    try {
      const chunks = []
      let size = 0
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        size += chunk.length
        if (size > MAX_IMAGE_BYTES) {
          req.resume()
          sendError(413, 'A imagem deve ter no máximo 25 MB.')
          return
        }
        chunks.push(chunk)
      }
      const result = await storeOriginalImage(Buffer.concat(chunks), logoDir)
      res.writeHead(201, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(result))
    } catch (err) {
      if (!err.status) throw err
      sendError(err.status, err.message)
    }
    return
  }
  const match = url.pathname.match(/^\/api\/images\/([a-f0-9]{64})\.(png|jpg|webp|gif)$/)
  if (!match) return sendError(404, 'Imagem não encontrada.')
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendError(405, 'Método não permitido.')
  const filename = `${match[1]}.${match[2]}`
  let bytes
  try {
    bytes = await fs.readFile(path.join(logoDir, 'originals', filename))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    return sendError(404, 'Imagem não encontrada.')
  }
  res.writeHead(200, {
    ...corsHeaders(),
    'Content-Type': IMAGE_MIME[match[2]],
    'Content-Length': bytes.length,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=31536000, immutable',
    'Content-Disposition': `${url.searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename="vestfirma-${filename}"`,
  })
  res.end(req.method === 'HEAD' ? undefined : bytes)
}
