import { DEFAULT_BOARD } from './defaultBoard'
import { garantirHistoricoCard } from './historicoEtapa'
import type { LogoLocal } from './logoLocal'
import { mesclarSegmentos } from './segmentosEmpresa'
import type { BoardState, OrderCard } from './types'

const VEND = {
  ana: 'demo-vend-ana',
  bruno: 'demo-vend-bruno',
  carla: 'demo-vend-carla',
} as const

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function card(
  data: Omit<OrderCard, 'createdAt' | 'historicoEtapa' | 'localLogo' | 'segmentoId' | 'comentarios'> & {
    createdAt?: string
    historicoEtapa?: OrderCard['historicoEtapa']
    comentarios?: OrderCard['comentarios']
    localLogo?: LogoLocal | null
    segmentoId?: string | null
  },
): OrderCard {
  return {
    historicoEtapa: data.historicoEtapa ?? [],
    comentarios: data.comentarios ?? [],
    localLogo: data.localLogo ?? 'frente',
    segmentoId: data.segmentoId ?? 'seg-varejo',
    ...data,
    createdAt: data.createdAt ?? data.etapaDesde,
  }
}

/** Quadro de exemplo com pedidos em todas as etapas (prazos e atrasos variados). */
export function createDemoBoard(): BoardState {
  const today = new Date().toISOString().slice(0, 10)

  const cards: OrderCard[] = [
    card({
      id: 'demo-001',
      columnId: 'logos-recebidas',
      cliente: 'Padaria Sol',
      whatsappCliente: '(11) 98765-1111',
      vendedorId: VEND.ana,
      segmentoId: 'seg-padaria',
      quantidade: 12,
      numeroPedido: 'VF-2401',
      canal: 'whatsapp',
      endereco: 'Rua das Flores, 120 — São Paulo/SP',
      dataPedido: today,
      dataPagamento: today,
      logoEnviadaCliente: null,
      logoProntaImpressao: null,
      etapaDesde: hoursAgo(3),
    }),
    card({
      id: 'demo-002',
      columnId: 'logos-recebidas',
      cliente: 'Clínica Vida',
      whatsappCliente: '(21) 99876-2222',
      vendedorId: VEND.bruno,
      quantidade: 28,
      numeroPedido: 'VF-2402',
      canal: 'ecommerce',
      endereco: 'Av. Central, 450 — Rio de Janeiro/RJ',
      dataPedido: daysAgo(2),
      dataPagamento: daysAgo(2),
      logoEnviadaCliente: null,
      logoProntaImpressao: null,
      etapaDesde: hoursAgo(26),
    }),
    card({
      id: 'demo-003',
      columnId: 'logos-producao',
      cliente: 'Auto Center MX',
      whatsappCliente: '(31) 99123-3333',
      vendedorId: VEND.carla,
      quantidade: 15,
      numeroPedido: 'VF-2398',
      canal: 'whatsapp',
      endereco: 'Belo Horizonte/MG',
      dataPedido: daysAgo(1),
      dataPagamento: daysAgo(1),
      logoEnviadaCliente: null,
      logoProntaImpressao: null,
      etapaDesde: hoursAgo(8),
    }),
    card({
      id: 'demo-004',
      columnId: 'logos-producao',
      cliente: 'Escola Nova Era',
      whatsappCliente: '(41) 99234-4444',
      vendedorId: VEND.ana,
      quantidade: 52,
      numeroPedido: 'VF-2395',
      canal: 'ecommerce',
      endereco: 'Curitiba/PR',
      dataPedido: daysAgo(3),
      dataPagamento: daysAgo(3),
      logoEnviadaCliente: null,
      logoProntaImpressao: null,
      etapaDesde: hoursAgo(30),
    }),
    card({
      id: 'demo-005',
      columnId: 'logos-prontas',
      cliente: 'Restaurante Sabor',
      whatsappCliente: '(51) 99345-5555',
      vendedorId: VEND.bruno,
      quantidade: 20,
      numeroPedido: 'VF-2390',
      canal: 'whatsapp',
      endereco: 'Porto Alegre/RS',
      dataPedido: daysAgo(2),
      dataPagamento: daysAgo(2),
      logoEnviadaCliente: null,
      logoProntaImpressao: null,
      etapaDesde: hoursAgo(5),
    }),
    card({
      id: 'demo-006',
      columnId: 'disponiveis-aplicacao',
      cliente: 'Tech Solutions',
      whatsappCliente: '(11) 99456-6666',
      vendedorId: VEND.carla,
      quantidade: 8,
      numeroPedido: 'VF-2388',
      canal: 'ecommerce',
      endereco: 'Campinas/SP',
      dataPedido: daysAgo(1),
      dataPagamento: daysAgo(1),
      logoEnviadaCliente: null,
      logoProntaImpressao: null,
      etapaDesde: hoursAgo(2),
    }),
    card({
      id: 'demo-007',
      columnId: 'disponiveis-aplicacao',
      cliente: 'Construtora Alfa',
      whatsappCliente: '(11) 99567-7777',
      vendedorId: VEND.ana,
      quantidade: 35,
      numeroPedido: 'VF-2385',
      canal: 'whatsapp',
      endereco: 'Guarulhos/SP',
      dataPedido: daysAgo(2),
      dataPagamento: daysAgo(1),
      logoEnviadaCliente: null,
      logoProntaImpressao: null,
      etapaDesde: hoursAgo(7),
    }),
    card({
      id: 'demo-008',
      columnId: 'em-aplicacao',
      cliente: 'Hotel Praia',
      whatsappCliente: '(13) 99678-8888',
      vendedorId: VEND.bruno,
      quantidade: 18,
      numeroPedido: 'VF-2382',
      canal: 'whatsapp',
      endereco: 'Santos/SP',
      dataPedido: daysAgo(1),
      dataPagamento: today,
      logoEnviadaCliente: null,
      logoProntaImpressao: null,
      etapaDesde: hoursAgo(1.5),
    }),
    card({
      id: 'demo-009',
      columnId: 'em-aplicacao',
      cliente: 'Academia FitPro',
      whatsappCliente: '(11) 99789-9999',
      vendedorId: VEND.carla,
      quantidade: 40,
      numeroPedido: 'VF-2380',
      canal: 'ecommerce',
      endereco: 'Osasco/SP',
      dataPedido: daysAgo(2),
      dataPagamento: daysAgo(1),
      logoEnviadaCliente: null,
      logoProntaImpressao: null,
      etapaDesde: hoursAgo(5),
    }),
    card({
      id: 'demo-010',
      columnId: 'liberado-logistica',
      cliente: 'Distribuidora Norte',
      whatsappCliente: '(11) 98888-0000',
      vendedorId: VEND.ana,
      quantidade: 24,
      numeroPedido: 'VF-2375',
      canal: 'whatsapp',
      endereco: 'Rua Logística, 900 — São Paulo/SP',
      dataPedido: daysAgo(3),
      dataPagamento: daysAgo(2),
      logoEnviadaCliente: null,
      logoProntaImpressao: null,
      etapaDesde: hoursAgo(2),
    }),
    card({
      id: 'demo-011',
      columnId: 'liberado-logistica',
      cliente: 'Eventos & Cia',
      whatsappCliente: '(11) 97777-1111',
      vendedorId: VEND.bruno,
      quantidade: 6,
      numeroPedido: 'VF-2372',
      canal: 'ecommerce',
      endereco: 'São Bernardo/SP',
      dataPedido: daysAgo(4),
      dataPagamento: daysAgo(3),
      logoEnviadaCliente: null,
      logoProntaImpressao: null,
      etapaDesde: hoursAgo(12),
    }),
  ]

  const board: BoardState = {
    columns: structuredClone(DEFAULT_BOARD.columns),
    vendedores: [
      { id: VEND.ana, nome: 'Ana Silva' },
      { id: VEND.bruno, nome: 'Bruno Costa' },
      { id: VEND.carla, nome: 'Carla Mendes' },
    ],
    segmentos: mesclarSegmentos([]),
    cards,
    demo: true,
  }

  return {
    ...board,
    cards: cards.map((c) => garantirHistoricoCard(c, board)),
  }
}
