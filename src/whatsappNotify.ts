import { rotuloLocalLogo } from './logoLocal'
import { rotuloTipoProduto } from './tiposProduto'
import { tituloColuna } from './historicoEtapa'
import type { BoardState, OrderCard, Vendedor } from './types'
import { nomeSegmento } from './types'

export type WhatsAppNotifyEvent = 'pedido_criado' | 'pedido_movido'

export type WhatsAppNotifyPayload = {
  event: WhatsAppNotifyEvent
  message: string
  mentionPhones: string[]
  vendedorId: string | null
  vendedorNome: string | null
  /** ID do grupo WhatsApp desse vendedor (ex.: 120363…@g.us) */
  grupoWhatsapp: string | null
  pedido: string
  cliente: string
  etapa: string
  fromEtapa?: string
  toEtapa?: string
}

const LS_ENABLED = 'vestfirma-wa-notify-enabled'
const LS_MODE = 'vestfirma-wa-notify-mode'

export type WhatsAppNotifyMode = 'webhook' | 'abrir'

export function whatsappNotifyEnabled(): boolean {
  if (import.meta.env.VITE_WHATSAPP_NOTIFY?.trim().toLowerCase() === 'false') return false
  try {
    const stored = localStorage.getItem(LS_ENABLED)
    if (stored === '0') return false
  } catch {
    /* ignore */
  }
  return true
}

