import { digitsTelefoneBr, telefoneBrCompleto } from './telefoneBr'

export type WhatsAppMensagemPadrao = {
  id: string
  nome: string
  texto: string
  uso?: string
  etapaId?: string
}

export const TAG_MENSAGEM_WPP = 'wpp-atraso'
export const DEFAULT_MENSAGEM_WPP =
  'Olá, {cliente}! Tudo bem?\nAqui é da VestFirma. O pedido {pedido} está na etapa {etapa} e passou do prazo.\nPode nos responder por aqui para alinharmos o próximo passo?'

const ETAPAS_MENSAGEM_WPP: { id: string; title: string; texto: string }[] = [
  {
    id: 'logos-recebidas',
    title: 'Logos recebidas',
    texto:
      'Olá, {cliente}! Tudo bem?\nAqui é da VestFirma. O pedido {pedido} está em Logos recebidas e passou do prazo desta etapa.\nPode confirmar se a logo está ok para seguirmos, ou se precisa ajustar algo? Responda por aqui.',
  },
  {
    id: 'logos-producao',
    title: 'Logos em produção',
    texto:
      'Olá, {cliente}! Tudo bem?\nAqui é da VestFirma. O pedido {pedido} está em Logos em produção e atrasou nesta etapa.\nEstamos acompanhando a arte. Se precisar de ajuste ou previsão, pode responder nesta conversa.',
  },
  {
    id: 'logos-prontas',
    title: 'Logos prontas',
    texto:
      'Olá, {cliente}! Tudo bem?\nAqui é da VestFirma. A logo do pedido {pedido} já está pronta, mas a etapa passou do prazo.\nPode confirmar a aprovação da arte para avançarmos para a aplicação?',
  },
  {
    id: 'disponiveis-aplicacao',
    title: 'Disponíveis para aplicação',
    texto:
      'Olá, {cliente}! Tudo bem?\nAqui é da VestFirma. O pedido {pedido} está disponível para aplicação e passou do prazo desta etapa.\nSe faltar tamanho, quantidade ou algum detalhe, envie por aqui para não travar a produção.',
  },
  {
    id: 'em-aplicacao',
    title: 'Em aplicação',
    texto:
      'Olá, {cliente}! Tudo bem?\nAqui é da VestFirma. O pedido {pedido} está em aplicação e passou do prazo desta etapa.\nEstamos finalizando as peças. Se precisar de previsão ou ajuste, responda nesta conversa.',
  },
]

export function templateEhMensagemWpp(item: WhatsAppMensagemPadrao | undefined): boolean {
  if (!item) return false
  return item.uso === TAG_MENSAGEM_WPP
}

export function garantirMensagensWppAtraso(
  templates: WhatsAppMensagemPadrao[],
): WhatsAppMensagemPadrao[] {
  const list = Array.isArray(templates) ? templates.filter(Boolean) : []
  const byEtapa = new Map<string, WhatsAppMensagemPadrao>()
  for (const t of list) {
    if (templateEhMensagemWpp(t) && t.etapaId) byEtapa.set(String(t.etapaId), t)
  }
  const extras: WhatsAppMensagemPadrao[] = []
  for (const etapa of ETAPAS_MENSAGEM_WPP) {
    if (byEtapa.has(etapa.id)) continue
    extras.push({
      id: `wa-wpp-${etapa.id}`,
      nome: `WPP · ${etapa.title}`,
      texto: etapa.texto,
      uso: TAG_MENSAGEM_WPP,
      etapaId: etapa.id,
    })
  }
  return extras.length ? [...list, ...extras] : list
}

export function mensagemWppDaEtapa(
  templates: WhatsAppMensagemPadrao[],
  columnId: string,
): WhatsAppMensagemPadrao | null {
  const cid = String(columnId || '').trim()
  const list = Array.isArray(templates) ? templates : []
  const direta = list.find((t) => templateEhMensagemWpp(t) && String(t.etapaId || '') === cid)
  if (direta) return direta
  return list.find((t) => templateEhMensagemWpp(t) && !t.etapaId) || null
}

