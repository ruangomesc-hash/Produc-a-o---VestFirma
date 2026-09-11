import { MAX_IMAGE_BYTES, detectImageType } from '../shared/imageFormats.mjs'

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'
export const MAX_IMAGE_MB = MAX_IMAGE_BYTES / 1024 / 1024

export async function validateImageFile(file: File): Promise<string> {
  if (!file.size) throw new Error('O arquivo está vazio. Escolha outra imagem.')
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`A imagem deve ter no máximo ${MAX_IMAGE_MB} MB. O original não será reduzido.`)
  }
  const type = detectImageType(new Uint8Array(await file.slice(0, 12).arrayBuffer()))
  if (!type) throw new Error('Escolha uma imagem PNG, JPG, WEBP ou GIF.')
  return type.mime
}

/** Codifica os bytes originais, sem redimensionar ou converter a imagem. */
export async function readOriginalImage(file: File): Promise<string> {
  const mime = await validateImageFile(file)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += 32768) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + 32768)))
  }
  return `data:${mime};base64,${btoa(parts.join(''))}`
}
