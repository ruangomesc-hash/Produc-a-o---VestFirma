import { WhatsAppRedirectPanel } from './WhatsAppRedirectPanel'

type Props = {
  open: boolean
  onClose: () => void
}

export function WhatsAppRedirectModal({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div
      className="modal-backdrop modal-backdrop-pedido"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal modal-pedido wa-redirect-modal"
        role="dialog"
        aria-labelledby="wa-redirect-title"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="wa-redirect-title">Redirect WhatsApp</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="wa-redirect-body">
          <WhatsAppRedirectPanel layout="modal" onClose={onClose} />
        </div>
      </div>
    </div>
  )
}
