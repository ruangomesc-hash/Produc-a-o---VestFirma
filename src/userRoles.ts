export type UserRole = 'admin' | 'gerente' | 'expedicao' | 'impressao' | 'vendedor'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador geral',
  gerente: 'Gerente',
  expedicao: 'Expedição',
  impressao: 'Impressão',
  vendedor: 'Vendedor',
}

export const CREATABLE_ROLES: UserRole[] = ['admin', 'gerente', 'expedicao', 'impressao', 'vendedor']

/** Perfis que entram na lista Vendedores do quadro para lançar pedidos. */
export const ROLES_THAT_PLACE_ORDERS: UserRole[] = ['admin', 'vendedor']

export function canPlaceOrders(role: UserRole | undefined): boolean {
  return role != null && ROLES_THAT_PLACE_ORDERS.includes(role)
}

export type SessionProfile = {
  user: string
  email: string
  role: UserRole
  /** Id em users.json (sessão / login). */
  userId?: string
}

export type ManagedUser = {
  id: string
  email: string
  name: string
  role: UserRole
  password: string
  createdAt?: string
}
