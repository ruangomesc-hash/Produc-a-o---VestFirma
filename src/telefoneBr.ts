/** DDD (2) + celular (9) — máximo 11 dígitos. */
export const TELEFONE_BR_DIGITOS = 11

export function digitsTelefoneBr(value: string): string {
  let d = value.replace(/\D/g, '')
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2)
  return d.slice(0, TELEFONE_BR_DIGITOS)
}

/** Máscara (XX) XXXXX-XXXX enquanto digita; não aceita mais que 11 dígitos. */
export function formatTelefoneBr(value: string): string {
  const d = digitsTelefoneBr(value)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function telefoneBrCompleto(value: string): boolean {
  return digitsTelefoneBr(value).length === TELEFONE_BR_DIGITOS
}