export const TAG_MENSAGEM_LOGO = 'logo'
export const ID_MENSAGEM_LOGO = 'wa-logo-kanban'
export const DEFAULT_MENSAGEM_LOGO =
  'Olá, {cliente}! Tudo bem?\nAqui é da VestFirma. Para seguirmos com o pedido {pedido}, precisamos da sua logo.\nPode nos enviar por aqui, por favor?'

export function preencherMensagemWhatsApp(
  texto: string,
  card: { cliente?: string; numeroPedido?: string; quantidade?: number; etapa?: string } = {},
): string {
  const cliente = String(card.cliente || '').trim()
  const pedido = String(card.numeroPedido || '').trim()
  const quantidade = String(card.quantidade ?? '').trim()
  const etapa = String(card.etapa || '').trim()
  return String(texto || '')
    .replaceAll('{cliente}', cliente)
    .replaceAll('{nome}', cliente)
    .replaceAll('{pedido}', pedido)
    .replaceAll('{quantidade}', quantidade)
    .replaceAll('{etapa}', etapa)
}

export function templateEhMensagemLogo(item: WhatsAppMensagemPadrao | undefined): boolean {
  if (!item) return false
  if (item.uso === TAG_MENSAGEM_LOGO) return true
  if (item.id === ID_MENSAGEM_LOGO) return true
  return /^solicitar logo$/i.test(String(item.nome || '').trim()) || /^logo$/i.test(String(item.nome || '').trim())
}

export function mensagemPadraoLogo(): WhatsAppMensagemPadrao {
  return {
    id: ID_MENSAGEM_LOGO,
    nome: 'Solicitar logo',
    texto: DEFAULT_MENSAGEM_LOGO,
    uso: TAG_MENSAGEM_LOGO,
  }
}

export function garantirMensagemLogo(templates: WhatsAppMensagemPadrao[]): WhatsAppMensagemPadrao[] {
  const list = Array.isArray(templates) ? templates.filter(Boolean) : []
  const jaTem = list.find((t) => templateEhMensagemLogo(t))
  if (jaTem) {
    return list.map((t) =>
      t.id === jaTem.id
        ? { ...t, uso: TAG_MENSAGEM_LOGO, nome: t.nome.trim() || 'Solicitar logo' }
        : { ...t, uso: t.uso === TAG_MENSAGEM_LOGO ? undefined : t.uso },
    )
  }
  return [mensagemPadraoLogo(), ...list]
}

export function marcarMensagemLogo(
  templates: WhatsAppMensagemPadrao[],
  id: string,
): WhatsAppMensagemPadrao[] {
  return (Array.isArray(templates) ? templates : []).map((t) => {
    if (templateEhMensagemWpp(t)) return t
    return {
      ...t,
      uso: t.id === id ? TAG_MENSAGEM_LOGO : t.uso === TAG_MENSAGEM_LOGO ? undefined : t.uso,
    }
  })
}

const LS_TEMPLATES = 'vestfirma-wa-redirect-templates'

function seedTemplates(): WhatsAppMensagemPadrao[] {
  return garantirMensagensWppAtraso([
    mensagemPadraoLogo(),
    { id: crypto.randomUUID(), nome: 'Mensagem padrão 1', texto: '' },
    { id: crypto.randomUUID(), nome: 'Mensagem padrão 2', texto: '' },
  ])
}

