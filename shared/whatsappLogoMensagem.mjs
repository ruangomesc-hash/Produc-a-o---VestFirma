export const TAG_MENSAGEM_LOGO = 'logo'
export const ID_MENSAGEM_LOGO = 'wa-logo-kanban'

export const DEFAULT_MENSAGEM_LOGO =
  'Olá, {cliente}! Tudo bem?\nAqui é da VestFirma. Para seguirmos com o pedido {pedido}, precisamos da sua logo.\nPode nos enviar por aqui, por favor?'

export function preencherMensagemWhatsApp(
  texto,
  card = {},
) {
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

export function templateEhMensagemLogo(item) {
  if (!item || typeof item !== 'object') return false
  if (item.uso === TAG_MENSAGEM_LOGO) return true
  if (item.id === ID_MENSAGEM_LOGO) return true
  return /^logo$/i.test(String(item.nome || '').trim())
}

export function mensagemPadraoLogo() {
  return {
    id: ID_MENSAGEM_LOGO,
    nome: 'Logo',
    texto: DEFAULT_MENSAGEM_LOGO,
    uso: TAG_MENSAGEM_LOGO,
  }
}

export function garantirMensagemLogo(templates) {
  const list = Array.isArray(templates) ? templates.filter(Boolean) : []
  const jaTem = list.find((t) => templateEhMensagemLogo(t))
  if (jaTem) {
    return list.map((t) =>
      t.id === jaTem.id ? { ...t, uso: TAG_MENSAGEM_LOGO, nome: t.nome.trim() || 'Logo' } : { ...t, uso: t.uso === TAG_MENSAGEM_LOGO ? undefined : t.uso },
    )
  }
  return [mensagemPadraoLogo(), ...list]
}

export function marcarMensagemLogo(templates, id) {
  return (Array.isArray(templates) ? templates : []).map((t) => ({
    ...t,
    uso: t.id === id ? TAG_MENSAGEM_LOGO : t.uso === TAG_MENSAGEM_LOGO ? undefined : t.uso,
  }))
}
