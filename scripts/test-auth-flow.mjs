#!/usr/bin/env node
/** Testa login → session → board (mesmo fluxo do app). Uso: node scripts/test-auth-flow.mjs [baseUrl] */
const base = (process.argv[2] || 'http://127.0.0.1:4199').replace(/\/$/, '')
const email = process.env.TEST_LOGIN_EMAIL || 'ruan.gomesc@gmail.com'
const password = process.env.TEST_LOGIN_PASSWORD || ''

if (!password) {
  console.error('Defina TEST_LOGIN_PASSWORD no ambiente.')
  process.exit(1)
}

async function main() {
  const loginRes = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: email, password }),
  })
  const loginJson = await loginRes.json().catch(() => ({}))
  if (!loginRes.ok || !loginJson.token) {
    console.error('LOGIN FAIL', loginRes.status, loginJson.error || loginJson)
    process.exit(1)
  }
  const token = loginJson.token
  const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' }

  const sessionRes = await fetch(`${base}/api/session`, { headers: auth })
  const sessionJson = await sessionRes.json().catch(() => ({}))
  if (!sessionRes.ok || !sessionJson.ok) {
    console.error('SESSION FAIL', sessionRes.status, sessionJson)
    process.exit(1)
  }

  const boardRes = await fetch(`${base}/api/board`, { headers: auth })
  if (!boardRes.ok) {
    const text = await boardRes.text().catch(() => '')
    console.error('BOARD FAIL', boardRes.status, text.slice(0, 200))
    process.exit(1)
  }

  console.log(
    JSON.stringify({
      ok: true,
      base,
      login: loginRes.status,
      session: sessionRes.status,
      board: boardRes.status,
      user: sessionJson.user,
      role: sessionJson.role,
      tokenLength: token.length,
    }),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
