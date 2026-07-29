import { useCallback, useEffect, useState } from 'react'
import type { ManagedUser, UserRole } from '../userRoles'
import { USER_ROLE_LABELS } from '../userRoles'
import {
  CREATABLE_ROLES,
  createManagedUser,
  deleteManagedUser,
  fetchUsers,
  updateManagedUser,
} from '../usersApi'
import { AlertModal } from './AlertModal'

type Props = {
  open: boolean
  onClose: () => void
  onUsersLoaded?: (users: ManagedUser[]) => void
  onUserCreated?: (user: ManagedUser) => void
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
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('vendedor')
  const [creating, setCreating] = useState(false)
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const roleCreated = newRole
      const created = await createManagedUser({
        email: newEmail.trim(),
        role: newRole,
        name: newName.trim() || undefined,
      })
      onUserCreated?.(created)
      setNewEmail('')
      setNewName('')
      setNewRole('vendedor')
      await reload()
      setAlertMessage(
        roleCreated === 'vendedor'
          ? 'Usuário criado e adicionado à lista Vendedores do quadro. Copie a senha abaixo. Configure WhatsApp em Vendedores.'
          : 'Usuário criado. Copie a senha abaixo e envie para a pessoa.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar')
    } finally {
      setCreating(false)
    }
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
                Cada perfil entra com <strong>e-mail</strong> e <strong>senha</strong>. Perfil{' '}
                <strong>Vendedor</strong> ou o <strong>administrador</strong> entram na lista{' '}
                <strong>Vendedores</strong> do quadro para lançar pedidos; WhatsApp e grupo em
                Vendedores.
              </p>

              <form className="usuarios-create" onSubmit={(e) => void handleCreate(e)}>
                <h3 className="usuarios-subtitle">Novo acesso</h3>
                <div className="usuarios-create-grid">
                  <label>
                    <span>E-mail (login)</span>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    <span>Nome (opcional)</span>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    <span>Perfil</span>
                    <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
                      {CREATABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {USER_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="btn primary" disabled={creating}>
                    {creating ? 'Criando…' : 'Gerar senha e cadastrar'}
                  </button>
                </div>
              </form>

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
