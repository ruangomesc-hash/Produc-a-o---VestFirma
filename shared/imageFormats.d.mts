export const MAX_IMAGE_BYTES: number
export const IMAGE_MIME: Record<'png' | 'jpg' | 'webp' | 'gif', string>
export function detectImageType(bytes: Uint8Array): { ext: keyof typeof IMAGE_MIME; mime: string } | null
