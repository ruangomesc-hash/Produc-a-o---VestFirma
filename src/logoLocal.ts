export type LogoLocal = 'frente' | 'costas' | 'frente-costas'

export const LOGO_LOCAL_OPCOES: { value: LogoLocal; label: string }[] = [
  { value: 'frente', label: 'Frente' },
  { value: 'costas', label: 'Costas' },
  { value: 'frente-costas', label: 'Frente e costas' },
]

export function rotuloLocalLogo(local: LogoLocal | null | undefined): string | null {
  if (!local) return null
  return LOGO_LOCAL_OPCOES.find((o) => o.value === local)?.label ?? null
}

export function normalizarLogoLocal(value: unknown): LogoLocal | null {
  if (value === 'frente' || value === 'costas' || value === 'frente-costas') return value
  return null
}
