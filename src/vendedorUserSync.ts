import type { BoardState, OrderCard, Vendedor } from './types'
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
  const whatsapp =
    contato?.whatsapp?.trim() || existing?.whatsapp
  const grupoWhatsapp =
    contato?.grupoWhatsapp?.trim() || existing?.grupoWhatsapp
  return {
    id: existing?.id ?? crypto.randomUUID(),
    nome,
    email: user.email,
    userId: user.id,
    whatsapp: whatsapp || undefined,
    grupoWhatsapp: grupoWhatsapp || undefined,
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
      vendedores.push(next)
    }
  }
  return { ...board, vendedores }
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
