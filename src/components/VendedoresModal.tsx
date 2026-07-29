import { useCallback, useEffect, useState } from 'react'
import { fetchUsers } from '../usersApi'
import type { ManagedUser } from '../userRoles'
import type { VendedorContatoPatch } from '../vendedorUserSync'
import { AlertModal } from './AlertModal'
import { NovoUsuarioForm } from './NovoUsuarioForm'

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
  canManageUsers?: boolean
  onUserCreated?: (user: ManagedUser, contato?: VendedorContatoPatch) => void
  onUsersLoaded?: (users: ManagedUser[]) => void
}

export function VendedoresModal({
  open,
  vendedores,
  onClose,
  onUpdateContato,
  onRemove,
  canManageUsers = false,
  onUserCreated,
  onUsersLoaded,
}: Props) {
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reloadUsers = useCallback(async () => {
    if (!canManageUsers || !onUsersLoaded) return
    try {
      const list = await fetchUsers()
      onUsersLoaded(list)
    } catch {
      /* lista do quadro ainda funciona */
    }
  }, [canManageUsers, onUsersLoaded])

  useEffect(() => {
    if (!open) return
    void reloadUsers()
  }, [open, reloadUsers])

  const handleCreated = (user: ManagedUser, contato?: VendedorContatoPatch) => {
    onUserCreated?.(user, contato)
    void reloadUsers()
  }

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
            className="modal modal-wide modal-pedido usuarios-modal"
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

            <div className="usuarios-body">
              <p className="usuarios-hint">
                Cadastro completo do vendedor: <strong>e-mail</strong>, <strong>senha</strong>, nome no
                quadro, <strong>WhatsApp</strong> e <strong>grupo</strong>. Cada pedido fica atrelado à
                pessoa certa. Quem já tem login aparece na lista para ajustar contatos.
              </p>

              {canManageUsers && onUserCreated ? (
                <NovoUsuarioForm
                  mode="vendedor-only"
                  onCreated={handleCreated}
                  onError={setError}
                  onSuccessAlert={setAlertMessage}
                />
              ) : null}

              {error ? <p className="usuarios-error">{error}</p> : null}

              {vendedores.length === 0 ? (
                <p className="usuarios-loading">
                  {canManageUsers
                    ? 'Nenhum vendedor no quadro — use o formulário acima.'
                    : 'Nenhum vendedor no quadro.'}
                </p>
              ) : (
                <div className="usuarios-table-wrap">
                  <table className="usuarios-table vendedores-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>WhatsApp</th>
                        <th>Grupo (ID)</th>
                        <th aria-label="Ações" />
                      </tr>
                    </thead>
                    <tbody>
                      {vendedores.map((v) => (
                        <VendedorTableRow
                          key={v.id}
                          vendedor={v}
                          onSave={onUpdateContato}
                          onRemove={onRemove}
                          onAlert={setAlertMessage}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
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

function VendedorTableRow({
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
  const dirty = whatsapp.trim() !== savedWhatsapp || grupoWhatsapp.trim() !== savedGrupo

  const handleSave = () => {
    onSave(vendedor.id, { whatsapp, grupoWhatsapp })
    setSavedHint(true)
    window.setTimeout(() => setSavedHint(false), 2200)
  }

  useEffect(() => {
    if (dirty) setSavedHint(false)
  }, [dirty])

  return (
    <tr>
      <td>{vendedor.nome}</td>
      <td>
        {vendedor.email ? (
          <code className="usuarios-email">{vendedor.email}</code>
        ) : (
          <span className="usuarios-muted">—</span>
        )}
      </td>
      <td>
        <input
          className="usuarios-table-input"
          type="tel"
          inputMode="tel"
          placeholder="Número"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
        />
      </td>
      <td>
        <input
          className="usuarios-table-input"
          type="text"
          placeholder="120363…@g.us"
          value={grupoWhatsapp}
          onChange={(e) => setGrupoWhatsapp(e.target.value)}
        />
      </td>
      <td className="usuarios-actions vendedores-row-actions">
        <button
          type="button"
          className="btn primary btn-xs"
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
            className="btn ghost btn-xs danger-text"
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
            className="btn ghost btn-xs"
            onClick={() =>
              onAlert('Para remover o login, exclua o usuário em Usuários (mesmo e-mail).')
            }
          >
            Remover login
          </button>
        )}
      </td>
    </tr>
  )
}
