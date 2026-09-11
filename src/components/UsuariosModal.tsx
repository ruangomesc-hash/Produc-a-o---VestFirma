import { useCallback, useEffect, useRef, useState } from 'react'
import type { ManagedUser } from '../userRoles'
import { USER_ROLE_LABELS, canPlaceOrders } from '../userRoles'
import type { VendedorContatoPatch } from '../vendedorUserSync'
import { findVendedorForManagedUser } from '../vendedorUserSync'
import type { Vendedor } from '../types'
import {
  deleteManagedUser,
  fetchUsers,
  fetchUsersBackups,
  restoreUsersFromBackup,
  repairUsersFromBoard,
  updateManagedUser,
} from '../usersApi'
import { mergeManagedUsers } from '../mergeManagedUsers'
import { AlertModal } from './AlertModal'
import { NovoUsuarioForm } from './NovoUsuarioForm'

type Props = {
  open: boolean
  onClose: () => void
  vendedores: Vendedor[]
  onUsersLoaded?: (users: ManagedUser[]) => void
  onUserCreated?: (user: ManagedUser, contato?: VendedorContatoPatch) => void
  onUserDeleted?: (user: ManagedUser) => void
  onUpdateVendedorContato?: (
    id: string,
    patch: { whatsapp?: string; grupoWhatsapp?: string },
  ) => void
  onEnsureVendedor?: (user: ManagedUser, contato?: VendedorContatoPatch) => void
  /** Lista já carregada no app — evita tela vazia e fetch duplicado ao abrir. */
  seedUsers?: ManagedUser[]
  /** Só administrador pode excluir acessos (botão e ação). */
  canDeleteUsers?: boolean
}

const USERS_LOAD_TIMEOUT_MS = 45_000

async function fetchUsersWithTimeout(): Promise<ManagedUser[]> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      fetchUsers(),
      new Promise<ManagedUser[]>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              'Demorou demais para carregar usuários. O servidor pode estar acordando — aguarde ~1 minuto e clique em Atualizar.',
            ),
          )
        }, USERS_LOAD_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function boardSliceForLookup(vendedores: Vendedor[]) {
  return { vendedores, columns: [], cards: [] }
}

