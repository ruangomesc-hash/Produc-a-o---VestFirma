import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { baixarZip, nomesArquivoUnicos, pdfDaFolha } from '../baixarFichasPdf'
import { contarLogosDoPedido, dataPedidoImpressao, nomeArquivoPdfPedido, nomeArquivoZipPedidos, resumoPecasPdf } from '../logosProducao'
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
    <div className="logos-pdf-folha" data-arquivo={`${nomeArquivoPdfPedido(card.numeroPedido)}.pdf`}>
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
  const [status, setStatus] = useState('')
  const chave = cards.map((card) => card.id).join(',')
  const fechar = useRef(onClose)
  fechar.current = onClose

  useEffect(() => {
    if (varios) return
    const tituloAntes = document.title
    document.title = nomeArquivoPdfPedido(cards[0]?.numeroPedido)
    let cancelado = false
    let jaImprimiu = false
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
    const fim = () => fechar.current()
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
  }, [cards, chave, varios])

  useEffect(() => {
    if (!varios) return
    let cancelado = false
    const baixar = async () => {
      setStatus(`Preparando ${cards.length} PDFs para o arquivo…`)
      const root = document.getElementById('logos-pdf-print')
      const imgs = [...(root?.querySelectorAll('img') ?? [])]
      await Promise.race([
        Promise.all(
          imgs.map(
            (img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.addEventListener('load', () => resolve(), { once: true })
                    img.addEventListener('error', () => resolve(), { once: true })
                  }),
          ),
        ),
        new Promise((resolve) => window.setTimeout(resolve, 2500)),
      ])
      if (cancelado || !root) return
      const folhas = [...root.querySelectorAll<HTMLElement>('.logos-pdf-folha')]
      const prontos: { nome: string; blob: Blob }[] = []
      for (let i = 0; i < folhas.length; i += 1) {
        if (cancelado) return
        setStatus(`Preparando PDF ${i + 1} de ${folhas.length}…`)
        const folha = folhas[i]
        try {
          const blob = await pdfDaFolha(folha)
          prontos.push({
            nome: folha.dataset.arquivo || `pedido ${i + 1} - vestfirma.pdf`,
            blob,
          })
        } catch {
          /* uma ficha que falhar não segura as outras */
        }
      }
      if (cancelado || prontos.length === 0) {
        fechar.current()
        return
      }
      const nomes = nomesArquivoUnicos(prontos.map((item) => item.nome))
      setStatus('Baixando o arquivo com os PDFs…')
      await baixarZip(
        nomeArquivoZipPedidos(cards.map((card) => card.numeroPedido)),
        prontos.map((item, index) => ({ nome: nomes[index], blob: item.blob })),
      )
      if (!cancelado) fechar.current()
    }
    void baixar()
    return () => {
      cancelado = true
    }
  }, [cards.length, chave, varios])

  return createPortal(
    <>
      {varios ? (
        <p className="logos-pdf-fila" role="status">
          {status || `Preparando ${cards.length} PDFs para o arquivo…`}
        </p>
      ) : null}
      <div
        className={`separacao-print logos-pdf-print${varios ? ' logos-pdf-print--baixar' : ''}`}
        id="logos-pdf-print"
        aria-hidden="true"
      >
        {cards.map((card) => (
          <FichaPedido key={card.id} card={card} comResumo={comResumo} />
        ))}
      </div>
    </>,
    document.body,
  )
}
