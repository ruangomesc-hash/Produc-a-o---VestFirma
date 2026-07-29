export type ApiErrorPayload = {
  ok?: boolean
  code?: string
  error?: string
  message?: string
  fix?: string
  detail?: string
}

export function formatApiErrorMessage(
  res: Response,
  json: ApiErrorPayload,
  fallback: string,
): string {
  const main = json.error || json.message || fallback
  const lines = [main]
  if (json.fix) lines.push(`Como corrigir: ${json.fix}`)
  if (json.detail && json.detail !== main) lines.push(`Detalhe: ${json.detail}`)
  if (json.code) lines.push(`Código: ${json.code} · HTTP ${res.status}`)
  else if (!res.ok) lines.push(`HTTP ${res.status}`)
  return lines.join('\n')
}

export async function readApiJson(res: Response): Promise<{ raw: string; json: ApiErrorPayload }> {
  const raw = await res.text()
  let json: ApiErrorPayload = {}
  if (raw.trim()) {
    try {
      json = JSON.parse(raw) as ApiErrorPayload
    } catch {
      json = {}
    }
  }
  return { raw, json }
}
