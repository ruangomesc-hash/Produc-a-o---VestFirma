import type { BoardState, Vendedor } from './types'
import type { ManagedUser, SessionProfile } from './userRoles'
import { canPlaceOrders } from './userRoles'

export function vendedorNomeFromUser(user: Pick<ManagedUser, 'name' | 'email'>): string {
  const name = user.name?.trim()
  return name || user.email
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
        (v.email && v.email.trim().toLowerCase() === email) ||
        (!v.userId && !v.email && v.nome.trim().toLowerCase() === email),
    ) ?? null
  )
}

export function managedUserToVendedor(
  user: ManagedUser,
  existing?: Vendedor | null,
): Vendedor {
  const nome = vendedorNomeFromUser(user)
  return {
    id: existing?.id ?? crypto.randomUUID(),
    nome,
    email: user.email,
    userId: user.id,
    whatsapp: existing?.whatsapp,
    grupoWhatsapp: existing?.grupoWhatsapp,
  }
}

export function mergeVendedoresFromManagedUsers(
  board: BoardState,
  users: ManagedUser[],
): BoardState {
  const sellers = users.filter((u) => canPlaceOrders(u.role))
  if (sellers.length === 0) return board

  let vendedores = [...board.vendedores]
  for (const user of sellers) {
    const existing = findVendedorForManagedUser({ ...board, vendedores }, user)
    const next = managedUserToVendedor(user, existing)
    if (existing) {
      vendedores = vendedores.map((v) => (v.id === existing.id ? next : v))
    } else {
      const dupNome = vendedores.some(
        (v) => v.nome.trim().toLowerCase() === next.nome.trim().toLowerCase() && v.id !== next.id,
      )
      if (!dupNome) vendedores.push(next)
    }
  }
  return { ...board, vendedores }
}

export function findVendedorIdForSession(
  board: BoardState,
  session: { email?: string; user?: string } | null,
): string | null {
  if (!session?.email) return null
  const email = session.email.trim().toLowerCase()
  const byLink = board.vendedores.find((v) => v.email?.trim().toLowerCase() === email)
  if (byLink) return byLink.id
  const name = session.user?.trim().toLowerCase()
  if (!name) return null
  const byName = board.vendedores.find((v) => v.nome.trim().toLowerCase() === name)
  return byName?.id ?? null
}

/** Garante linha no quadro para admin/vendedor logado (ex.: admin seed só no JWT). */
export function managedUserFromSession(session: SessionProfile): ManagedUser {
  return {
    id: session.role === 'admin' ? 'admin-seed' : session.email,
    email: session.email,
    name: session.user,
    role: session.role,
    password: '',
  }
}
