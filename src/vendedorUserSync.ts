import type { BoardState, OrderCard, Vendedor } from './types'
import type { ManagedUser, SessionProfile } from './userRoles'

export function vendedorNomeFromUser(user: Pick<ManagedUser, 'name' | 'email'>): string {
  const name = user.name?.trim()
  return name || user.email
}

function isEmailLikeId(id: string | undefined): boolean {
  return Boolean(id?.includes('@'))
}

/** Id estável no quadro — nunca troca id real do users.json por e-mail legado. */
export function resolveVendedorUserId(
  user: Pick<ManagedUser, 'id' | 'email'>,
  existing?: Vendedor | null,
): string {
  if (existing?.userId && !isEmailLikeId(existing.userId)) return existing.userId
  if (!isEmailLikeId(user.id)) return user.id
  return existing?.userId ?? user.id
}

export function findVendedorForManagedUser(
  board: BoardState,
  user: Pick<ManagedUser, 'id' | 'email'>,
): Vendedor | null {
  const email = user.email.trim().toLowerCase()
  return (
    board.vendedores.find(
      (v) =>
        v.userId === user.id ||
        (v.userId && !isEmailLikeId(v.userId) && v.userId === user.id) ||
        (v.email && v.email.trim().toLowerCase() === email) ||
        (isEmailLikeId(user.id) && v.userId === user.id),
    ) ?? null
  )
}

export type VendedorContatoPatch = {
  whatsapp?: string
  grupoWhatsapp?: string
}

export function managedUserToVendedor(
  user: ManagedUser,
  existing?: Vendedor | null,
  contato?: VendedorContatoPatch,
): Vendedor {
  const nome = vendedorNomeFromUser(user)
  const whatsapp = contato?.whatsapp?.trim() || existing?.whatsapp
  const grupoWhatsapp = contato?.grupoWhatsapp?.trim() || existing?.grupoWhatsapp
  return {
    id: existing?.id ?? crypto.randomUUID(),
    nome,
    email: user.email,
    userId: resolveVendedorUserId(user, existing),
    managedRole: user.role,
    whatsapp: whatsapp || undefined,
    grupoWhatsapp: grupoWhatsapp || undefined,
  }
}

function vendedorAindaTemUsuario(v: Vendedor, usersById: Map<string, ManagedUser>, usersByEmail: Map<string, ManagedUser>): boolean {
  if (!v.userId || v.userId === 'admin-seed') return true
  if (usersById.has(v.userId)) return true
  const em = v.email?.trim().toLowerCase()
  if (em && usersByEmail.has(em)) return true
  if (isEmailLikeId(v.userId) && usersByEmail.has(v.userId.toLowerCase())) return true
  return false
}

/**
 * Mantém vendedores do quadro alinhados aos usuários cadastrados.
 * Só remove linha com userId se o usuário foi excluído em Usuários (admin).
 */
export function reconcileBoardVendedoresWithUsers(
  board: BoardState,
  users: ManagedUser[],
): BoardState {
  const usersById = new Map(users.map((u) => [u.id, u]))
  const usersByEmail = new Map(users.map((u) => [u.email.trim().toLowerCase(), u]))

  let vendedores = board.vendedores.filter((v) =>
    vendedorAindaTemUsuario(v, usersById, usersByEmail),
  )

  for (const user of users) {
    if (user.role !== 'vendedor' && user.role !== 'admin') continue
    const existing = findVendedorForManagedUser({ ...board, vendedores }, user)
    const next = managedUserToVendedor(user, existing)
    if (existing) {
      vendedores = vendedores.map((v) => (v.id === existing.id ? next : v))
    } else {
      vendedores.push(next)
    }
  }

  vendedores = vendedores.map((v) => {
    const em = v.email?.trim().toLowerCase()
    const byEm = em ? usersByEmail.get(em) : undefined
    if (!byEm) return v
    if (v.userId === byEm.id && v.managedRole === byEm.role) return v
    return managedUserToVendedor(byEm, v)
  })

  return { ...board, vendedores }
}

