import { formatApiErrorMessage, readApiJson } from './apiErrors'
import type { ManagedUser, SessionProfile, UserRole } from './userRoles'
import { CREATABLE_ROLES } from './userRoles'
import { recordAudit } from './auditLog'
import {
  authHeaders,
  ensureAuthConfigReady,
  getAuthGeneration,
  handleAuthResponse,
} from './authSession'
import { getApiBase } from './runtimeConfig'
import { getAuditActor } from './auditContext'

export { CREATABLE_ROLES }

const ADMIN_USERS_ONLY_MSG =
  'Apenas o administrador geral pode cadastrar, alterar ou excluir usuários.'

function requireAdminActor(): void {
  if (!isAdmin(getAuditActor())) {
    throw new Error(ADMIN_USERS_ONLY_MSG)
  }
}

function apiPath(segment: string): string {
  const clean = segment.replace(/\.php$/i, '').replace(/^\//, '')
  return `/${clean}`
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')

  const authGen = getAuthGeneration()
  const res = await fetch(`${base}${apiPath('users')}`, {
    headers: { Accept: 'application/json', ...authHeaders() },
  })
  handleAuthResponse(res.status, authGen)
  const { json } = await readApiJson(res)
  const data = json as { users?: ManagedUser[] }
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao carregar usuários'))
  return data.users || []
}

export async function createManagedUser(input: {
  email: string
  role: UserRole
  name?: string
}): Promise<ManagedUser> {
  requireAdminActor()
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')

  const authGen = getAuthGeneration()
  const res = await fetch(`${base}${apiPath('users')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  })
  handleAuthResponse(res.status, authGen)
  const { json } = await readApiJson(res)
  const data = json as { user?: ManagedUser }
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao criar usuário'))
  if (!data.user) {
    throw new Error(
      formatApiErrorMessage(
        res,
        { error: 'Resposta sem dados do usuário criado.', fix: 'Redeploy da API /api/users.' },
        'Falha ao criar usuário',
      ),
    )
  }
  recordAudit({
    action: 'usuario.criado',
    summary: `Criou usuário ${data.user.email} (${data.user.role})`,
    meta: { userId: data.user.id },
  })
  return data.user
}

export async function updateManagedUser(input: {
  id: string
  email?: string
  role?: UserRole
  name?: string
  regeneratePassword?: boolean
}): Promise<ManagedUser> {
  requireAdminActor()
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')

  const authGen = getAuthGeneration()
  const res = await fetch(`${base}${apiPath('users')}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  })
  handleAuthResponse(res.status, authGen)
  const { json } = await readApiJson(res)
  const data = json as { user?: ManagedUser }
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao atualizar usuário'))
  if (!data.user) throw new Error(formatApiErrorMessage(res, json, 'Falha ao atualizar usuário'))
  recordAudit({
    action: 'usuario.atualizado',
    summary: `Atualizou usuário ${data.user.email}`,
    meta: { userId: data.user.id },
  })
  return data.user
}

export async function deleteManagedUser(id: string): Promise<void> {
  requireAdminActor()
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')

  const authGen = getAuthGeneration()
  const res = await fetch(`${base}${apiPath('users')}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json', ...authHeaders() },
  })
  handleAuthResponse(res.status, authGen)
  const { json } = await readApiJson(res)
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao excluir usuário'))
  recordAudit({
    action: 'usuario.excluido',
    summary: `Excluiu usuário (id ${id})`,
    meta: { userId: id },
  })
}

export type { SessionProfile, ManagedUser, UserRole }

export function isAdmin(profile: SessionProfile | null): boolean {
  return profile?.role === 'admin'
}