export function setWhatsappNotifyEnabled(on: boolean) {
  try {
    localStorage.setItem(LS_ENABLED, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function getWhatsappNotifyMode(): WhatsAppNotifyMode {
  try {
    const m = localStorage.getItem(LS_MODE)
    if (m === 'abrir' || m === 'webhook') return m
  } catch {
    /* ignore */
  }
  return 'webhook'
}

export function setWhatsappNotifyMode(mode: WhatsAppNotifyMode) {
  try {
    localStorage.setItem(LS_MODE, mode)
  } catch {
    /* ignore */
  }
}

export function digitsWhatsapp(value: string): string {
  let d = value.replace(/\D/g, '')
  if (d.length >= 10 && d.length <= 11 && !d.startsWith('55')) {
    d = `55${d}`
  }
  return d
}

function vendedorDoPedido(board: BoardState, vendedorId: string | null): Vendedor | null {
  if (!vendedorId) return null
  return board.vendedores.find((v) => v.id === vendedorId) ?? null
}

function metaVendedor(vendedor: Vendedor | null) {
  return {
    vendedorId: vendedor?.id ?? null,
    vendedorNome: vendedor?.nome ?? null,
    grupoWhatsapp: vendedor?.grupoWhatsapp?.trim() || null,
  }
}

function linhaVendedor(vendedor: Vendedor | null): { texto: string; mentionPhones: string[] } {
  if (!vendedor) return { texto: '', mentionPhones: [] }
  const digits = vendedor.whatsapp?.trim() ? digitsWhatsapp(vendedor.whatsapp) : ''
  const mentionPhones = digits.length >= 12 ? [digits] : []
  let texto = `\n👤 *Vendedor:* ${vendedor.nome}`
  if (digits) {
    texto += `\n📌 _Marque no grupo:_ +${digits}`
  }
  return { texto, mentionPhones }
}

function rodape(): string {
  const when = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `\n\n_Kanban VestFirma · ${when}_`
}

function detalhesPedido(card: OrderCard, board: BoardState): string {
  const local = rotuloLocalLogo(card.localLogo)
  const segmento = nomeSegmento(board, card.segmentoId)
  const produto = rotuloTipoProduto(card.tipoProduto)
  let s = `Pedido: *${card.numeroPedido}*\nCliente: ${card.cliente}\nPeças: ${card.quantidade}`
  if (produto) s += `\nProduto: ${produto}`
  if (segmento) s += `\nSegmento: ${segmento}`
  if (local) s += `\nLocal da logo: ${local}`
  const obs = card.observacao?.trim()
  if (obs) s += `\nObservação: ${obs}`
  return s
}

export function montarMensagemPedidoCriado(card: OrderCard, board: BoardState): WhatsAppNotifyPayload {
  const etapa = tituloColuna(board, card.columnId)
  const vend = vendedorDoPedido(board, card.vendedorId)
  const { texto: vendLinha, mentionPhones } = linhaVendedor(vend)

  const message =
    `🆕 *Novo pedido — VestFirma*\n\n` +
    `${detalhesPedido(card, board)}\n` +
    `Etapa: *${etapa}*` +
    vendLinha +
    rodape()

  return {
    event: 'pedido_criado',
    message,
    mentionPhones,
    ...metaVendedor(vend),
    pedido: card.numeroPedido,
    cliente: card.cliente,
    etapa,
  }
}

export function montarMensagemPedidoMovido(
  card: OrderCard,
  board: BoardState,
  fromColumnId: string,
  toColumnId: string,
): WhatsAppNotifyPayload {
  const fromEtapa = tituloColuna(board, fromColumnId)
  const toEtapa = tituloColuna(board, toColumnId)
  const vend = vendedorDoPedido(board, card.vendedorId)
  const { texto: vendLinha, mentionPhones } = linhaVendedor(vend)

  const message =
    `📦 *Pedido movido — VestFirma*\n\n` +
    `Pedido *${card.numeroPedido}* · ${card.cliente}\n` +
    `De: *${fromEtapa}*\n` +
    `Para: *${toEtapa}*` +
    vendLinha +
    rodape()

  return {
    event: 'pedido_movido',
    message,
    mentionPhones,
    ...metaVendedor(vend),
    pedido: card.numeroPedido,
    cliente: card.cliente,
    etapa: toEtapa,
    fromEtapa,
    toEtapa,
  }
}

function apiNotifyUrl(): string | null {
  const base = import.meta.env.VITE_API_BASE?.trim()
  if (!base) return null
  const root = base.replace(/\/$/, '')
  const path = import.meta.env.VITE_API_NOTIFY_PATH?.trim() || '/notify'
  return `${root}${path.startsWith('/') ? path : `/${path}`}`
}

export async function enviarNotificacaoWhatsApp(payload: WhatsAppNotifyPayload): Promise<void> {
  if (!whatsappNotifyEnabled()) return

  if (!payload.grupoWhatsapp && !payload.vendedorId) {
    console.warn(
      'VestFirma WhatsApp: pedido sem vendedor — cadastre vendedor e grupo em Vendedores.',
    )
  } else if (!payload.grupoWhatsapp) {
    console.warn(
      `VestFirma WhatsApp: ${payload.vendedorNome ?? 'vendedor'} sem ID do grupo — preencha em Vendedores.`,
    )
  }

  const mode = getWhatsappNotifyMode()
  const url = apiNotifyUrl()

  if (mode === 'webhook' && url) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      console.warn('VestFirma: falha ao enviar notificação WhatsApp.', err)
    }
    return
  }

  if (mode === 'abrir') {
    let header = ''
    if (payload.grupoWhatsapp) {
      header = `[Grupo: ${payload.grupoWhatsapp}]\n\n`
    } else if (payload.vendedorNome) {
      header = `[Grupo do vendedor: ${payload.vendedorNome}]\n\n`
    }
    const waUrl = `https://wa.me/?text=${encodeURIComponent(header + payload.message)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }
}

export function notificarSePedidoCriado(card: OrderCard, board: BoardState) {
  void enviarNotificacaoWhatsApp(montarMensagemPedidoCriado(card, board))
}

export function notificarSePedidoMovido(
  card: OrderCard,
  board: BoardState,
  fromColumnId: string,
  toColumnId: string,
) {
  if (fromColumnId === toColumnId) return
  void enviarNotificacaoWhatsApp(
    montarMensagemPedidoMovido(card, board, fromColumnId, toColumnId),
  )
}
