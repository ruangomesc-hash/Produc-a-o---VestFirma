import { formatApiErrorMessage, readApiJson } from './apiErrors'
import type { ManagedUser, SessionProfile, UserRole } from './userRoles'
import { CREATABLE_ROLES } from './userRoles'
import { authHeaders, ensureAuthConfigReady, handleAuthResponse } from './authSession'
import { getApiBase } from './runtimeConfig'

export { CREATABLE_ROLES }

function apiPath(segment: string): string {
  const clean = segment.replace(/\.php$/i, '').replace(/^\//, '')
  return `/${clean}`
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')

  const res = await fetch(`${base}${apiPath('users')}`, {
    headers: { Accept: 'application/json', ...authHeaders() },
  })
  handleAuthResponse(res.status)
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
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')

  const res = await fetch(`${base}${apiPath('users')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  })
  handleAuthResponse(res.status)
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
  return data.user
}

export async function updateManagedUser(input: {
  id: string
  email?: string
  role?: UserRole
  name?: string
  regeneratePassword?: boolean
}): Promise<ManagedUser> {
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')

  const res = await fetch(`${base}${apiPath('users')}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  })
  handleAuthResponse(res.status)
  const { json } = await readApiJson(res)
  const data = json as { user?: ManagedUser }
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao atualizar usuário'))
  if (!data.user) throw new Error(formatApiErrorMessage(res, json, 'Falha ao atualizar usuário'))
  return data.user
}

export async function deleteManagedUser(id: string): Promise<void> {
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')

  const res = await fetch(`${base}${apiPath('users')}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json', ...authHeaders() },
  })
  handleAuthResponse(res.status)
  const { json } = await readApiJson(res)
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao excluir usuário'))
}

export type { SessionProfile, ManagedUser, UserRole }

export function isAdmin(profile: SessionProfile | null): boolean {
  return profile?.role === 'admin'
}
