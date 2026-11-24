import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { contarLogosDoPedido } from '../logosProducao'
import { linhasResumoDoPedido } from '../pedidoResumo'
import type { OrderCard } from '../types'

function hrefDownload(src: string) {
  try {
    const url = new URL(src, window.location.origin)
    if (/\/api\/images\/[a-f0-9]{64}\./.test(url.pathname)) url.searchParams.set('download', '1')
    return url.href
  } catch {
    return src
  }
}

export function LogosProducaoPdf({ card, onClose }: { card: OrderCard; onClose: () => void }) {
  const contagem = contarLogosDoPedido(linhasResumoDoPedido(card))
  const logos = (card.logoProntaImpressao ?? []).filter(Boolean)

  const fechar = useRef(onClose)
  fechar.current = onClose

  useEffect(() => {
    const quadro = requestAnimationFrame(() => window.print())
    const fim = () => fechar.current()
    window.addEventListener('afterprint', fim)
    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('afterprint', fim)
    }
  }, [card.id])

  const folha = (
    <div className="separacao-print logos-pdf-print" id="logos-pdf-print" aria-hidden="true">
      <section className="logos-pdf-folha">
        <h1>Pedido #{card.numeroPedido || 's/n'}</h1>
        <p>Logos pequenas: {contagem.pequenas}</p>
        <p>Logos grandes: {contagem.grandes}</p>
        <h2>Logo pronta para impressão</h2>
        {logos.length ? (
          logos.map((src, index) => {
            const href = hrefDownload(src)
            return (
              <p key={`${src.slice(0, 80)}-${index}`} className="logos-pdf-item">
                <a href={href}>
                  <img src={src} alt={`Logo pronta para impressão ${index + 1}`} />
                </a>
                <a href={href}>Baixar logo para imprimir</a>
              </p>
            )
          })
        ) : (
          <p>Sem logo pronta para impressão.</p>
        )}
      </section>
    </div>
  )

  return createPortal(folha, document.body)
}
