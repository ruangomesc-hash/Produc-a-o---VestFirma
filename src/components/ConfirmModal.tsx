type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null

  return (
    <div
      className="modal-backdrop confirm-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="confirm-modal"
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
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
          <h2 id="confirm-title" className="confirm-modal-title">
            {title}
          </h2>
          <p id="confirm-message" className="confirm-message">
            {message}
          </p>
          <div className="confirm-actions">
            <button type="button" className="btn confirm-cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className="btn primary" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