/** Lista para o select de pedido — sempre espelha usuários com perfil Vendedor. */
export function vendedoresSelectFromUsers(board: BoardState, users: ManagedUser[]): Vendedor[] {
  const synced = reconcileBoardVendedoresWithUsers(board, users)
  const lista: Vendedor[] = []
  for (const user of users) {
    if (user.role !== 'vendedor') continue
    const row =
      findVendedorForManagedUser(synced, user) ?? managedUserToVendedor(user, null)
    lista.push(row)
  }
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function mergeVendedoresFromManagedUsers(
  board: BoardState,
  users: ManagedUser[],
): BoardState {
  return reconcileBoardVendedoresWithUsers(board, users)
}

/** Une listas do quadro sem perder vendedores (ex.: merge servidor + local). */
export function mergeVendedoresUnion(a: Vendedor[], b: Vendedor[]): Vendedor[] {
  const out: Vendedor[] = []
  const index = new Map<string, number>()

  const keysFor = (v: Vendedor): string[] => {
    const keys = [`id:${v.id}`]
    if (v.userId) keys.push(`uid:${v.userId}`)
    if (v.email?.trim()) keys.push(`em:${v.email.trim().toLowerCase()}`)
    return keys
  }

  const upsert = (v: Vendedor) => {
    if (!v?.id) return
    let targetIdx: number | undefined
    for (const k of keysFor(v)) {
      if (index.has(k)) {
        targetIdx = index.get(k)
        break
      }
    }
    if (targetIdx !== undefined) {
      const prev = out[targetIdx]
      const merged: Vendedor = {
        ...prev,
        ...v,
        id: prev.id,
        userId: resolveVendedorUserId(
          { id: v.userId ?? prev.userId ?? '', email: v.email ?? prev.email ?? '' },
          prev,
        ),
        nome: v.nome?.trim() ? v.nome : prev.nome,
        managedRole: v.managedRole ?? prev.managedRole,
      }
      out[targetIdx] = merged
      for (const k of keysFor(merged)) index.set(k, targetIdx)
      return
    }
    const idx = out.length
    out.push(v)
    for (const k of keysFor(v)) index.set(k, idx)
  }

  for (const v of a) upsert(v)
  for (const v of b) upsert(v)
  return out
}

/** Vendedores que podem receber pedido no select (admin/gerente) — fallback sem lista de usuários. */
export function vendedoresParaAtribuirPedido(
  vendedores: Vendedor[],
  session: SessionProfile | null,
): Vendedor[] {
  if (!session || session.role === 'vendedor') return vendedores
  const perfilVendedor = vendedores.filter((v) => {
    if (!v.userId || v.userId === 'admin-seed') return false
    if (v.managedRole) return v.managedRole === 'vendedor'
    return true
  })
  const lista =
    perfilVendedor.length > 0 ? perfilVendedor : vendedores.filter((v) => v.userId !== 'admin-seed')
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function findVendedorIdForSession(
  board: BoardState,
  session: SessionProfile | null,
): string | null {
  if (!session) return null
  const linked = findVendedorForManagedUser(board, managedUserFromSession(session))
  if (linked) return linked.id

  const email = session.email?.trim().toLowerCase()
  if (email) {
    const byLink = board.vendedores.find((v) => v.email?.trim().toLowerCase() === email)
    if (byLink) return byLink.id
  }
  const name = session.user?.trim().toLowerCase()
  if (!name) return null
  const byName = board.vendedores.find((v) => v.nome.trim().toLowerCase() === name)
  return byName?.id ?? null
}

/** Vendedor logado só enxerga pedidos vinculados a ele; demais perfis veem o quadro inteiro. */
export function boardVisivelParaSession(
  board: BoardState,
  session: SessionProfile | null,
): BoardState {
  if (!session || session.role !== 'vendedor') return board
  const vendedorId = findVendedorIdForSession(board, session)
  if (!vendedorId) return { ...board, cards: [] }
  return {
    ...board,
    cards: board.cards.filter((c) => c.vendedorId === vendedorId),
  }
}

export function vendedorPodeAcessarPedido(
  board: BoardState,
  session: SessionProfile | null,
  card: Pick<OrderCard, 'vendedorId'>,
): boolean {
  if (!session || session.role !== 'vendedor') return true
  const vendedorId = findVendedorIdForSession(board, session)
  if (!vendedorId) return false
  return card.vendedorId === vendedorId
}

/** Garante linha no quadro para admin/vendedor logado. */
export function managedUserFromSession(session: SessionProfile): ManagedUser {
  const id =
    session.userId ||
    (session.role === 'admin' ? 'admin-seed' : session.email.trim().toLowerCase())
  return {
    id,
    email: session.email,
    name: session.user,
    role: session.role,
    password: '',
  }
}
