export const TAG_MENSAGEM_WPP = 'wpp-atraso'

export const ETAPAS_MENSAGEM_WPP = [
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

export const DEFAULT_MENSAGEM_WPP =
  'Olá, {cliente}! Tudo bem?\nAqui é da VestFirma. O pedido {pedido} está na etapa {etapa} e passou do prazo.\nPode nos responder por aqui para alinharmos o próximo passo?'

export function idMensagemWppEtapa(columnId) {
  return `wa-wpp-${String(columnId || '').trim()}`
}

export function templateEhMensagemWpp(item) {
  if (!item || typeof item !== 'object') return false
  return item.uso === TAG_MENSAGEM_WPP
}

export function mensagemPadraoWppEtapa(etapa) {
  return {
    id: idMensagemWppEtapa(etapa.id),
    nome: `WPP · ${etapa.title}`,
    texto: etapa.texto,
    uso: TAG_MENSAGEM_WPP,
    etapaId: etapa.id,
  }
}

export function garantirMensagensWppAtraso(templates) {
  const list = Array.isArray(templates) ? templates.filter(Boolean) : []
  const byEtapa = new Map()
  for (const t of list) {
    if (templateEhMensagemWpp(t) && t.etapaId) byEtapa.set(String(t.etapaId), t)
  }
  const extras = []
  for (const etapa of ETAPAS_MENSAGEM_WPP) {
    if (!byEtapa.has(etapa.id)) extras.push(mensagemPadraoWppEtapa(etapa))
  }
  return extras.length ? [...list, ...extras] : list
}

export function mensagemWppDaEtapa(templates, columnId) {
  const cid = String(columnId || '').trim()
  const list = Array.isArray(templates) ? templates : []
  const direta = list.find((t) => templateEhMensagemWpp(t) && String(t.etapaId || '') === cid)
  if (direta) return direta
  return list.find((t) => templateEhMensagemWpp(t) && !t.etapaId) || null
}
