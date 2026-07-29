import { useCallback, useEffect, useState } from 'react'
import type { ManagedUser } from '../userRoles'
import type { VendedorContatoPatch } from '../vendedorUserSync'
import { USER_ROLE_LABELS } from '../userRoles'
import {
  deleteManagedUser,
  fetchUsers,
  updateManagedUser,
} from '../usersApi'
import { AlertModal } from './AlertModal'
import { NovoUsuarioForm } from './NovoUsuarioForm'

type Props = {
  open: boolean
  onClose: () => void
  onUsersLoaded?: (users: ManagedUser[]) => void
  onUserCreated?: (user: ManagedUser, contato?: VendedorContatoPatch) => void
  onUserDeleted?: (user: ManagedUser) => void
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function UsuariosModal({
  open,
  onClose,
  onUsersLoaded,
  onUserCreated,
  onUserDeleted,
}: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchUsers()
      setUsers(list)
      onUsersLoaded?.(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [onUsersLoaded])

  useEffect(() => {
    if (!open) return
    void reload()
  }, [open, reload])

  const handleCreated = (user: ManagedUser, contato?: VendedorContatoPatch) => {
    onUserCreated?.(user, contato)
    void reload()
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
            aria-labelledby="usuarios-title"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <h2 id="usuarios-title">Usuários e acessos</h2>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
                ×
              </button>
            </header>

            <div className="usuarios-body">
              <p className="usuarios-hint">
                Perfis de <strong>gerente</strong>, <strong>expedição</strong> e{' '}
                <strong>impressão</strong> entram aqui. Para <strong>vendedor</strong>, use o painel{' '}
                <strong>Vendedores</strong> — mesmo layout, com WhatsApp e grupo no cadastro.
              </p>

              <NovoUsuarioForm
                mode="any-role"
                onCreated={handleCreated}
                onError={setError}
                onSuccessAlert={setAlertMessage}
              />

              {error && <p className="usuarios-error">{error}</p>}

              {loading ? (
                <p className="usuarios-loading">Carregando…</p>
              ) : (
                <div className="usuarios-table-wrap">
                  <div className="usuarios-table-toolbar">
                    <button
                      type="button"
                      className="btn ghost btn-xs"
                      onClick={() => setShowPasswords((v) => !v)}
                      aria-pressed={showPasswords}
                    >
                      {showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
                    </button>
                  </div>
                  <table className="usuarios-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Perfil</th>
                        <th>Senha</th>
                        <th aria-label="Ações" />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <UsuarioRow
                          key={u.id}
                          user={u}
                          showPassword={showPasswords}
                          onChanged={reload}
                          onAlert={setAlertMessage}
                          onError={setError}
                          onUserDeleted={onUserDeleted}
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
        open={Boolean(alertMessage)}
        message={alertMessage || ''}
        onClose={() => setAlertMessage(null)}
      />
    </>
  )
}

function UsuarioRow({
  user,
  showPassword,
  onChanged,
  onAlert,
  onError,
  onUserDeleted,
}: {
  user: ManagedUser
  showPassword: boolean
  onChanged: () => Promise<void>
  onAlert: (msg: string) => void
  onError: (msg: string | null) => void
  onUserDeleted?: (user: ManagedUser) => void
}) {
  const isAdmin = user.role === 'admin'
  const [rowVisible, setRowVisible] = useState(false)
  const passwordVisible = showPassword || rowVisible

  const copyPassword = async () => {
    const ok = await copyText(user.password)
    onAlert(ok ? 'Senha copiada.' : 'Não foi possível copiar — selecione e copie manualmente.')
  }

  const copyLoginLine = async () => {
    const line = `Login VestFirma\nE-mail: ${user.email}\nSenha: ${user.password}`
    const ok = await copyText(line)
    onAlert(ok ? 'E-mail e senha copiados.' : 'Copie manualmente da tabela.')
  }

  const regenPassword = async () => {
    if (!window.confirm('Gerar nova senha? A anterior deixa de funcionar.')) return
    onError(null)
    try {
      await updateManagedUser({ id: user.id, regeneratePassword: true })
      await onChanged()
      onAlert('Nova senha gerada — copie e envie.')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao gerar senha')
    }
  }

  const remove = async () => {
    if (!window.confirm(`Excluir acesso de ${user.email}?`)) return
    onError(null)
    try {
      await deleteManagedUser(user.id)
      onUserDeleted?.(user)
      await onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao excluir')
    }
  }

  return (
    <tr>
      <td>{user.name}</td>
      <td>
        <code className="usuarios-email">{user.email}</code>
      </td>
      <td>{USER_ROLE_LABELS[user.role]}</td>
      <td>
        <div className="usuarios-password-cell">
          <span
            className={`usuarios-password ${passwordVisible ? '' : 'usuarios-password--masked'}`}
            aria-hidden={!passwordVisible}
          >
            {passwordVisible ? user.password : '••••••••••••'}
          </span>
          <button
            type="button"
            className="btn ghost btn-xs usuarios-password-toggle"
            onClick={() => setRowVisible((v) => !v)}
            aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}
            title={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {passwordVisible ? 'Ocultar' : 'Ver'}
          </button>
        </div>
        <div className="usuarios-password-actions">
          <button type="button" className="btn ghost btn-xs" onClick={() => void copyPassword()}>
            Copiar senha
          </button>
          <button type="button" className="btn ghost btn-xs" onClick={() => void copyLoginLine()}>
            Copiar login
          </button>
          {!isAdmin && (
            <button type="button" className="btn ghost btn-xs" onClick={() => void regenPassword()}>
              Nova senha
            </button>
          )}
        </div>
      </td>
      <td className="usuarios-actions">
        {!isAdmin ? (
          <button type="button" className="btn ghost btn-xs danger-text" onClick={() => void remove()}>
            Excluir
          </button>
        ) : null}
      </td>
    </tr>
  )
}
