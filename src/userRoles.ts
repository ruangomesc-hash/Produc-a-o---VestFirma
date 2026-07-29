export type UserRole = 'admin' | 'gerente' | 'expedicao' | 'impressao' | 'vendedor'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador geral',
  gerente: 'Gerente',
  expedicao: 'Expedição',
  impressao: 'Impressão',
  vendedor: 'Vendedor',
}

export const CREATABLE_ROLES: UserRole[] = ['gerente', 'expedicao', 'impressao', 'vendedor']

export type SessionProfile = {
  user: string
  email: string
  role: UserRole
}

export type ManagedUser = {
  id: string
  email: string
  name: string
  role: UserRole
  password: string
  createdAt?: string
}
