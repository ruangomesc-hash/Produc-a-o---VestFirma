export type ApiErrorPayload = {
  ok?: boolean
  code?: string
  error?: string
  message?: string
  fix?: string
  detail?: string
}

export type LoginFailure = {
  error: string
  code?: string
  fix?: string
  detail?: string
  httpStatus?: number
  requestUrl?: string
}

const CODE_LABELS: Record<string, string> = {
  AUTH_INVALID: 'Credenciais recusadas',
  USER_NOT_REGISTERED: 'E-mail não cadastrado no servidor',
  AUTH_MISSING_FIELDS: 'Campos obrigatórios',
  API_NOT_FOUND: 'API não encontrada',
  API_NOT_JSON: 'Resposta inválida da API',
  API_PHP_STATIC: 'Arquivo PHP estático (Vercel)',
  SERVER_ERROR: 'Erro no servidor',
  NETWORK: 'Sem conexão',
  NO_TOKEN: 'Sessão não criada',
  CONFIG: 'Configuração',
  METHOD_NOT_ALLOWED: 'Método HTTP inválido',
  ROUTE_NOT_FOUND: 'Rota inexistente',
}

export function loginFailureTitle(code?: string, fallback?: string): string {
  if (code && CODE_LABELS[code]) return CODE_LABELS[code]
  return fallback || 'Não foi possível entrar'
}

export function formatLoginFailure(input: LoginFailure): string {
  const lines: string[] = [input.error]
  if (input.fix) lines.push(`Como corrigir: ${input.fix}`)
  if (input.detail) lines.push(`Detalhe: ${input.detail}`)
  if (input.httpStatus) lines.push(`HTTP ${input.httpStatus}`)
  if (input.requestUrl) lines.push(`URL: ${input.requestUrl}`)
  if (input.code) lines.push(`Código: ${input.code}`)
  return lines.join('\n')
}

export function parseLoginHttpFailure(
  res: Response,
  requestUrl: string,
  rawBody: string,
  json: ApiErrorPayload,
): LoginFailure {
  const trimmed = rawBody.trim()
  const contentType = res.headers.get('content-type') || ''

  if (trimmed.startsWith('<?php') || contentType.includes('httpd-php')) {
    return {
      code: 'API_PHP_STATIC',
      error:
        'A URL de login está servindo arquivo PHP em vez da API Node (comum na Vercel).',
      fix:
        'Redeploy com npm run build:publicar (remove PHP de dist/api), Root Directory = raiz do repo.',
      detail: trimmed.slice(0, 120),
      httpStatus: res.status,
      requestUrl,
    }
  }

  if (trimmed.startsWith('<!') || trimmed.toLowerCase().includes('<html')) {
    return {
      code: 'API_NOT_JSON',
      error: 'O servidor devolveu HTML em vez de JSON no login.',
      fix: 'Confira se a pasta api/ foi publicada na Vercel e vestfirma-config.json com apiBase "/api".',
      httpStatus: res.status,
      requestUrl,
    }
  }

  if (json.code || json.error || json.message) {
    const serverMsg = json.message && json.message !== json.error ? json.message : undefined
    return {
      code: json.code,
      error: json.error || json.message || `Erro ${res.status}`,
      fix: json.fix,
      detail: json.detail || serverMsg,
      httpStatus: res.status,
      requestUrl,
    }
  }

  if (res.status === 404) {
    return {
      code: 'API_NOT_FOUND',
      error: 'Rota de login não existe neste deploy (404).',
      fix: 'Vercel: Root Directory na raiz (não dist), pasta api/[...slug].js no Git, redeploy.',
      httpStatus: 404,
      requestUrl,
    }
  }

  if (res.status === 401) {
    return {
      code: 'AUTH_INVALID',
      error: 'E-mail ou senha incorretos.',
      fix: 'Vercel: SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD → Redeploy.',
      httpStatus: 401,
      requestUrl,
    }
  }

  const onRender = requestUrl.includes('onrender.com')
  const onVercel =
    requestUrl.includes('vercel.app') || trimmed.includes('verifyAdmin')

  return {
    code: res.status >= 500 ? 'SERVER_ERROR' : 'API_NOT_JSON',
    error: trimmed.slice(0, 200) || `Erro HTTP ${res.status}`,
    fix:
      res.status >= 500
        ? onRender
          ? 'Render → serviço → Logs. Confira SEED_ADMIN_PASSWORD, disco /var/data, Start: npm run start:production.'
          : onVercel
            ? 'Vercel → Logs → Functions; redeploy com api/[...slug].js ou migre API para Render.'
            : 'Abra /api/health. Confira SEED_ADMIN_PASSWORD e se a API Node está no ar (não só o site estático).'
        : 'Abra /api/health no navegador para testar a API.',
    httpStatus: res.status,
    requestUrl,
  }
}
