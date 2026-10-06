import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MENSAGEM_LOGO,
  garantirMensagemLogo,
  marcarMensagemLogo,
  preencherMensagemWhatsApp,
  templateEhMensagemLogo,
} from '../shared/whatsappLogoMensagem.mjs'
import { garantirMensagensWppAtraso, mensagemWppDaEtapa } from '../shared/whatsappWppAtraso.mjs'

describe('mensagem Logo no WhatsApp', () => {
  it('preenche cliente e número do pedido', () => {
    const texto = preencherMensagemWhatsApp(DEFAULT_MENSAGEM_LOGO, {
      cliente: 'Beatriz Novaes',
      numeroPedido: '1049',
      quantidade: 2,
    })
    assert.match(texto, /Beatriz Novaes/)
    assert.match(texto, /1049/)
    assert.equal(texto.includes('{cliente}'), false)
  })

  it('garante uma mensagem marcada como Logo', () => {
    const out = garantirMensagemLogo([{ id: 'a', nome: 'Padrão 1', texto: 'oi' }])
    assert.equal(out.some((t) => templateEhMensagemLogo(t)), true)
    assert.equal(out.find((t) => templateEhMensagemLogo(t)).nome, 'Logo')
  })

  it('troca qual mensagem é o selo Logo', () => {
    const list = garantirMensagemLogo([
      { id: 'a', nome: 'Padrão 1', texto: 'oi' },
      { id: 'b', nome: 'Outra', texto: 'logo custom' },
    ])
    const marked = marcarMensagemLogo(list, 'b')
    assert.equal(templateEhMensagemLogo(marked.find((t) => t.id === 'b')), true)
    assert.equal(templateEhMensagemLogo(marked.find((t) => t.id === 'a')), false)
    assert.equal(marked.filter((t) => t.uso === 'logo').length, 1)
  })
})

describe('mensagem WPP no atraso', () => {
  it('preenche a etapa no texto', () => {
    const texto = preencherMensagemWhatsApp(
      'Pedido {pedido} atrasou em {etapa}.',
      { cliente: 'Ana', numeroPedido: '1037', etapa: 'Logos em produção' },
    )
    assert.equal(texto, 'Pedido 1037 atrasou em Logos em produção.')
  })

  it('cria uma mensagem WPP por etapa com prazo', () => {
    const out = garantirMensagensWppAtraso([])
    const logos = mensagemWppDaEtapa(out, 'logos-producao')
    const aplicacao = mensagemWppDaEtapa(out, 'em-aplicacao')
    assert.ok(logos?.texto.includes('Logos em produção'))
    assert.ok(aplicacao?.texto.includes('em aplicação'))
    assert.notEqual(logos.id, aplicacao.id)
  })
})