export function UsuariosModal({
  open,
  onClose,
  vendedores,
  onUsersLoaded,
  onUserCreated,
  onUserDeleted,
  onUpdateVendedorContato,
  onEnsureVendedor,
  seedUsers,
  canDeleteUsers = false,
}: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const onUsersLoadedRef = useRef(onUsersLoaded)
  onUsersLoadedRef.current = onUsersLoaded
  const seedUsersRef = useRef(seedUsers)
  seedUsersRef.current = seedUsers

  const notifyUsersLoaded = useCallback((list: ManagedUser[]) => {
    setUsers((prev) => {
      const merged = mergeManagedUsers(prev, list)
      onUsersLoadedRef.current?.(merged)
      return merged
    })
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchUsersWithTimeout()
      notifyUsersLoaded(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [notifyUsersLoaded])

  const restoreMissingUsers = useCallback(async () => {
    setRestoreBusy(true)
    setRestoreMessage(null)
    setError(null)
    try {
      const data = await fetchUsersBackups()
      const best = data.backups.find((b) => b.missingCount > 0)
      if (best) {
        const result = await restoreUsersFromBackup(best.file)
        setRestoreMessage(result.message)
        await reload()
        return
      }
      const fromBoard = await repairUsersFromBoard()
      if (fromBoard.added > 0) {
        const names = fromBoard.created.map((u) => u.name || u.email).join(', ')
        setRestoreMessage(`${fromBoard.message} (${names}) — copie as senhas abaixo.`)
        await reload()
        return
      }
      setRestoreMessage(
        `Nenhum backup de users.json com cadastros extras (${data.backups.length} arquivo(s) verificado(s)). ` +
          `${fromBoard.message} ` +
          `Cadastre os novos acessos no formulário acima.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao restaurar usuários')
    } finally {
      setRestoreBusy(false)
    }
  }, [reload])

  const repairFromBoardOnly = useCallback(async () => {
    setRestoreBusy(true)
    setRestoreMessage(null)
    setError(null)
    try {
      const result = await repairUsersFromBoard()
      if (result.added > 0) {
        const names = result.created.map((u) => u.name || u.email).join(', ')
        setRestoreMessage(`${result.message} (${names}) — use Mostrar senhas e envie aos vendedores.`)
        await reload()
      } else {
        setRestoreMessage(result.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao recriar do quadro')
    } finally {
      setRestoreBusy(false)
    }
  }, [reload])

  useEffect(() => {
    if (deleteTarget) setDeleteEmail('')
  }, [deleteTarget])

  useEffect(() => {
    if (!open) return
    const seed = seedUsersRef.current
    if (seed?.length) setUsers(seed)
    void reload()
  }, [open, reload])

  const handleCreated = (user: ManagedUser, contato?: VendedorContatoPatch) => {
    onUserCreated?.(user, contato)
    setUsers((prev) => {
      const merged = mergeManagedUsers(prev, [user])
      onUsersLoadedRef.current?.(merged)
      return merged
    })
    window.setTimeout(() => void reload(), 700)
  }

  if (!open && !alertMessage) return null

  const lookupBoard = boardSliceForLookup(vendedores)

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
                Cadastro único: <strong>e-mail</strong>, <strong>senha</strong>, perfil e, para{' '}
                <strong>vendedor</strong>, <strong>WhatsApp</strong> e <strong>grupo</strong>. Quem
                lança pedidos entra automaticamente no quadro — os pedidos ficam atrelados à pessoa.
                Exclusão de acesso: <strong>somente administrador geral</strong>.
              </p>

              <NovoUsuarioForm
                mode="any-role"
                onCreated={handleCreated}
                onError={setError}
                onSuccessAlert={setAlertMessage}
              />

              {users.length <= 1 && !loading ? (
                <details className="board-restore-banner">
                  <summary>Recuperar acessos anteriores</summary>
                  <p>
                    Use esta opção se precisar recuperar acessos que já existiam no servidor.
                    Para começar uma nova equipe, cadastre os usuários no formulário acima.
                  </p>
                  <div className="board-restore-actions">
                    <button
                      type="button"
                      className="btn primary small"
                      disabled={restoreBusy}
                      onClick={() => void restoreMissingUsers()}
                    >
                      {restoreBusy ? 'Buscando…' : 'Restaurar usuários (backup + quadro)'}
                    </button>
                    <button
                      type="button"
                      className="btn ghost small"
                      disabled={restoreBusy}
                      onClick={() => void repairFromBoardOnly()}
                    >
                      Recriar do quadro
                    </button>
                  </div>
                  {restoreMessage ? <p className="usuarios-hint">{restoreMessage}</p> : null}
                </details>
              ) : null}

              {error && (
                <p className="usuarios-error" role="alert">
                  {error}
                </p>
              )}

              {loading && users.length === 0 ? (
                <p className="usuarios-loading">Carregando usuários…</p>
              ) : null}

              {users.length > 0 || !loading ? (
                <div className="usuarios-table-wrap">
                  <div className="usuarios-table-toolbar">
                    <button
                      type="button"
                      className="btn ghost btn-xs"
                      onClick={() => void reload()}
                      disabled={loading}
                    >
                      {loading ? 'Atualizando…' : 'Atualizar lista'}
                    </button>
                    <button
                      type="button"
                      className="btn ghost btn-xs"
                      onClick={() => setShowPasswords((v) => !v)}
                      aria-pressed={showPasswords}
                    >
                      {showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
                    </button>
                  </div>
                  <table className="usuarios-table usuarios-table--com-contato">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Perfil</th>
                        <th>WhatsApp</th>
                        <th>Grupo (ID)</th>
                        <th>Senha</th>
                        <th aria-label="Ações" />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <UsuarioRow
                          key={u.id}
                          user={u}
                          vendedor={findVendedorForManagedUser(lookupBoard, u)}
                          showPassword={showPasswords}
                          canDeleteUsers={canDeleteUsers}
                          onChanged={reload}
                          onAlert={setAlertMessage}
                          onError={setError}
                          onUserDeleted={onUserDeleted}
                          onRequestDelete={setDeleteTarget}
                          onUpdateVendedorContato={onUpdateVendedorContato}
                          onEnsureVendedor={onEnsureVendedor}
                        />
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && !loading ? (
                    <p className="usuarios-muted usuarios-empty-hint">
                      Nenhum usuário na lista. Cadastre acima ou clique em Atualizar lista.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <AlertModal
        open={Boolean(alertMessage)}
        message={alertMessage || ''}
        onClose={() => setAlertMessage(null)}
      />

      {deleteTarget ? (
        <div
          className="modal-backdrop confirm-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteBusy) setDeleteTarget(null)
          }}
        >
          <div className="confirm-modal" role="alertdialog" onClick={(e) => e.stopPropagation()}>
            <header className="confirm-modal-brand">
              <img
                src={`${import.meta.env.BASE_URL}vestfirma-logo.png`}
                alt="VestFirma"
                className="confirm-modal-logo"
              />
            </header>
            <div className="confirm-modal-body">
              <h2 className="confirm-modal-title">Excluir acesso?</h2>
              <p className="confirm-message">
                Isso remove o login de <strong>{deleteTarget.email}</strong> do servidor. Para
                confirmar, digite o e-mail abaixo (proteção contra clique acidental).
              </p>
              <label className="usuarios-search">
                <span>E-mail do usuário</span>
                <input
                  type="email"
                  value={deleteEmail}
                  onChange={(e) => setDeleteEmail(e.target.value)}
                  placeholder={deleteTarget.email}
                  autoComplete="off"
                />
              </label>
              <div className="confirm-actions">
                <button
                  type="button"
                  className="btn confirm-cancel"
                  disabled={deleteBusy}
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn primary confirm-danger"
                  disabled={
                    deleteBusy ||
                    deleteEmail.trim().toLowerCase() !== deleteTarget.email.trim().toLowerCase()
                  }
                  onClick={() => {
                    setDeleteBusy(true)
                    setError(null)
                    void deleteManagedUser(deleteTarget.id)
                      .then(async () => {
                        onUserDeleted?.(deleteTarget)
                        setDeleteTarget(null)
                        setDeleteEmail('')
                        await reload()
                      })
                      .catch((err) => {
                        setError(err instanceof Error ? err.message : 'Falha ao excluir')
                      })
                      .finally(() => setDeleteBusy(false))
                  }}
                >
                  {deleteBusy ? 'Excluindo…' : 'Sim, excluir acesso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function UsuarioRow({
  user,
  vendedor,
  showPassword,
  canDeleteUsers,
  onChanged,
  onAlert,
  onError,
  onRequestDelete,
  onUpdateVendedorContato,
  onEnsureVendedor,
}: {
  user: ManagedUser
  vendedor: Vendedor | null
  showPassword: boolean
  canDeleteUsers: boolean
  onChanged: () => Promise<void>
  onAlert: (msg: string) => void
  onError: (msg: string | null) => void
  onUserDeleted?: (user: ManagedUser) => void
  onRequestDelete?: (user: ManagedUser) => void
  onUpdateVendedorContato?: Props['onUpdateVendedorContato']
  onEnsureVendedor?: Props['onEnsureVendedor']
}) {
  const isAdmin = user.role === 'admin'
  const placesOrders = canPlaceOrders(user.role)
  const [rowVisible, setRowVisible] = useState(false)
  const passwordVisible = showPassword || rowVisible
  const [whatsapp, setWhatsapp] = useState(vendedor?.whatsapp ?? '')
  const [grupoWhatsapp, setGrupoWhatsapp] = useState(vendedor?.grupoWhatsapp ?? '')
  const [contatoSavedHint, setContatoSavedHint] = useState(false)

  useEffect(() => {
    setWhatsapp(vendedor?.whatsapp ?? '')
    setGrupoWhatsapp(vendedor?.grupoWhatsapp ?? '')
  }, [vendedor?.id, vendedor?.whatsapp, vendedor?.grupoWhatsapp])

  const savedWhatsapp = (vendedor?.whatsapp ?? '').trim()
  const savedGrupo = (vendedor?.grupoWhatsapp ?? '').trim()
  const contatoDirty =
    placesOrders &&
    (whatsapp.trim() !== savedWhatsapp || grupoWhatsapp.trim() !== savedGrupo)

  const saveContato = () => {
    if (!placesOrders) return
    const patch = { whatsapp, grupoWhatsapp }
    if (vendedor) {
      onUpdateVendedorContato?.(vendedor.id, patch)
    } else {
      onEnsureVendedor?.(user, {
        whatsapp: whatsapp.trim() || undefined,
        grupoWhatsapp: grupoWhatsapp.trim() || undefined,
      })
    }
    setContatoSavedHint(true)
    window.setTimeout(() => setContatoSavedHint(false), 2200)
  }

  useEffect(() => {
    if (contatoDirty) setContatoSavedHint(false)
  }, [contatoDirty])

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

  const remove = () => {
    if (!canDeleteUsers) {
      onError('Apenas o administrador geral pode excluir usuários.')
      return
    }
    onRequestDelete?.(user)
  }

  return (
    <tr>
      <td>{user.name}</td>
      <td>
        <code className="usuarios-email">{user.email}</code>
      </td>
      <td>{USER_ROLE_LABELS[user.role]}</td>
      <td className="usuarios-contato-cell">
        {placesOrders ? (
          <input
            className="usuarios-table-input"
            type="tel"
            inputMode="tel"
            placeholder="Número"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        ) : (
          <span className="usuarios-muted">—</span>
        )}
      </td>
      <td className="usuarios-contato-cell">
        {placesOrders ? (
          <input
            className="usuarios-table-input"
            type="text"
            placeholder="120363…@g.us"
            value={grupoWhatsapp}
            onChange={(e) => setGrupoWhatsapp(e.target.value)}
          />
        ) : (
          <span className="usuarios-muted">—</span>
        )}
      </td>
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
        {placesOrders && (contatoDirty || !vendedor) ? (
          <button type="button" className="btn primary btn-xs" onClick={saveContato}>
            Salvar contato
          </button>
        ) : null}
        {contatoSavedHint ? (
          <span className="vendedor-saved-hint" aria-live="polite">
            Salvo
          </span>
        ) : null}
        {!isAdmin && canDeleteUsers ? (
          <button type="button" className="btn ghost btn-xs danger-text" onClick={remove}>
            Excluir
          </button>
        ) : null}
      </td>
    </tr>
  )
}
