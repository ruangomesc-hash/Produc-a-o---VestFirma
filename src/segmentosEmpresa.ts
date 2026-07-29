import type { SegmentoEmpresa } from './types'

/** Segmentos comuns no Brasil — sempre disponíveis no quadro. */
export const SEGMENTOS_PADRAO: SegmentoEmpresa[] = [
  { id: 'seg-restaurante', nome: 'Restaurante / Bar / Lanchonete' },
  { id: 'seg-supermercado', nome: 'Supermercado / Mercearia' },
  { id: 'seg-padaria', nome: 'Padaria / Confeitaria' },
  { id: 'seg-farmacia', nome: 'Farmácia / Drogaria' },
  { id: 'seg-saude', nome: 'Clínica / Hospital / Saúde' },
  { id: 'seg-academia', nome: 'Academia / Esporte / Fitness' },
  { id: 'seg-educacao', nome: 'Escola / Faculdade / Educação' },
  { id: 'seg-construcao', nome: 'Construção civil / Obras' },
  { id: 'seg-industria', nome: 'Indústria / Manufatura' },
  { id: 'seg-transporte', nome: 'Transporte / Logística' },
  { id: 'seg-hotel', nome: 'Hotel / Pousada / Hospedagem' },
  { id: 'seg-beleza', nome: 'Salão / Barbearia / Estética' },
  { id: 'seg-automotivo', nome: 'Oficina / Auto center' },
  { id: 'seg-agro', nome: 'Agro / Rural / Cooperativa' },
  { id: 'seg-religioso', nome: 'Igreja / Instituição religiosa' },
  { id: 'seg-ong', nome: 'ONG / Associação' },
  { id: 'seg-escritorio', nome: 'Escritório / Serviços administrativos' },
  { id: 'seg-tecnologia', nome: 'Tecnologia / Software / TI' },
  { id: 'seg-varejo', nome: 'Loja / Comércio varejista' },
  { id: 'seg-atacado', nome: 'Atacado / Distribuidora' },
  { id: 'seg-eventos', nome: 'Eventos / Festas' },
  { id: 'seg-seguranca', nome: 'Segurança / Vigilância' },
  { id: 'seg-limpeza', nome: 'Limpeza / Facilities' },
  { id: 'seg-imobiliaria', nome: 'Imobiliária / Corretagem' },
  { id: 'seg-contabilidade', nome: 'Contabilidade / Advocacia / Consultoria' },
  { id: 'seg-marketing', nome: 'Marketing / Publicidade / Agência' },
  { id: 'seg-pet', nome: 'Pet shop / Veterinária' },
  { id: 'seg-grafica', nome: 'Gráfica / Comunicação visual' },
  { id: 'seg-instalacoes', nome: 'Instalações / Elétrica / Solar' },
  { id: 'seg-metalurgica', nome: 'Metalúrgica / Serralheria / Marcenaria' },
]

export function mesclarSegmentos(custom: SegmentoEmpresa[] | undefined): SegmentoEmpresa[] {
  const porId = new Map<string, SegmentoEmpresa>()
  const porNome = new Set<string>()

  for (const s of SEGMENTOS_PADRAO) {
    porId.set(s.id, s)
    porNome.add(s.nome.toLowerCase())
  }

  for (const s of custom ?? []) {
    const nome = s.nome?.trim()
    if (!nome) continue
    const nomeKey = nome.toLowerCase()
    if (porNome.has(nomeKey)) continue
    let id = s.id?.trim()
    if (!id || porId.has(id)) id = crypto.randomUUID()
    porId.set(id, { id, nome })
    porNome.add(nomeKey)
  }

  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Usado ao importar pedidos antigos com texto livre de segmento. */
export function encontrarOuCriarSegmento(segmentos: SegmentoEmpresa[], texto: string): string {
  const nome = texto.trim()
  if (!nome) return ''
  const key = nome.toLowerCase()
  const found = segmentos.find((s) => s.nome.toLowerCase() === key)
  if (found) return found.id
  const id = crypto.randomUUID()
  segmentos.push({ id, nome })
  return id
}

export function segmentoPorId(
  segmentos: SegmentoEmpresa[],
  segmentoId: string | null | undefined,
): SegmentoEmpresa | null {
  if (!segmentoId) return null
  return segmentos.find((s) => s.id === segmentoId) ?? null
}

export function nomeSegmentoEmpresa(
  segmentos: SegmentoEmpresa[],
  segmentoId: string | null | undefined,
): string | null {
  return segmentoPorId(segmentos, segmentoId)?.nome ?? null
}
