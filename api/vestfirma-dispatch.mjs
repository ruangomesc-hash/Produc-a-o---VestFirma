import {
  corsHeaders,
  handleLoginApi,
  handleLogoutApi,
  handleSessionApi,
  readJsonBody,
  requireSession,
} from '../server/auth.mjs'
import { handleBoardApi, handleHealthApi } from '../server/vercelRoutes.mjs'
import { handleUsersApi } from '../server/users.mjs'

const MAX_BODY = 80 * 1024 * 1024

async function readBody(req) {
  return readJsonBody(req, MAX_BODY)
}

/** @param {import('http').IncomingMessage} req */
function routeName(req) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  let path = url.pathname.replace(/^\/api\//, '').replace(/\.php$/i, '')
  if (path === 'board' || path === 'board.php') return 'board'
  return path
}

/**
 * Handler único para Vercel Serverless (`api/vestfirma.js`).
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function dispatchVestfirmaApi(req, res) {
  try {
    const name = routeName(req)

    if (name === 'login') {
      await handleLoginApi(req, res, readBody)
      return
    }
    if (name === 'session') {
      await handleSessionApi(req, res)
      return
    }
    if (name === 'logout') {
      await handleLogoutApi(req, res)
      return
    }
    if (name === 'board') {
      await handleBoardApi(req, res, readBody)
      return
    }
    if (name === 'health') {
      await handleHealthApi(req, res)
      return
    }
    if (name === 'users') {
      await handleUsersApi(req, res, readBody, requireSession, corsHeaders)
      return
    }

    res.writeHead(404, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Rota API não encontrada', path: name }))
  } catch (err) {
    console.error(err)
    if (!res.headersSent) {
      res.writeHead(500, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: 'Erro no servidor' }))
    }
  }
}
