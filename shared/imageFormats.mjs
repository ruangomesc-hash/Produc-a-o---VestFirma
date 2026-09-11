export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
export const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }

export function detectImageType(bytes) {
  const starts = (...signature) => signature.every((byte, i) => bytes[i] === byte)
  const text = (start, end) => String.fromCharCode(...bytes.subarray(start, end))
  let ext = null
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) ext = 'png'
  else if (starts(255, 216, 255)) ext = 'jpg'
  else if (['GIF87a', 'GIF89a'].includes(text(0, 6))) ext = 'gif'
  else if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') ext = 'webp'
  return ext ? { ext, mime: IMAGE_MIME[ext] } : null
}