export function loadWhatsAppMensagensPadrao(): WhatsAppMensagemPadrao[] {
  try {
    const raw = localStorage.getItem(LS_TEMPLATES)
    if (!raw) return seedTemplates()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return seedTemplates()
    const cleaned = parsed
      .filter(
        (item): item is WhatsAppMensagemPadrao =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as WhatsAppMensagemPadrao).id === 'string' &&
          typeof (item as WhatsAppMensagemPadrao).nome === 'string' &&
          typeof (item as WhatsAppMensagemPadrao).texto === 'string',
      )
      .map((item) => ({
        id: item.id,
        nome: item.nome.trim() || 'Mensagem',
        texto: item.texto,
        uso: typeof item.uso === 'string' ? item.uso : undefined,
        etapaId: typeof item.etapaId === 'string' ? item.etapaId : undefined,
      }))
    return garantirMensagensWppAtraso(garantirMensagemLogo(cleaned))
  } catch {
    return seedTemplates()
  }
}

export function saveWhatsAppMensagensPadrao(templates: WhatsAppMensagemPadrao[]): WhatsAppMensagemPadrao[] {
  const stored = garantirMensagensWppAtraso(garantirMensagemLogo(templates))
  try {
    localStorage.setItem(LS_TEMPLATES, JSON.stringify(stored))
  } catch {
    /* ignore */
  }
  return stored
}

export function mensagemSeloLogo(
  templates: WhatsAppMensagemPadrao[] = loadWhatsAppMensagensPadrao(),
): WhatsAppMensagemPadrao {
  return templates.find((t) => templateEhMensagemLogo(t)) ?? mensagemPadraoLogo()
}

/** Link wa.me com DDD + número BR e texto opcional. */
export function buildWhatsAppRedirectUrl(numeroBr: string, texto: string): string | null {
  if (!telefoneBrCompleto(numeroBr)) return null
  const digits = digitsTelefoneBr(numeroBr)
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  const base = `https://wa.me/${withCountry}`
  const msg = texto.trim()
  if (!msg) return base
  return `${base}?text=${encodeURIComponent(msg)}`
}

export function openWhatsAppRedirect(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function linkWhatsAppSeloLogo(card: {
  cliente: string
  numeroPedido: string
  quantidade?: number
  whatsappCliente?: string
}): { ok: true; url: string } | { ok: false; error: string } {
  const numero = card.whatsappCliente ?? ''
  if (!telefoneBrCompleto(numero)) {
    return {
      ok: false,
      error: 'Este pedido não tem WhatsApp do cliente. Cadastre o número na ficha e tente de novo.',
    }
  }
  const template = mensagemSeloLogo()
  const texto = preencherMensagemWhatsApp(template.texto, card)
  const url = buildWhatsAppRedirectUrl(numero, texto)
  if (!url) {
    return { ok: false, error: 'Não foi possível montar o WhatsApp. Confira o número na ficha.' }
  }
  return { ok: true, url }
}

export function abrirWhatsAppSeloLogo(card: {
  cliente: string
  numeroPedido: string
  quantidade?: number
  whatsappCliente?: string
}): { ok: true } | { ok: false; error: string } {
  const linked = linkWhatsAppSeloLogo(card)
  if (!linked.ok) return linked
  openWhatsAppRedirect(linked.url)
  return { ok: true }
}

export function abrirWhatsAppSeloWpp(
  card: {
    cliente: string
    numeroPedido: string
    quantidade?: number
    whatsappCliente?: string
    columnId: string
  },
  columnTitle: string,
): { ok: true } | { ok: false; error: string } {
  const numero = card.whatsappCliente ?? ''
  if (!telefoneBrCompleto(numero)) {
    return {
      ok: false,
      error: 'Este pedido não tem WhatsApp do cliente. Cadastre o número na ficha e tente de novo.',
    }
  }
  const templates = loadWhatsAppMensagensPadrao()
  const template = mensagemWppDaEtapa(templates, card.columnId)
  const texto = preencherMensagemWhatsApp(template?.texto || DEFAULT_MENSAGEM_WPP, {
    ...card,
    etapa: columnTitle,
  })
  const url = buildWhatsAppRedirectUrl(numero, texto)
  if (!url) {
    return { ok: false, error: 'Não foi possível montar o WhatsApp. Confira o número na ficha.' }
  }
  openWhatsAppRedirect(url)
  return { ok: true }
}
