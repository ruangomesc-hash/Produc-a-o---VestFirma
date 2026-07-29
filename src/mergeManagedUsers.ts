import type { ManagedUser } from './userRoles'

/** Nunca deixa a lista “enxugar” por fetch atrasado — une por id. */
export function mergeManagedUsers(a: ManagedUser[], b: ManagedUser[]): ManagedUser[] {
  const byId = new Map<string, ManagedUser>()
  for (const u of a) {
    if (u?.id) byId.set(u.id, u)
  }
  for (const u of b) {
    if (!u?.id) continue
    const prev = byId.get(u.id)
    byId.set(u.id, prev ? { ...prev, ...u } : u)
  }
  return Array.from(byId.values()).sort((x, y) =>
    (x.name || x.email).localeCompare(y.name || y.email, 'pt-BR'),
  )
}
