import { useCallback, useEffect, useRef, useState } from 'react'
import type { ManagedUser } from '../userRoles'
import { USER_ROLE_LABELS, canPlaceOrders } from '../userRoles'
import type { VendedorContatoPatch } from '../vendedorUserSync'
import { findVendedorForManagedUser } from '../vendedorUserSync'
import type { Vendedor } from '../types'
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
}: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)
  const onUsersLoadedRef = useRef(onUsersLoaded)
  onUsersLoadedRef.current = onUsersLoaded
  const seedUsersRef = useRef(seedUsers)
  seedUsersRef.current = seedUsers

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchUsersWithTimeout()
      setUsers(list)
      onUsersLoadedRef.current?.(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const seed = seedUsersRef.current
    if (seed?.length) setUsers(seed)
    void reload()
  }, [open, reload])

  const handleCreated = (user: ManagedUser, contato?: VendedorContatoPatch) => {
    onUserCreated?.(user, contato)
    void reload()
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
              </p>

              <NovoUsuarioForm
                mode="any-role"
                onCreated={handleCreated}
                onError={setError}
                onSuccessAlert={setAlertMessage}
              />

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
                          onChanged={reload}
                          onAlert={setAlertMessage}
                          onError={setError}
                          onUserDeleted={onUserDeleted}
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
    </>
  )
}

function UsuarioRow({
  user,
  vendedor,
  showPassword,
  onChanged,
  onAlert,
  onError,
  onUserDeleted,
  onUpdateVendedorContato,
  onEnsureVendedor,
}: {
  user: ManagedUser
  vendedor: Vendedor | null
  showPassword: boolean
  onChanged: () => Promise<void>
  onAlert: (msg: string) => void
  onError: (msg: string | null) => void
  onUserDeleted?: (user: ManagedUser) => void
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
        {!isAdmin ? (
          <button type="button" className="btn ghost btn-xs danger-text" onClick={() => void remove()}>
            Excluir
          </button>
        ) : null}
      </td>
    </tr>
  )
}
