import type { ManagedUser, SessionProfile, UserRole } from './userRoles'
import { CREATABLE_ROLES } from './userRoles'
import { authHeaders, handleAuthResponse } from './authSession'

export { CREATABLE_ROLES }

function apiBase(): string | null {
  const raw = import.meta.env.VITE_API_BASE?.trim()
  if (!raw) return null
  return raw.replace(/\/$/, '')
}

function apiPath(file: string): string {
  return file.startsWith('/') ? file : `/${file}`
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  const base = apiBase()
  if (!base) throw new Error('API não configurada')

  const res = await fetch(`${base}${apiPath('users.php')}`, {
    headers: { Accept: 'application/json', ...authHeaders() },
  })
  handleAuthResponse(res.status)
  const data = (await res.json().catch(() => ({}))) as { users?: ManagedUser[]; error?: string }
  if (!res.ok) throw new Error(data.error || 'Falha ao carregar usuários')
  return data.users || []
}

export async function createManagedUser(input: {
  email: string
  role: UserRole
  name?: string
}): Promise<ManagedUser> {
  const base = apiBase()
  if (!base) throw new Error('API não configurada')

  const res = await fetch(`${base}${apiPath('users.php')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  })
  handleAuthResponse(res.status)
  const data = (await res.json().catch(() => ({}))) as { user?: ManagedUser; error?: string }
  if (!res.ok || !data.user) throw new Error(data.error || 'Falha ao criar usuário')
  return data.user
}

export async function updateManagedUser(input: {
  id: string
  email?: string
  role?: UserRole
  name?: string
  regeneratePassword?: boolean
}): Promise<ManagedUser> {
  const base = apiBase()
  if (!base) throw new Error('API não configurada')

  const res = await fetch(`${base}${apiPath('users.php')}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  })
  handleAuthResponse(res.status)
  const data = (await res.json().catch(() => ({}))) as { user?: ManagedUser; error?: string }
  if (!res.ok || !data.user) throw new Error(data.error || 'Falha ao atualizar usuário')
  return data.user
}

export async function deleteManagedUser(id: string): Promise<void> {
  const base = apiBase()
  if (!base) throw new Error('API não configurada')

  const res = await fetch(`${base}${apiPath('users.php')}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json', ...authHeaders() },
  })
  handleAuthResponse(res.status)
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(data.error || 'Falha ao excluir usuário')
}

export type { SessionProfile, ManagedUser, UserRole }

export function isAdmin(profile: SessionProfile | null): boolean {
  return profile?.role === 'admin'
}
