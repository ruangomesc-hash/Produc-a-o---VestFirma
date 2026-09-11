import { authHeaders, requestAuthFailureLogout } from './authSession'
import { getApiBase, getRuntimeConfig } from './runtimeConfig'
import { readOriginalImage, validateImageFile } from './logoUtils'

export async function uploadOriginalImage(file: File, signal?: AbortSignal): Promise<string> {
  const mime = await validateImageFile(file)
  const base = getApiBase()
  // Mantém o modo local e os servidores legados, sem converter o original.
  if (!base || !getRuntimeConfig().originalImageUploads) return readOriginalImage(file)
  const res = await fetch(`${base}/images`, {
    method: 'POST', signal,
    headers: { ...authHeaders(), 'Content-Type': mime },
    body: file,
  })
  if (res.status === 401) requestAuthFailureLogout('image-upload')
  const data = await res.json().catch(() => ({})) as { url?: string; error?: string }
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'Não foi possível enviar a imagem. Tente novamente antes de salvar.')
  }
  const uploadedUrl = new URL(data.url, new URL(base, window.location.href))
  return uploadedUrl.origin === window.location.origin
    ? `${uploadedUrl.pathname}${uploadedUrl.search}`
    : uploadedUrl.href
}
