import { useState } from 'react'
import {
  getWhatsappNotifyMode,
  setWhatsappNotifyEnabled,
  setWhatsappNotifyMode,
  whatsappNotifyEnabled,
  type WhatsAppNotifyMode,
} from '../whatsappNotify'

type Props = {
  open: boolean
  onClose: () => void
}

export function WhatsAppNotifyModal({ open, onClose }: Props) {
  const [enabled, setEnabled] = useState(() => whatsappNotifyEnabled())
  const [mode, setMode] = useState<WhatsAppNotifyMode>(() => getWhatsappNotifyMode())

  if (!open) return null

  const save = () => {
    setWhatsappNotifyEnabled(enabled)
    setWhatsappNotifyMode(mode)
    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal modal-narrow"
        role="dialog"
        aria-labelledby="wa-notify-title"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="wa-notify-title">Avisos no grupo WhatsApp</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="vendedores-body wa-notify-body">
          <p className="vendedores-hint">
            Cada vendedor tem o <strong>próprio grupo</strong> (cadastro em <strong>Vendedores</strong>{' '}
            → ID do grupo). Ao criar ou mover pedido, o aviso vai no JSON com{' '}
            <code>grupoWhatsapp</code> e <code>vendedorId</code> para o n8n/Evolution enviar no grupo
            certo.
          </p>

          <label className="wa-notify-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Ativar avisos no WhatsApp</span>
          </label>

          <fieldset className="wa-notify-fieldset">
            <legend>Como enviar</legend>
            <label className="wa-notify-radio">
              <input
                type="radio"
                name="wa-mode"
                checked={mode === 'webhook'}
                onChange={() => setMode('webhook')}
              />
              <span>
                <strong>Automático (webhook)</strong> — recomendado para grupo. No servidor Node,
                defina <code>WHATSAPP_WEBHOOK_URL</code> no <code>.env</code> apontando para n8n ou
                WhatsApp Business API.
              </span>
            </label>
            <label className="wa-notify-radio">
              <input
                type="radio"
                name="wa-mode"
                checked={mode === 'abrir'}
                onChange={() => setMode('abrir')}
              />
              <span>
                <strong>Abrir WhatsApp</strong> — abre a mensagem pronta; você escolhe o grupo e
                envia (útil para testar).
              </span>
            </label>
          </fieldset>

          <p className="vendedores-hint wa-notify-mention">
            Cadastre o <strong>ID do grupo</strong> de cada vendedor (Evolution: termina em{' '}
            <code>@g.us</code>). No n8n, use o campo <code>grupoWhatsapp</code> do webhook como
            destino da mensagem. O WhatsApp pessoal do vendedor serve para{' '}
            <strong>marcar</strong> (<code>mentionPhones</code>).
          </p>

          <div className="wa-notify-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn primary" onClick={save}>
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
