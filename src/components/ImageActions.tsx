import { useState } from 'react'
import { createPortal } from 'react-dom'

export function ImageActions({ src, label }: { src: string; label: string }) {
  const [expanded, setExpanded] = useState(false)
  const downloadUrl = /\/api\/images\/[a-f0-9]{64}\./.test(src)
    ? `${src}${src.includes('?') ? '&' : '?'}download=1`
    : src
  return (
    <>
      <div className="image-actions">
        <button type="button" className="btn-text" onClick={() => setExpanded(true)} aria-label={`Ampliar ${label.toLowerCase()}`}>Ampliar</button>
        <a className="btn-text" href={downloadUrl} download aria-label={`Baixar ${label.toLowerCase()}`}>Baixar imagem</a>
      </div>
      {expanded && createPortal(
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={label} onClick={() => setExpanded(false)} onKeyDown={(e) => { if (e.key === 'Escape') setExpanded(false) }}>
          <button type="button" className="btn secondary" autoFocus onClick={() => setExpanded(false)}>Fechar imagem</button>
          <img src={src} alt={label} onClick={(e) => e.stopPropagation()} />
        </div>, document.body,
      )}
    </>
  )
}
