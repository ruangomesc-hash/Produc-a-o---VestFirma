import type { OrderCard } from './types'
import { rotuloTipoProduto } from './tiposProduto'

export type TamanhoFinanceiro = { tamanho: string; quantidade: number }

export type ProdutoFinanceiro = {
  nome: string
  total: number
  pedidos: number
  tamanhos: TamanhoFinanceiro[]
}

export type ResumoFinanceiro = {
  usados: ProdutoFinanceiro[]
  fora: ProdutoFinanceiro[]
  pecasUsadas: number
  pecasFora: number
  pedidosUsados: number
  pedidosFora: number
}

export type PedidoDiaFinanceiro = {
  id: string
  numero: string
  pecas: number
  produtos: string[]
  fora: boolean
}

export type DiaFinanceiro = {
  data: string
  pecas: number
  pecasFora: number
  /** O dia está dentro do período escolhido. O resto do mês aparece vazio para ir preenchendo. */
  dentro: boolean
  pedidos: PedidoDiaFinanceiro[]
}

export type TimelineFinanceira = {
  dias: DiaFinanceiro[]
  periodoCortado: boolean
}

const ORDEM_TAMANHO = [
  'PP',
  'P',
  'M',
  'G',
  'GG',
  'XG',
  'XXG',
  'XGG',
  'EG',
  'EXG',
  '1',
  '2',
  '4',
  '6',
  '8',
  '10',
  '12',
  '14',
  '16',
  '18',
  'Único',
  'Sem tamanho',
]

const NUMERICOS = new Set(['1', '2', '4', '6', '8', '10', '12', '14', '16', '18'])

const NOME_TAMANHO: Record<string, string> = {
  pp: 'PP',
  p: 'P',
  m: 'M',
  g: 'G',
  gg: 'GG',
  xg: 'XG',
  xxg: 'XXG',
  xgg: 'XGG',
  eg: 'EG',
  exg: 'EXG',
  unico: 'Único',
  un: 'Único',
  u: 'Único',
}

