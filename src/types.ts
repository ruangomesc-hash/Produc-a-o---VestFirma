import type { LogoLocal } from './logoLocal'
import type { PedidoItemProduto, TipoProdutoId } from './tiposProduto'
import type { UserRole } from './userRoles'

export type SalesChannel = 'whatsapp' | 'ecommerce'

export type HistoricoEtapaTipo = 'criado' | 'avancou' | 'voltou' | 'movido'

export interface HistoricoEtapaEntry {
  id: string
  tipo: HistoricoEtapaTipo
  columnId: string
  columnTitle: string
  at: string
  fromColumnId?: string
  fromColumnTitle?: string
  /** Quem moveu o pedido nesta etapa (a partir do login). */
  autorNome?: string
  autorEmail?: string
  autorRole?: UserRole
}

export interface PedidoComentario {
  id: string
  texto: string
  autorNome: string
  autorEmail: string
  autorRole?: UserRole
  at: string
}

export interface Vendedor {
  id: string
  nome: string
  /** Vínculo com usuário de login (perfil Vendedor em Usuários) */
  userId?: string
  email?: string
  /** WhatsApp com DDD — usado para marcar o vendedor no grupo */
  whatsapp?: string
  /**
   * Grupo exclusivo do vendedor (Evolution API: 120363…@g.us).
   * Enviado no webhook para n8n postar no grupo certo.
   */
  grupoWhatsapp?: string
  /** Perfil do login vinculado (Usuários). */
  managedRole?: UserRole
}

export interface SegmentoEmpresa {
  id: string
  nome: string
}

export interface OrderCard {
  id: string
  columnId: string
  cliente: string
  whatsappCliente: string
  vendedorId: string | null
  segmentoId: string | null
  quantidade: number
  numeroPedido: string
  canal: SalesChannel
  endereco: string
  /** Notas gerais do pedido (instruções, combinações, lembretes). */
  observacao?: string
  /** Tipos de peça e quantidade de cada um (ex.: 5 polos + 10 corta-vento). */
  itensProduto?: PedidoItemProduto[]
  /** @deprecated migrado para itensProduto na carga. */
  tipoProduto?: TipoProdutoId | null
  dataPedido: string
  dataPagamento: string
  logoEnviadaCliente: string[]
  logoProntaImpressao: string[]
  previewAprovacaoCliente: string[]
  localLogo: LogoLocal | null
  etapaDesde: string
  createdAt: string
  historicoEtapa: HistoricoEtapaEntry[]
  /** Observações compartilhadas (atrasos, alterações, etc.). */
  comentarios: PedidoComentario[]
  /** Preenchido ao “arquivar” — pedido some do kanban mas permanece no JSON. */
  arquivadoEm?: string | null
  /** Pedido criado pela loja Shopify (webhook). */
  origem?: 'shopify' | 'manual'
  shopifyOrderId?: string
  shopifyOrderName?: string
}

export interface Column {
  id: string
  title: string
}

export interface BoardState {
  columns: Column[]
  cards: OrderCard[]
  vendedores: Vendedor[]
  /** Segmentos de empresa (padrão + personalizados) */
  segmentos?: SegmentoEmpresa[]
}

export type CardFormData = Omit<
  OrderCard,
  | 'id'
  | 'columnId'
  | 'createdAt'
  | 'etapaDesde'
  | 'historicoEtapa'
  | 'comentarios'
  | 'origem'
  | 'shopifyOrderId'
  | 'shopifyOrderName'
>

export function nomeVendedor(board: BoardState, vendedorId: string | null): string | null {
  if (!vendedorId) return null
  return board.vendedores.find((v) => v.id === vendedorId)?.nome ?? 'Vendedor removido'
}

export function segmentosDoQuadro(board: BoardState): SegmentoEmpresa[] {
  return board.segmentos ?? []
}

export function nomeSegmento(board: BoardState, segmentoId: string | null): string | null {
  if (!segmentoId) return null
  const seg = segmentosDoQuadro(board).find((s) => s.id === segmentoId)
  return seg?.nome ?? 'Segmento removido'
}
