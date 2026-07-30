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
import {
  loadManagedUsersFromIdb,
  rememberManagedUser,
  rememberManagedUsers,
  saveManagedUsersToIdb,
  usersMissingOnServer,
} from './managedUsersCache'
import { mergeManagedUsers } from './mergeManagedUsers'

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

function usersFetchInit(extra: RequestInit = {}): RequestInit {
  return {
    cache: 'no-store',
    ...extra,
    headers: {
      Accept: 'application/json',
      ...(extra.headers as Record<string, string> | undefined),
      ...authHeaders(),
    },
  }
}

async function fetchUsersFromServer(authGen: number): Promise<ManagedUser[]> {
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')
  const res = await fetch(`${base}${apiPath('users')}`, usersFetchInit())
  handleAuthResponse(res.status, authGen)
  const { json } = await readApiJson(res)
  const data = json as { users?: ManagedUser[] }
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao carregar usuários'))
  return data.users || []
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  await ensureAuthConfigReady()
  const cached = await loadManagedUsersFromIdb()
  const authGen = getAuthGeneration()

  let serverUsers: ManagedUser[] = []
  try {
    serverUsers = await fetchUsersFromServer(authGen)
  } catch (err) {
    if (cached.length > 0) return cached
    throw err
  }

  let merged = mergeManagedUsers(cached, serverUsers)

  const missing = usersMissingOnServer(merged, serverUsers)
  if (missing.length > 0 && isAdmin(getAuditActor())) {
    try {
      const sync = await syncMissingManagedUsersToServer(missing)
      if (sync.added > 0) {
        serverUsers = await fetchUsersFromServer(authGen)
        merged = mergeManagedUsers(merged, serverUsers)
      }
    } catch (syncErr) {
      console.warn('[vestfirma] sync usuários:', syncErr)
    }
  }

  await rememberManagedUsers(merged)
  return merged
}

