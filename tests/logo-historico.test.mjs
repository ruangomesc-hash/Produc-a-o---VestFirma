import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { anexarHistoricoLogo, textoMudancaLogo } from '../shared/logoHistorico.mjs'

describe('histórico da logo', () => {
  it('diz quem trocou, removeu ou adicionou a logo', () => {
    assert.equal(
      textoMudancaLogo(
        { logoEnviadaCliente: ['/api/images/antiga'] },
        { logoEnviadaCliente: ['/api/images/nova'] },
      ),
      'Trocou a logo enviada pelo cliente',
    )
    assert.equal(
      textoMudancaLogo(
        { logoEnviadaCliente: ['/api/images/antiga', '/api/images/nova'] },
        { logoEnviadaCliente: [] },
      ),
      'Removeu a logo enviada pelo cliente',
    )
    assert.equal(
      textoMudancaLogo(
        { previewAprovacaoCliente: [] },
        { previewAprovacaoCliente: ['/api/images/ok'] },
      ),
      'Adicionou o preview aprovado pelo cliente',
    )
  })

  it('grava uma linha no histórico sem mudar a etapa e sem duplicar', () => {
    const antes = {
      id: 'p1',
      columnId: 'logos-recebidas',
      etapaDesde: '2026-10-11T21:00:00.000Z',
      logoEnviadaCliente: ['/api/images/antiga'],
      historicoEtapa: [{ id: 'criado', tipo: 'criado', columnId: 'pedido-feito', at: '2026-10-11T18:00:00.000Z' }],
    }
    const depois = {
      ...antes,
      logoEnviadaCliente: [],
      midiaAtualizadaEm: '2026-10-13T18:40:00.000Z',
    }
    const comLinha = anexarHistoricoLogo(antes, depois, { autorNome: 'Ana', autorRole: 'admin' })
    assert.equal(comLinha.etapaDesde, antes.etapaDesde)
    assert.equal(comLinha.columnId, 'logos-recebidas')
    assert.equal(comLinha.historicoEtapa.length, 2)
    assert.equal(comLinha.historicoEtapa[1].tipo, 'logo')
    assert.equal(comLinha.historicoEtapa[1].detalhe, 'Removeu a logo enviada pelo cliente')
    assert.equal(comLinha.historicoEtapa[1].autorNome, 'Ana')
    assert.equal(comLinha.historicoEtapa[1].at, '2026-10-13T18:40:00.000Z')
    const deNovo = anexarHistoricoLogo(antes, comLinha, { autorNome: 'Ana' })
    assert.equal(deNovo.historicoEtapa.length, 2)
  })
})
