import { digitsTelefoneBr, telefoneBrCompleto } from './telefoneBr'

export type WhatsAppMensagemPadrao = {
  id: string
  nome: string
  texto: string
}

const LS_TEMPLATES = 'vestfirma-wa-redirect-templates'

function seedTemplates(): WhatsAppMensagemPadrao[] {
  return [
    { id: crypto.randomUUID(), nome: 'Mensagem padrão 1', texto: '' },
    { id: crypto.randomUUID(), nome: 'Mensagem padrão 2', texto: '' },
    { id: crypto.randomUUID(), nome: 'Mensagem padrão 3', texto: '' },
  ]
}

export function loadWhatsAppMensagensPadrao(): WhatsAppMensagemPadrao[] {
  try {
    const raw = localStorage.getItem(LS_TEMPLATES)
    if (!raw) return seedTemplates()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return seedTemplates()
    return parsed
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
      }))
  } catch {
    return seedTemplates()
  }
}

export function saveWhatsAppMensagensPadrao(templates: WhatsAppMensagemPadrao[]): void {
  try {
    localStorage.setItem(LS_TEMPLATES, JSON.stringify(templates))
  } catch {
    /* ignore */
  }
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
