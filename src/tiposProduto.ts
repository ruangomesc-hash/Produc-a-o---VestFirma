export const TIPOS_PRODUTO = [
  { id: 'camisa-algodao-100', label: 'Camisa algodão 100%' },
  { id: 'camisa-polo', label: 'Camisa polo' },
  { id: 'corta-vento', label: 'Corta-vento' },
  { id: 'baby-look', label: 'Baby look' },
  { id: 'camisa-manga-longa', label: 'Camisa manga longa' },
  { id: 'camisa-dry-fit', label: 'Camisa dry fit' },
  { id: 'camisa-oversize', label: 'Camisa oversize' },
  { id: 'camisa-plus-size-algodao', label: 'Camisa plus size algodão' },
] as const

export type TipoProdutoId = (typeof TIPOS_PRODUTO)[number]['id']

const LABELS = new Map(TIPOS_PRODUTO.map((t) => [t.id, t.label]))

export function rotuloTipoProduto(id: string | null | undefined): string | null {
  if (!id?.trim()) return null
  return LABELS.get(id as TipoProdutoId) ?? id
}

export function tipoProdutoValido(id: string | null | undefined): id is TipoProdutoId {
  if (!id) return false
  return LABELS.has(id as TipoProdutoId)
}
