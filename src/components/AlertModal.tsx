import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  onClose: () => void
}

export function AlertModal({
  open,
  title = 'Atenção',
  message,
  confirmLabel = 'Entendi',
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="modal-backdrop confirm-backdrop alert-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="confirm-modal alert-modal"
        role="alertdialog"
        aria-labelledby="alert-title"
        aria-describedby="alert-message"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="confirm-modal-brand">
          <img
            src={`${import.meta.env.BASE_URL}vestfirma-logo.png`}
            alt="VestFirma"
            className="confirm-modal-logo"
          />
        </header>
        <div className="confirm-modal-body">
          <h2 id="alert-title" className="confirm-modal-title">
            {title}
          </h2>
          <p id="alert-message" className="confirm-message">
            {message}
          </p>
          <div className="alert-modal-actions">
            <button type="button" className="btn primary" onClick={onClose} autoFocus>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
