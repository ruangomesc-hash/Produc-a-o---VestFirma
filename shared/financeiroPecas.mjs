const ROTULOS = {
  'camisa-algodao-100': 'Camisa algodão 100%',
  'camisa-polo': 'Camisa polo',
  'corta-vento': 'Corta-vento',
  'baby-look': 'Baby look',
  infantil: 'Infantil',
  'camisa-manga-longa': 'Camisa manga longa',
  'camisa-dry-fit': 'Camisa dry fit',
  'camisa-oversize': 'Camisa oversize',
  'camisa-plus-size-algodao': 'Camisa plus size algodão',
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

const NOME_TAMANHO = {
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

function semAcento(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function chaveProduto(nome) {
  return semAcento(nome).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenTamanho(token) {
  const texto = semAcento(token).replace(/[.\s]+/g, '').trim()
  if (!texto) return null
  if (NOME_TAMANHO[texto]) return NOME_TAMANHO[texto]
  if (NUMERICOS.has(texto)) return texto
  return null
}

/** Tamanho explícito num texto de variante. Não trata estampa nem o nome do produto. */
export function tamanhoNoTexto(texto) {
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

export function separarProdutoTamanho(titulo, detalhe) {
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

function linhasDoCard(card) {
  const linhas = Array.isArray(card?.linhasPedido) ? card.linhasPedido : []
  const deLinha = []
  for (const item of linhas) {
    const titulo = String(item?.titulo || '').trim()
    const quantidade = Math.max(0, Math.floor(Number(item?.quantidade) || 0))
    if (!titulo || quantidade <= 0) continue
    deLinha.push({ titulo, quantidade, detalhe: String(item?.detalhe || '').trim() })
  }
  if (deLinha.length) return deLinha

  const itens = Array.isArray(card?.itensProduto) ? card.itensProduto : []
  const deTipo = []
  for (const item of itens) {
    const id = String(item?.tipoProduto || '').trim()
    const quantidade = Math.max(0, Math.floor(Number(item?.quantidade) || 0))
    if (!id || quantidade <= 0) continue
    deTipo.push({ titulo: ROTULOS[id] || id, quantidade, detalhe: '' })
  }
  if (deTipo.length) return deTipo

  const legado = String(card?.tipoProduto || '').trim()
  const quantidadeLegada = Math.max(0, Math.floor(Number(card?.quantidade) || 0))
  if (legado && quantidadeLegada > 0) {
    return [{ titulo: ROTULOS[legado] || legado, quantidade: quantidadeLegada, detalhe: '' }]
  }
  return []
}

export function dataReferenciaPedido(card) {
  const direta = String(card?.dataPedido || '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(direta)) return direta
  const instante = Date.parse(card?.createdAt || '')
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

export function periodoDesteMes(hoje) {
  const [ano, mes] = String(hoje || '').split('-')
  if (!ano || !mes) return { inicio: '', fim: '' }
  return { inicio: `${ano}-${mes}-01`, fim: hoje }
}

export function periodoMesPassado(hoje) {
  const [ano, mes] = String(hoje || '').split('-').map(Number)
  if (!ano || !mes) return { inicio: '', fim: '' }
  const inicio = new Date(Date.UTC(ano, mes - 2, 1))
  const fim = new Date(Date.UTC(ano, mes - 1, 0))
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  }
}

function classePedido(card) {
  if (card?.pedidoTeste) return 'ignorar'
  if (card?.shopifyPedidoStatus === 'cancelado' || card?.shopifyPedidoStatus === 'expirado') return 'fora'
  if (card?.columnId === 'cancelados-expirados') return 'fora'
  return 'usado'
}

function ordemTamanho(tamanho) {
  const indice = ORDEM_TAMANHO.indexOf(tamanho)
  return indice === -1 ? ORDEM_TAMANHO.length : indice
}

function montarGrupo() {
  return { nomes: new Map(), tamanhos: new Map(), pedidos: new Set(), total: 0 }
}

function somarLinha(grupo, card, linha) {
  const separado = separarProdutoTamanho(linha.titulo, linha.detalhe)
  const chave = chaveProduto(separado.nome) || 'sem produto informado'
  let produto = grupo.get(chave)
  if (!produto) {
    produto = montarGrupo()
    grupo.set(chave, produto)
  }
  produto.nomes.set(separado.nome, (produto.nomes.get(separado.nome) || 0) + linha.quantidade)
  produto.tamanhos.set(separado.tamanho, (produto.tamanhos.get(separado.tamanho) || 0) + linha.quantidade)
  produto.total += linha.quantidade
  if (card?.id) produto.pedidos.add(card.id)
}

function listarProdutos(grupo) {
  return [...grupo.entries()]
    .map(([, produto]) => {
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
      return {
        nome,
        total: produto.total,
        pedidos: produto.pedidos.size,
        tamanhos,
      }
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Peças usadas no período, por produto e tamanho. Cancelados e expirados ficam à parte. Teste fica de fora. */
export function resumirPecasFinanceiro(cards, inicio, fim) {
  const de = String(inicio || '')
  const ate = String(fim || '')
  const usados = new Map()
  const fora = new Map()
  const pedidosUsados = new Set()
  const pedidosFora = new Set()

  for (const card of cards || []) {
    const classe = classePedido(card)
    if (classe === 'ignorar') continue
    const data = dataReferenciaPedido(card)
    if (!data || (de && data < de) || (ate && data > ate)) continue
    const linhas = linhasDoCard(card)
    if (!linhas.length) continue
    const destino = classe === 'fora' ? fora : usados
    const pedidos = classe === 'fora' ? pedidosFora : pedidosUsados
    if (card?.id) pedidos.add(card.id)
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