export async function syncMissingManagedUsersToServer(
  users: ManagedUser[],
): Promise<{ added: number; message: string }> {
  requireAdminActor()
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')
  if (!users.length) return { added: 0, message: 'Nada para sincronizar.' }

  const authGen = getAuthGeneration()
  const res = await fetch(
    `${base}${apiPath('users')}`,
    usersFetchInit({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync-missing',
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          password: u.password,
          createdAt: u.createdAt,
        })),
      }),
    }),
  )
  handleAuthResponse(res.status, authGen)
  const { json } = await readApiJson(res)
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao sincronizar usuários'))
  const data = json as { added?: number; message?: string }
  if ((data.added ?? 0) > 0) {
    recordAudit({
      action: 'usuarios.sincronizados',
      summary: data.message || `Sincronizou ${data.added} usuário(s) do navegador para o servidor`,
    })
  }
  return { added: data.added ?? 0, message: data.message || 'Sincronizado.' }
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
  const res = await fetch(
    `${base}${apiPath('users')}`,
    usersFetchInit({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
  handleAuthResponse(res.status, authGen)
  const { json } = await readApiJson(res)
  const data = json as { user?: ManagedUser; usersCount?: number }
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

  await rememberManagedUser(data.user)

  let onServer = false
  try {
    const serverUsers = await fetchUsersFromServer(authGen)
    onServer = serverUsers.some(
      (u) =>
        u.id === data.user!.id ||
        u.email.trim().toLowerCase() === data.user!.email.trim().toLowerCase(),
    )
  } catch {
    /* tenta sync abaixo */
  }

  if (!onServer) {
    await syncMissingManagedUsersToServer([data.user])
    const serverUsers = await fetchUsersFromServer(authGen)
    onServer = serverUsers.some(
      (u) =>
        u.id === data.user!.id ||
        u.email.trim().toLowerCase() === data.user!.email.trim().toLowerCase(),
    )
    if (!onServer) {
      throw new Error(
        'Cadastro não persistiu no servidor após tentativa de sincronização. Confira disco persistente na Render (/opt/render/project/src/data) e redeploy.',
      )
    }
  }

  recordAudit({
    action: 'usuario.criado',
    summary: `Criou usuário ${data.user.email} (${data.user.role}) — ${data.usersCount ?? '?'} no servidor`,
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
  const res = await fetch(
    `${base}${apiPath('users')}`,
    usersFetchInit({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
  handleAuthResponse(res.status, authGen)
  const { json } = await readApiJson(res)
  const data = json as { user?: ManagedUser }
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao atualizar usuário'))
  if (!data.user) throw new Error(formatApiErrorMessage(res, json, 'Falha ao atualizar usuário'))
  await rememberManagedUser(data.user)
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
  const res = await fetch(
    `${base}${apiPath('users')}?id=${encodeURIComponent(id)}`,
    usersFetchInit({
      method: 'DELETE',
      headers: { 'X-Vestfirma-Confirm-User-Delete': id },
    }),
  )
  handleAuthResponse(res.status, authGen)
  const { json } = await readApiJson(res)
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao excluir usuário'))
  const cached = await loadManagedUsersFromIdb()
  await saveManagedUsersToIdb(cached.filter((u) => u.id !== id))
  recordAudit({
    action: 'usuario.excluido',
    summary: `Excluiu usuário (id ${id})`,
    meta: { userId: id },
  })
}

export async function fetchUsersBackups(): Promise<{
  currentCount: number
  backups: {
    file: string
    label: string
    total: number
    missingCount: number
    preview: { id: string; email: string; name?: string; role?: string }[]
  }[]
}> {
  requireAdminActor()
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')

  const authGen = getAuthGeneration()
  const res = await fetch(`${base}${apiPath('users/backups')}`, usersFetchInit())
  handleAuthResponse(res.status, authGen)
  const { json } = await readApiJson(res)
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao listar backups de usuários'))
  return json as {
    currentCount: number
    backups: {
      file: string
      label: string
      total: number
      missingCount: number
      preview: { id: string; email: string; name?: string; role?: string }[]
    }[]
  }
}

export async function restoreUsersFromBackup(backup: string): Promise<{ message: string; added: number }> {
  requireAdminActor()
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')

  const authGen = getAuthGeneration()
  const res = await fetch(
    `${base}${apiPath('users/backups')}`,
    usersFetchInit({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup }),
    }),
  )
  handleAuthResponse(res.status, authGen)
  const { json } = await readApiJson(res)
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao restaurar usuários'))
  const data = json as { message?: string; added?: number }
  recordAudit({
    action: 'usuarios.restaurados',
    summary: data.message || `Restaurou ${data.added ?? 0} usuário(s) de backup`,
  })
  return { message: data.message || 'Usuários restaurados.', added: data.added ?? 0 }
}

export async function repairUsersFromBoard(): Promise<{
  message: string
  added: number
  vendedoresNoQuadro: number
  created: ManagedUser[]
}> {
  requireAdminActor()
  await ensureAuthConfigReady()
  const base = getApiBase()
  if (!base) throw new Error('API não configurada')

  const authGen = getAuthGeneration()
  const res = await fetch(
    `${base}${apiPath('users/backups')}`,
    usersFetchInit({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'repair-from-board' }),
    }),
  )
  handleAuthResponse(res.status, authGen)
  const { json } = await readApiJson(res)
  if (!res.ok) throw new Error(formatApiErrorMessage(res, json, 'Falha ao recriar usuários do quadro'))
  const data = json as {
    message?: string
    added?: number
    vendedoresNoQuadro?: number
    created?: ManagedUser[]
  }
  if ((data.added ?? 0) > 0) {
    recordAudit({
      action: 'usuarios.restaurados',
      summary: data.message || `Recriou ${data.added} usuário(s) do quadro`,
    })
    if (data.created?.length) await rememberManagedUsers(data.created)
  }
  return {
    message: data.message || 'Concluído.',
    added: data.added ?? 0,
    vendedoresNoQuadro: data.vendedoresNoQuadro ?? 0,
    created: data.created ?? [],
  }
}

export type { SessionProfile, ManagedUser, UserRole }

export function isAdmin(profile: SessionProfile | null): boolean {
  return profile?.role === 'admin'
}
