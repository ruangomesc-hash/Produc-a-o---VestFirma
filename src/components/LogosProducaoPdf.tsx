import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { contarLogosDoPedido, dataPedidoImpressao, nomeArquivoPdfPedido, resumoPecasPdf } from '../logosProducao'
import { linhasResumoDoPedido, quantidadeExibidaComResumo } from '../pedidoResumo'
import type { OrderCard } from '../types'

function urlAbsoluta(src: string, download = false) {
  if (!src || src.startsWith('data:')) return src
  try {
    const url = new URL(src, window.location.origin)
    if (download && /\/api\/images\/[a-f0-9]{64}\./.test(url.pathname)) url.searchParams.set('download', '1')
    return url.href
  } catch {
    return src
  }
}

function QuadroImagem({ src, alt, vazio }: { src: string; alt: string; vazio: ReactNode }) {
  const [falhou, setFalhou] = useState(false)
  const visivel = Boolean(src) && !falhou
  return (
    <>
      {visivel ? <img src={src} alt={alt} onError={() => setFalhou(true)} /> : null}
      <span className="logos-pdf-vazio">{vazio}</span>
    </>
  )
}

function FichaPedido({ card, comResumo = false }: { card: OrderCard; comResumo?: boolean }) {
  const pecas = quantidadeExibidaComResumo(card)
  const contagem = contarLogosDoPedido(card.localLogo, pecas)
  const pecasResumo = comResumo ? resumoPecasPdf(linhasResumoDoPedido(card)) : []
  const previews = (card.previewAprovacaoCliente ?? []).map((src) => src.trim()).filter(Boolean)
  const artes = (card.logoProntaImpressao ?? []).map((src) => src.trim()).filter(Boolean)
  const observacao = card.observacao?.trim() ?? ''
  const data = dataPedidoImpressao(card.dataPedido)
  const numero = card.numeroPedido?.trim().replace(/^#/, '') || 's/n'

  return (
    <div className="logos-pdf-folha">
      <header className="logos-pdf-cabecalho">
        <div className="logos-pdf-marca">
          <strong>VESTFIRMA</strong>
          <span>UNIFORMES PERSONALIZADOS</span>
        </div>
        <div className="logos-pdf-documento">
          {comResumo ? (
            <>
              FICHA DE<strong className="logos-pdf-documento-longo">APLICAÇÃO E ESTAMPARIA</strong>
            </>
          ) : (
            <>
              FICHA DE<strong>IMPRESSÃO</strong>
            </>
          )}
        </div>
      </header>
      <main className="logos-pdf-main">
        <p className="logos-pdf-rotulo">RESUMO DO PEDIDO</p>
        <div className="logos-pdf-dados">
          <div className="logos-pdf-dado">
            <label>PEDIDO</label>
            <span className="logos-pdf-valor">#{numero}</span>
            <span className="logos-pdf-pecas">Quantidade de peças: {pecas}</span>
          </div>
          <div className="logos-pdf-dado">
            <label>DATA DO PEDIDO</label>
            <span className="logos-pdf-valor">{data || '—'}</span>
          </div>
        </div>
        <div className="logos-pdf-quantidades">
          <div className="logos-pdf-quantidade">
            <h2>LOGOS PEQUENAS</h2>
            <span className="logos-pdf-numero">{contagem.pequenas}</span>
            <small>unidades para impressão</small>
          </div>
          <div className="logos-pdf-quantidade">
            <h2>LOGOS GRANDES</h2>
            <span className="logos-pdf-numero">{contagem.grandes}</span>
            <small>unidades para impressão</small>
          </div>
        </div>
        <section className="logos-pdf-secao">
          <h2>PREVIEW APROVADO</h2>
          <p className="logos-pdf-descricao">Referência visual aprovada pelo cliente.</p>
          {(previews.length ? previews : ['']).map((src, index) => (
            <div className="logos-pdf-preview" key={`preview-${index}`}>
              <QuadroImagem
                src={urlAbsoluta(src)}
                alt="Preview aprovado pelo cliente"
                vazio={<><strong>PREVIEW APROVADO</strong><small>Imagem ainda não vinculada</small></>}
              />
            </div>
          ))}
        </section>
        {comResumo ? (
          <table className="logos-pdf-pecas-tabela">
            <thead>
              <tr>
                <th>Peça</th>
                <th>Tamanho</th>
                <th>Qtd</th>
              </tr>
            </thead>
            <tbody>
              {pecasResumo.length === 0 ? (
                <tr>
                  <td colSpan={3}>Sem peças informadas.</td>
                </tr>
              ) : (
                pecasResumo.map((linha, index) => (
                  <tr key={`${linha.peca}-${linha.tamanho}-${index}`}>
                    <td>
                      {linha.peca}
                      {linha.extra ? <small className="logos-pdf-pecas-extra">{linha.extra}</small> : null}
                    </td>
                    <td>{linha.tamanho}</td>
                    <td>{linha.quantidade}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : null}
        <section className="logos-pdf-secao">
          <h2>ARTE PARA IMPRESSÃO</h2>
          {(artes.length ? artes : ['']).map((src, index) => {
            const download = src ? urlAbsoluta(src, true) : ''
            const miniatura = (
              <QuadroImagem
                src={urlAbsoluta(src)}
                alt="Arte do pedido"
                vazio={<>ARTE<br />DO PEDIDO</>}
              />
            )
            return (
              <div className="logos-pdf-arquivo" key={`arte-${index}`}>
                <div className="logos-pdf-miniatura">
                  {download ? (
                    <a href={download} download aria-label="Baixar arte para impressão">{miniatura}</a>
                  ) : (
                    <div className="logos-pdf-miniatura-vazia">{miniatura}</div>
                  )}
                </div>
                <div className="logos-pdf-acao">
                  <strong>Arquivo de impressão</strong>
                  {download ? (
                    <a className="logos-pdf-botao" href={download} download>CLIQUE AQUI PARA BAIXAR</a>
                  ) : (
                    <span className="logos-pdf-botao logos-pdf-botao--vazio">ARQUIVO NÃO VINCULADO</span>
                  )}
                  <small>Clique no botão ou na imagem da arte.</small>
                </div>
              </div>
            )
          })}
        </section>
        <section className="logos-pdf-observacoes">
          <h2>OBSERVAÇÕES DE PRODUÇÃO</h2>
          <p className={observacao ? undefined : 'logos-pdf-observacao-vazia'}>
            {observacao || 'Sem observações informadas.'}
          </p>
        </section>
      </main>
      <footer className="logos-pdf-rodape"><strong>VESTFIRMA / PRODUÇÃO</strong></footer>
    </div>
  )
}

export function LogosProducaoPdf({
  cards,
  comResumo = false,
  onClose,
}: {
  cards: OrderCard[]
  comResumo?: boolean
  onClose: () => void
}) {
  const varios = cards.length > 1
  const [indice, setIndice] = useState(0)
  const atual = varios ? cards[Math.min(indice, cards.length - 1)] : null
  const visiveis = atual ? [atual] : cards
  const chave = visiveis.map((card) => card.id).join(',')
  const fechar = useRef(onClose)
  fechar.current = onClose

  useEffect(() => {
    const tituloAntes = document.title
    document.title = nomeArquivoPdfPedido(visiveis[0]?.numeroPedido)
    let cancelado = false
    let jaImprimiu = false
    let seguiu = false
    const imprimir = () => {
      if (cancelado || jaImprimiu) return
      jaImprimiu = true
      window.print()
    }
    const root = document.getElementById('logos-pdf-print')
    const imgs = [...(root?.querySelectorAll('img') ?? [])]
    const pendentes = imgs.filter((img) => !img.complete)
    const aoCarregar = () => {
      if (pendentes.every((img) => img.complete)) imprimir()
    }
    pendentes.forEach((img) => {
      img.addEventListener('load', aoCarregar)
      img.addEventListener('error', aoCarregar)
    })
    const quadro = pendentes.length === 0 ? requestAnimationFrame(imprimir) : 0
    const limite = window.setTimeout(imprimir, 2500)
    const fim = () => {
      if (cancelado || seguiu) return
      seguiu = true
      if (varios && indice < cards.length - 1) {
        setIndice((valor) => valor + 1)
        return
      }
      fechar.current()
    }
    window.addEventListener('afterprint', fim)
    return () => {
      cancelado = true
      if (quadro) cancelAnimationFrame(quadro)
      window.clearTimeout(limite)
      pendentes.forEach((img) => {
        img.removeEventListener('load', aoCarregar)
        img.removeEventListener('error', aoCarregar)
      })
      window.removeEventListener('afterprint', fim)
      document.title = tituloAntes
    }
  }, [chave, cards.length, indice, varios])

  return createPortal(
    <>
      {varios ? (
        <p className="logos-pdf-fila" role="status">
          PDF {indice + 1} de {cards.length}. Salve este arquivo. O próximo abre em seguida.
        </p>
      ) : null}
      <div className="separacao-print logos-pdf-print" id="logos-pdf-print" aria-hidden="true">
        {visiveis.map((card) => (
          <FichaPedido key={card.id} card={card} comResumo={comResumo} />
        ))}
      </div>
    </>,
    document.body,
  )
}
