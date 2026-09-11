import { useState } from 'react'
import type { UserRole } from '../userRoles'
import { USER_ROLE_LABELS, canPlaceOrders } from '../userRoles'
import { CREATABLE_ROLES, createManagedUser } from '../usersApi'
import type { ManagedUser } from '../userRoles'
import type { VendedorContatoPatch } from '../vendedorUserSync'
import { isValidLoginEmail, LOGIN_EMAIL_HINT } from '../loginEmail'

export type NovoUsuarioFormProps = {
  /** Cadastro só de vendedor (sem escolher perfil) ou qualquer perfil criável. */
  mode: 'vendedor-only' | 'any-role'
  sectionTitle?: string
  onCreated: (user: ManagedUser, contato?: VendedorContatoPatch) => void
  onError: (message: string | null) => void
  onSuccessAlert: (message: string) => void
}

export function NovoUsuarioForm({
  mode,
  sectionTitle,
  onCreated,
  onError,
  onSuccessAlert,
}: NovoUsuarioFormProps) {
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('vendedor')
  const [newWhatsapp, setNewWhatsapp] = useState('')
  const [newGrupoWhatsapp, setNewGrupoWhatsapp] = useState('')
  const [creating, setCreating] = useState(false)

  const roleForCreate = mode === 'vendedor-only' ? ('vendedor' as const) : newRole
  const showVendedorFields = canPlaceOrders(roleForCreate)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const emailTrim = newEmail.trim()
    if (!isValidLoginEmail(emailTrim)) {
      onError(`E-mail inválido. ${LOGIN_EMAIL_HINT}`)
      return
    }
    setCreating(true)
    onError(null)
    try {
      const created = await createManagedUser({
        email: emailTrim,
        role: roleForCreate,
        name: newName.trim() || undefined,
      })
      const contato: VendedorContatoPatch | undefined = showVendedorFields
        ? {
            whatsapp: newWhatsapp.trim() || undefined,
            grupoWhatsapp: newGrupoWhatsapp.trim() || undefined,
          }
        : undefined
      onCreated(created, contato)
      setNewEmail('')
      setNewName('')
      setNewWhatsapp('')
      setNewGrupoWhatsapp('')
      if (mode === 'any-role') setNewRole('vendedor')

      if (showVendedorFields) {
        onSuccessAlert(
          mode === 'vendedor-only'
            ? `Vendedor cadastrado no quadro.\n\nSenha (copie agora):\n${created.password}`
            : 'Vendedor cadastrado: login criado e já vinculado ao quadro. Copie a senha na tabela abaixo.',
        )
      } else {
        onSuccessAlert('Usuário criado. Copie a senha na tabela abaixo e envie para a pessoa.')
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao criar')
    } finally {
      setCreating(false)
    }
  }

  const title =
    sectionTitle ?? (mode === 'vendedor-only' ? 'Novo vendedor' : 'Novo acesso')

  return (
    <form className="usuarios-create" onSubmit={(e) => void handleCreate(e)}>
      <h3 className="usuarios-subtitle">{title}</h3>
      <div
        className={`usuarios-create-grid${mode === 'vendedor-only' ? ' usuarios-create-grid--vendedor' : ''}`}
      >
        <label>
          <span>E-mail (login)</span>
          <input
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            autoComplete="off"
            placeholder="nome@vestfirma ou nome@empresa.com"
          />
        </label>
        <label>
          <span>Nome (opcional)</span>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoComplete="off"
            placeholder="Como aparece no quadro"
          />
        </label>
        {mode === 'any-role' ? (
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
        ) : null}
        <button type="submit" className="btn primary" disabled={creating}>
          {creating ? 'Criando…' : 'Gerar senha e cadastrar'}
        </button>
      </div>
      {roleForCreate === 'admin' && (
        <p className="usuarios-hint">
          Administradores têm acesso completo aos pedidos, painéis e gerenciamento de usuários.
          {' '}Use o e-mail autorizado para este perfil.
        </p>
      )}
      {showVendedorFields ? (
        <div className="usuarios-vendedor-extra">
          <label>
            <span>WhatsApp</span>
            <input
              type="tel"
              inputMode="tel"
              placeholder="Número para marcar"
              value={newWhatsapp}
              onChange={(e) => setNewWhatsapp(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Grupo WhatsApp — ID</span>
            <input
              type="text"
              placeholder="120363…@g.us"
              value={newGrupoWhatsapp}
              onChange={(e) => setNewGrupoWhatsapp(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p className="usuarios-vendedor-extra-hint">
            Login, linha no quadro e contatos ficam neste cadastro. ID do grupo termina em{' '}
            <code>@g.us</code> — não use link <code>chat.whatsapp.com/…</code>.
          </p>
        </div>
      ) : null}
    </form>
  )
}