function semAcento(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function chaveProduto(nome: string) {
  return semAcento(nome).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const FAMILIAS = [
  { nome: 'Corta-vento', termos: ['corta vento', 'corta venda', 'cortavento', 'cortavenda'] },
  { nome: 'Baby look', termos: ['baby look', 'babylook'] },
  { nome: 'Camisa plus size', termos: ['plus size', 'plussize'] },
  { nome: 'Camisa manga longa', termos: ['manga longa'] },
  { nome: 'Camisa dry fit', termos: ['dry fit', 'dryfit'] },
  { nome: 'Camisa oversize', termos: ['oversize', 'oversized'] },
  { nome: 'Camisa polo', termos: ['polo'] },
  { nome: 'Camisa algodão 100%', termos: ['algodao'] },
  { nome: 'Infantil', termos: ['infantil'] },
  { nome: 'Camiseta', termos: ['camiseta', 'camisa'] },
]

/** O link de venda muda o nome. O produto é a família que aparece nele, como corta-vento. */
export function familiaDoNome(nome: string) {
  const chave = ` ${chaveProduto(nome)} `
  for (const familia of FAMILIAS) {
    for (const termo of familia.termos) {
      const alvo = ` ${chaveProduto(termo)} `
      if (alvo.trim() && chave.includes(alvo)) return familia.nome
    }
  }
  return null
}

function tokenTamanho(token: string) {
  const texto = semAcento(token).replace(/[.\s]+/g, '').trim()
  if (!texto) return null
  if (NOME_TAMANHO[texto]) return NOME_TAMANHO[texto]
  if (NUMERICOS.has(texto)) return texto
  return null
}

/** Tamanho explícito num texto de variante. Não trata estampa nem o nome do produto. */
export function tamanhoNoTexto(texto: string | undefined) {
  const bruto = String(texto || '').trim()
  if (!bruto) return null
  const partes = bruto.split(/[/|,;]+/).map((parte) => parte.trim()).filter(Boolean)
  const alvos = partes.length ? partes : [bruto]
  for (const parte of [...alvos].reverse()) {
    const limpo = parte.replace(/^tamanho\s+/i, '').trim()
    const direto = tokenTamanho(limpo)
    if (direto) return direto
    const pedacos = limpo.split(/[\s-]+/).filter(Boolean)
    for (const pedaco of [...pedacos].reverse()) {
      const achou = tokenTamanho(pedaco)
      if (achou) return achou
    }
  }
  return null
}

export function separarProdutoTamanho(titulo: string, detalhe?: string) {
  let nome = String(titulo || '').trim()
  const doDetalhe = tamanhoNoTexto(detalhe)
  let tamanho = doDetalhe
  if (!tamanho) {
    const pedacos = nome.split(/[\s-]+/).filter(Boolean)
    const ultimo = pedacos[pedacos.length - 1]
    const doTitulo = pedacos.length > 1 ? tokenTamanho(ultimo) : null
    if (doTitulo) {
      tamanho = doTitulo
      nome = nome.replace(new RegExp(`[\\s-]+${ultimo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '').trim()
    }
  }
  if (!tamanho) tamanho = 'Sem tamanho'
  if (!nome) nome = 'Sem produto informado'
  return { nome, tamanho }
}

function linhasDoCard(card: OrderCard) {
  const deLinha = (card.linhasPedido ?? [])
    .map((item) => ({
      titulo: String(item.titulo || '').trim(),
      quantidade: Math.max(0, Math.floor(Number(item.quantidade) || 0)),
      detalhe: String(item.detalhe || '').trim(),
    }))
    .filter((item) => item.titulo && item.quantidade > 0)
  if (deLinha.length) return deLinha

  const deTipo = (card.itensProduto ?? [])
    .map((item) => ({
      titulo: rotuloTipoProduto(item.tipoProduto) || item.tipoProduto,
      quantidade: Math.max(0, Math.floor(Number(item.quantidade) || 0)),
      detalhe: '',
    }))
    .filter((item) => item.titulo && item.quantidade > 0)
  if (deTipo.length) return deTipo

  const legado = card.tipoProduto?.trim()
  const quantidadeLegada = Math.max(0, Math.floor(Number(card.quantidade) || 0))
  if (legado && quantidadeLegada > 0) {
    return [{ titulo: rotuloTipoProduto(legado) || legado, quantidade: quantidadeLegada, detalhe: '' }]
  }
  return []
}

export function dataReferenciaPedido(card: Pick<OrderCard, 'dataPedido' | 'createdAt'>) {
  const direta = String(card.dataPedido || '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(direta)) return direta
  const instante = Date.parse(card.createdAt || '')
  if (Number.isNaN(instante)) return ''
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(instante))
  } catch {
    return new Date(instante).toISOString().slice(0, 10)
  }
}

export function hojeNoBrasil(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}

export function periodoDesteMes(hoje: string) {
  const [ano, mes] = hoje.split('-')
  if (!ano || !mes) return { inicio: '', fim: '' }
  return { inicio: `${ano}-${mes}-01`, fim: hoje }
}

export function periodoMesPassado(hoje: string) {
  const [ano, mes] = hoje.split('-').map(Number)
  if (!ano || !mes) return { inicio: '', fim: '' }
  const inicio = new Date(Date.UTC(ano, mes - 2, 1))
  const fim = new Date(Date.UTC(ano, mes - 1, 0))
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  }
}

function classePedido(card: OrderCard) {
  if (card.pedidoTeste) return 'ignorar'
  if (card.shopifyPedidoStatus === 'cancelado' || card.shopifyPedidoStatus === 'expirado') return 'fora'
  if (card.columnId === 'cancelados-expirados') return 'fora'
  return 'usado'
}

function ordemTamanho(tamanho: string) {
  const indice = ORDEM_TAMANHO.indexOf(tamanho)
  return indice === -1 ? ORDEM_TAMANHO.length : indice
}

function somarLinha(
  grupo: Map<string, { nomes: Map<string, number>; tamanhos: Map<string, number>; pedidos: Set<string>; total: number }>,
  card: OrderCard,
  linha: { titulo: string; quantidade: number; detalhe: string },
) {
  const separado = separarProdutoTamanho(linha.titulo, linha.detalhe)
  const nome = familiaDoNome(separado.nome) || separado.nome
  const chave = chaveProduto(nome) || 'sem produto informado'
  let produto = grupo.get(chave)
  if (!produto) {
    produto = { nomes: new Map(), tamanhos: new Map(), pedidos: new Set(), total: 0 }
    grupo.set(chave, produto)
  }
  produto.nomes.set(nome, (produto.nomes.get(nome) || 0) + linha.quantidade)
  produto.tamanhos.set(separado.tamanho, (produto.tamanhos.get(separado.tamanho) || 0) + linha.quantidade)
  produto.total += linha.quantidade
  if (card.id) produto.pedidos.add(card.id)
}

function listarProdutos(
  grupo: Map<string, { nomes: Map<string, number>; tamanhos: Map<string, number>; pedidos: Set<string>; total: number }>,
): ProdutoFinanceiro[] {
  return [...grupo.values()]
    .map((produto) => {
      let popular = ''
      let vezesPopular = -1
      let comMaiuscula = ''
      let vezesMaiuscula = -1
      for (const [rotulo, vezes] of produto.nomes) {
        if (vezes > vezesPopular) {
          popular = rotulo
          vezesPopular = vezes
        }
        if (/\p{Lu}/u.test(rotulo) && vezes > vezesMaiuscula) {
          comMaiuscula = rotulo
          vezesMaiuscula = vezes
        }
      }
      const nome = comMaiuscula || popular || 'Sem produto informado'
      const tamanhos = [...produto.tamanhos.entries()]
        .map(([tamanho, quantidade]) => ({ tamanho, quantidade }))
        .sort((a, b) => ordemTamanho(a.tamanho) - ordemTamanho(b.tamanho) || a.tamanho.localeCompare(b.tamanho, 'pt-BR'))
      return { nome, total: produto.total, pedidos: produto.pedidos.size, tamanhos }
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Peças usadas no período, por produto e tamanho. Cancelados e expirados ficam à parte. Teste fica de fora. */
export function resumirPecasFinanceiro(cards: OrderCard[], inicio: string, fim: string): ResumoFinanceiro {
  const de = inicio || ''
  const ate = fim || ''
  const usados = new Map<string, { nomes: Map<string, number>; tamanhos: Map<string, number>; pedidos: Set<string>; total: number }>()
  const fora = new Map<string, { nomes: Map<string, number>; tamanhos: Map<string, number>; pedidos: Set<string>; total: number }>()
  const pedidosUsados = new Set<string>()
  const pedidosFora = new Set<string>()

  for (const card of cards) {
    const classe = classePedido(card)
    if (classe === 'ignorar') continue
    const data = dataReferenciaPedido(card)
    if (!data || (de && data < de) || (ate && data > ate)) continue
    const linhas = linhasDoCard(card)
    if (!linhas.length) continue
    const destino = classe === 'fora' ? fora : usados
    const pedidos = classe === 'fora' ? pedidosFora : pedidosUsados
    if (card.id) pedidos.add(card.id)
    for (const linha of linhas) somarLinha(destino, card, linha)
  }

  const listaUsados = listarProdutos(usados)
  const listaFora = listarProdutos(fora)
  return {
    usados: listaUsados,
    fora: listaFora,
    pecasUsadas: listaUsados.reduce((soma, item) => soma + item.total, 0),
    pecasFora: listaFora.reduce((soma, item) => soma + item.total, 0),
    pedidosUsados: pedidosUsados.size,
    pedidosFora: pedidosFora.size,
  }
}

function avancarData(iso: string, dias: number) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

function numeroDoPedido(card: OrderCard) {
  const bruto = String(card.numeroPedido || card.shopifyOrderName || '').replace(/^#/, '').trim()
  return bruto || 's/n'
}

function pecasEProdutos(card: OrderCard) {
  const linhas = linhasDoCard(card)
  if (!linhas.length) {
    return { pecas: Math.max(0, Math.floor(Number(card.quantidade) || 0)), produtos: [] as string[] }
  }
  const produtos: string[] = []
  let pecas = 0
  for (const linha of linhas) {
    pecas += linha.quantidade
    const separado = separarProdutoTamanho(linha.titulo, linha.detalhe)
    const nome = familiaDoNome(separado.nome) || separado.nome
    if (nome && !produtos.includes(nome)) produtos.push(nome)
  }
  return { pecas, produtos }
}

function ordemNumero(numero: string) {
  const valor = Number(numero.replace(/\D/g, ''))
  return Number.isFinite(valor) && valor > 0 ? valor : Number.MAX_SAFE_INTEGER
}

function inicioDoMes(iso: string) {
  const [ano, mes] = iso.split('-')
  return `${ano}-${mes}-01`
}

function fimDoMes(iso: string) {
  const [ano, mes] = iso.split('-').map(Number)
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return `${ano}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
}

/** O eixo vai do dia 1 ao último dia do mês. O pedido só entra se a data estiver no período escolhido. */
export function timelinePedidosFinanceiro(cards: OrderCard[], inicio: string, fim: string): TimelineFinanceira {
  const deInformado = inicio || ''
  const ate = fim || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deInformado) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || deInformado > ate) {
    return { dias: [], periodoCortado: false }
  }
  const eixoFim = fimDoMes(ate)
  const limite = avancarData(eixoFim, -399)
  const eixoInicio = inicioDoMes(deInformado)
  const de = eixoInicio < limite ? limite : eixoInicio
  const porDia = new Map<string, DiaFinanceiro>()
  let cursor = de
  while (cursor <= eixoFim && porDia.size < 400) {
    porDia.set(cursor, {
      data: cursor,
      pecas: 0,
      pecasFora: 0,
      dentro: cursor >= deInformado && cursor <= ate,
      pedidos: [],
    })
    cursor = avancarData(cursor, 1)
  }

  for (const card of cards) {
    const classe = classePedido(card)
    if (classe === 'ignorar') continue
    const data = dataReferenciaPedido(card)
    const dia = porDia.get(data)
    if (!dia?.dentro) continue
    const { pecas, produtos } = pecasEProdutos(card)
    const fora = classe === 'fora'
    if (fora) dia.pecasFora += pecas
    else dia.pecas += pecas
    dia.pedidos.push({
      id: card.id || `${data}-${numeroDoPedido(card)}`,
      numero: numeroDoPedido(card),
      pecas,
      produtos,
      fora,
    })
  }

  for (const dia of porDia.values()) {
    dia.pedidos.sort((a, b) => ordemNumero(a.numero) - ordemNumero(b.numero) || a.numero.localeCompare(b.numero, 'pt-BR'))
  }

  return { dias: [...porDia.values()], periodoCortado: deInformado < de }
}
