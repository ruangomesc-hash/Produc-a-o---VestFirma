import { authHeaders, requestAuthFailureLogout } from './authSession'
import { getApiBase } from './runtimeConfig'
import { readOriginalImage, validateImageFile } from './logoUtils'

export async function uploadOriginalImage(file: File, signal?: AbortSignal): Promise<string> {
  const mime = await validateImageFile(file)
  const base = getApiBase()
  if (base) {
    const res = await fetch(`${base}/images`, {
      method: 'POST', signal,
      headers: { ...authHeaders(), 'Content-Type': mime },
      body: file,
    })
    if (res.status === 401) requestAuthFailureLogout('image-upload')
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
    if (res.ok && data.url) {
      const uploadedUrl = new URL(data.url, new URL(base, window.location.href))
      return uploadedUrl.origin === window.location.origin
        ? `${uploadedUrl.pathname}${uploadedUrl.search}`
        : uploadedUrl.href
    }
  }
  return readOriginalImage(file)
}
