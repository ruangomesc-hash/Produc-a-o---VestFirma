import { useEffect, useState } from 'react'
import { AlertModal } from './AlertModal'

type VendedorRow = {
  id: string
  nome: string
  email?: string
  userId?: string
  whatsapp?: string
  grupoWhatsapp?: string
}

type Props = {
  open: boolean
  vendedores: VendedorRow[]
  onClose: () => void
  onUpdateContato: (
    id: string,
    patch: { whatsapp?: string; grupoWhatsapp?: string },
  ) => void
  onRemove: (id: string) => void
  onOpenUsuarios?: () => void
  canManageUsers?: boolean
}

export function VendedoresModal({
  open,
  vendedores,
  onClose,
  onUpdateContato,
  onRemove,
  onOpenUsuarios,
  canManageUsers = false,
}: Props) {
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  if (!open && !alertMessage) return null

  return (
    <>
      {open ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <div
            className="modal modal-narrow modal-pedido"
            role="dialog"
            aria-labelledby="vendedores-title"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <h2 id="vendedores-title">Vendedores</h2>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
                ×
              </button>
            </header>

            <div className="vendedores-body">
              <p className="vendedores-hint">
                Lista do quadro para lançar e filtrar pedidos. Novos vendedores são criados em{' '}
                <strong>Usuários</strong> (perfil Vendedor) — entram aqui automaticamente. Nesta tela
                você ajusta <strong>WhatsApp</strong> e <strong>ID do grupo</strong> (termina em{' '}
                <code>@g.us</code> — não use link <code>chat.whatsapp.com/…</code>).
              </p>

              {canManageUsers && onOpenUsuarios ? (
                <div className="vendedores-usuarios-cta">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      onClose()
                      onOpenUsuarios()
                    }}
                  >
                    Cadastrar novo vendedor
                  </button>
                </div>
              ) : null}

              {vendedores.length === 0 ? (
                <p className="vendedores-empty">
                  Nenhum vendedor no quadro. Cadastre em Usuários com perfil Vendedor — a lista
                  atualiza sozinha.
                </p>
              ) : (
                <ul className="vendedores-list">
                  {vendedores.map((v) => (
                    <VendedorContatoEditor
                      key={v.id}
                      vendedor={v}
                      onSave={onUpdateContato}
                      onRemove={onRemove}
                      onAlert={setAlertMessage}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <AlertModal
        open={!!alertMessage}
        title="Vendedores"
        message={alertMessage ?? ''}
        onClose={() => setAlertMessage(null)}
      />
    </>
  )
}

function VendedorContatoEditor({
  vendedor,
  onSave,
  onRemove,
  onAlert,
}: {
  vendedor: VendedorRow
  onSave: Props['onUpdateContato']
  onRemove: Props['onRemove']
  onAlert: (msg: string) => void
}) {
  const [whatsapp, setWhatsapp] = useState(vendedor.whatsapp ?? '')
  const [grupoWhatsapp, setGrupoWhatsapp] = useState(vendedor.grupoWhatsapp ?? '')
  const [savedHint, setSavedHint] = useState(false)
  const linked = Boolean(vendedor.userId)

  useEffect(() => {
    setWhatsapp(vendedor.whatsapp ?? '')
    setGrupoWhatsapp(vendedor.grupoWhatsapp ?? '')
  }, [vendedor.id, vendedor.whatsapp, vendedor.grupoWhatsapp])

  const savedWhatsapp = (vendedor.whatsapp ?? '').trim()
  const savedGrupo = (vendedor.grupoWhatsapp ?? '').trim()
  const dirty =
    whatsapp.trim() !== savedWhatsapp || grupoWhatsapp.trim() !== savedGrupo

  const handleSave = () => {
    onSave(vendedor.id, { whatsapp, grupoWhatsapp })
    setSavedHint(true)
    window.setTimeout(() => setSavedHint(false), 2200)
  }

  useEffect(() => {
    if (dirty) setSavedHint(false)
  }, [dirty])

  return (
    <li className="vendedores-list-item">
      <div className="vendedor-row-main">
        <div className="vendedor-nome-block">
          <span className="vendedor-nome">{vendedor.nome}</span>
          {vendedor.email ? (
            <code className="vendedor-email-tag">{vendedor.email}</code>
          ) : null}
        </div>
        <label className="vendedor-wa-edit">
          <span className="vendedor-field-label">WhatsApp</span>
          <input
            type="tel"
            inputMode="tel"
            placeholder="Número para marcar"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </label>
        <label className="vendedor-wa-edit">
          <span className="vendedor-field-label">Grupo WhatsApp (ID)</span>
          <input
            type="text"
            placeholder="120363…@g.us"
            value={grupoWhatsapp}
            onChange={(e) => setGrupoWhatsapp(e.target.value)}
          />
        </label>
      </div>
      <div className="vendedor-row-actions">
        <button
          type="button"
          className="btn primary btn-sm"
          disabled={!dirty}
          onClick={handleSave}
        >
          Salvar
        </button>
        {savedHint ? (
          <span className="vendedor-saved-hint" aria-live="polite">
            Salvo
          </span>
        ) : null}
        {!linked ? (
          <button
            type="button"
            className="link-btn danger"
            onClick={() => {
              if (confirm('Excluir ' + vendedor.nome + '? Pedidos ficam sem vendedor.')) {
                onRemove(vendedor.id)
              }
            }}
          >
            Excluir
          </button>
        ) : (
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              onAlert('Para remover o login, exclua o usuário em Usuários (perfil Vendedor).')
            }
          >
            Remover login
          </button>
        )}
      </div>
    </li>
  )
}
