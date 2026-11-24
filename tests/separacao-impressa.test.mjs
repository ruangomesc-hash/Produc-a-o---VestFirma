import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeOrderCardFields } from '../shared/mergeOrderCard.mjs'
import { resumirPecasSeparacao, textoListaSeparacao, textoOndaSeparacao } from '../shared/separacaoLista.mjs'

function card(extra = {}) {
  return {
    id: 'p1',
    columnId: 'disponiveis-aplicacao',
    comentarios: [],
    historicoEtapa: [],
    logoEnviadaCliente: [],
    logoProntaImpressao: [],
    previewAprovacaoCliente: [],
    observacao: '',
    itensProduto: [],
    linhasPedido: [],
    etapaDesde: '2026-11-01T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    ...extra,
  }
}

test('a folha impressa mais nova permanece e a antiga não apaga a marca', () => {
  const antiga = '2026-11-20T12:00:00.000Z'
  const nova = '2026-11-24T15:00:00.000Z'
  const uniao = mergeOrderCardFields(
    card({ separacaoImpressaEm: antiga }),
    card({ separacaoImpressaEm: nova, cliente: 'Time' }),
  )
  assert.equal(uniao.separacaoImpressaEm, nova)
  assert.equal(uniao.cliente, 'Time')

  const semData = mergeOrderCardFields(card({ separacaoImpressaEm: antiga }), card())
  assert.equal(semData.separacaoImpressaEm, antiga)

  const pdf = mergeOrderCardFields(card({ pdfProducaoImpressoEm: antiga }), card())
  assert.equal(pdf.pdfProducaoImpressoEm, antiga)
  const pdfNovo = mergeOrderCardFields(
    card({ pdfProducaoImpressoEm: antiga }),
    card({ pdfProducaoImpressoEm: nova }),
  )
  assert.equal(pdfNovo.pdfProducaoImpressoEm, nova)
})

test('o resumo junta peças iguais para o WhatsApp', () => {
  const texto = textoListaSeparacao({
    quando: '24/11/2026 16:50',
    etapa: 'Disponíveis para aplicação',
    pedidos: [
      {
        numero: '10',
        cliente: 'Escola A',
        linhas: [
          { titulo: 'Camiseta', quantidade: 2, detalhe: 'M' },
          { titulo: 'Camiseta', quantidade: 1, detalhe: 'P' },
        ],
        observacao: 'Sem manga',
      },
      {
        numero: '11',
        cliente: 'Escola B',
        linhas: [{ titulo: 'Camiseta', quantidade: 3, detalhe: 'M' }],
      },
    ],
  })
  const pecas = resumirPecasSeparacao([
    { numero: '10', cliente: 'A', linhas: [{ titulo: 'Camiseta', quantidade: 2, detalhe: 'M' }] },
    { numero: '11', cliente: 'B', linhas: [{ titulo: 'Camiseta', quantidade: 3, detalhe: 'M' }] },
  ])
  assert.equal(pecas[0].quantidade, 5)
  assert.match(texto, /5× Camiseta \(M\)/)
  assert.match(texto, /\*#10\* — Escola A/)
  assert.match(texto, /Obs: Sem manga/)
  assert.match(texto, /Disponíveis para aplicação/)
})

test('separação em ondas soma o mesmo produto e não repete o pedido', () => {
  const texto = textoOndaSeparacao({
    quando: '24/11/2026 17:10',
    etapa: 'Logos prontas',
    pedidos: [
      { numero: '10', cliente: 'A', linhas: [{ titulo: 'Corta-vento', quantidade: 2, detalhe: 'G' }] },
      { numero: '11', cliente: 'B', linhas: [{ titulo: 'Corta-vento', quantidade: 2, detalhe: 'G' }] },
      { numero: '12', cliente: 'C', linhas: [{ titulo: 'corta-vento', quantidade: 16, detalhe: 'g' }] },
    ],
  })
  assert.match(texto, /Separação em ondas/)
  assert.match(texto, /20× Corta-vento \(G\)/)
  assert.doesNotMatch(texto, /#10/)
  assert.match(texto, /Logos prontas/)
})
