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

/**
 * Mantém vendedores do quadro alinhados aos usuários cadastrados.
 * Só adiciona/atualiza — não remove linha do quadro aqui (remoção só quando admin exclui em Usuários).
 */
export function reconcileBoardVendedoresWithUsers(
  board: BoardState,
  users: ManagedUser[],
): BoardState {
  const usersByEmail = new Map(users.map((u) => [u.email.trim().toLowerCase(), u]))

  let vendedores = [...board.vendedores]

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

/** Lista para o select de pedido — espelha usuários com perfil Vendedor. */
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

/** Admin lançando pedido: ele mesmo (padrão) + todos os vendedores — pode reatribuir no select. */
export function vendedoresSelectParaPedidoAdmin(
  board: BoardState,
  users: ManagedUser[],
  session: SessionProfile,
): Vendedor[] {
  const synced = reconcileBoardVendedoresWithUsers(board, users)
  const lista: Vendedor[] = []
  const seen = new Set<string>()
  const push = (row: Vendedor) => {
    if (seen.has(row.id)) return
    seen.add(row.id)
    lista.push(row)
  }

  const adminRow = findVendedorRowForSession(synced, session)
  if (adminRow) push(adminRow)

  for (const user of users) {
    if (user.role !== 'vendedor') continue
    const row = findVendedorForManagedUser(synced, user) ?? managedUserToVendedor(user, null)
    push(row)
  }

  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Fallback sem lista de usuários carregada — inclui o admin logado + vendedores do quadro. */
export function vendedoresParaAtribuirPedidoComAdmin(
  board: BoardState,
  session: SessionProfile,
): Vendedor[] {
  const base = vendedoresParaAtribuirPedido(board.vendedores, session)
  const adminRow = findVendedorRowForSession(board, session)
  if (!adminRow) return base
  if (base.some((v) => v.id === adminRow.id)) return base
  return [adminRow, ...base].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
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

/** Mesma pessoa no quadro (e-mail ou userId), mesmo com ids de linha diferentes. */
export function sameVendedorPerson(a: Vendedor, b: Vendedor): boolean {
  if (a.id === b.id) return true
  const emA = a.email?.trim().toLowerCase()
  const emB = b.email?.trim().toLowerCase()
  if (emA && emB && emA === emB) return true
  const uidA = a.userId
  const uidB = b.userId
  if (uidA && uidB && uidA === uidB && uidA !== 'admin-seed' && !isEmailLikeId(uidA)) return true
  return false
}

function contagemPedidosPorVendedorId(board: BoardState, vendedorId: string): number {
  return board.cards.filter((c) => c.vendedorId === vendedorId).length
}

/** Entre linhas duplicadas da mesma pessoa, usa o id que já tem pedidos. */
export function findVendedorRowForSession(
  board: BoardState,
  session: SessionProfile | null,
): Vendedor | null {
  if (!session) return null
  const candidatos: Vendedor[] = []
  const linked = findVendedorForManagedUser(board, managedUserFromSession(session))
  if (linked) candidatos.push(linked)

  const email = session.email?.trim().toLowerCase()
  if (email) {
    for (const v of board.vendedores) {
      if (v.email?.trim().toLowerCase() === email && !candidatos.some((c) => c.id === v.id)) {
        candidatos.push(v)
      }
    }
  }
  const name = session.user?.trim().toLowerCase()
  if (name) {
    for (const v of board.vendedores) {
      if (v.nome.trim().toLowerCase() === name && !candidatos.some((c) => c.id === v.id)) {
        candidatos.push(v)
      }
    }
  }

  if (candidatos.length === 0) return null
  if (candidatos.length === 1) return candidatos[0]

  let best = candidatos[0]
  let bestN = contagemPedidosPorVendedorId(board, best.id)
  for (let i = 1; i < candidatos.length; i++) {
    const v = candidatos[i]
    const n = contagemPedidosPorVendedorId(board, v.id)
    if (n > bestN) {
      best = v
      bestN = n
    }
  }
  return best
}

export function pedidoPertenceAoVendedorSession(
  board: BoardState,
  card: Pick<OrderCard, 'vendedorId'>,
  session: SessionProfile | null,
): boolean {
  if (!session || session.role !== 'vendedor') return true
  const row = findVendedorRowForSession(board, session)
  if (!row || !card.vendedorId) return false
  if (card.vendedorId === row.id) return true
  const cardRow = board.vendedores.find((v) => v.id === card.vendedorId)
  if (!cardRow) {
    const salesRows = board.vendedores.filter(
      (v) => v.userId !== 'admin-seed' && v.managedRole !== 'admin',
    )
    if (salesRows.length === 1 && salesRows[0].id === row.id) return true
    return false
  }
  return sameVendedorPerson(cardRow, row)
}

/**
 * Une linhas duplicadas de vendedor e remapeia pedidos — evita “sumiço” após sync de Usuários.
 */
export function unifyVendedorRowsAndRelinkCards(board: BoardState): BoardState {
  const idRemap = new Map<string, string>()
  const vendedores = [...board.vendedores]

  for (let i = 0; i < vendedores.length; i++) {
    for (let j = i + 1; j < vendedores.length; j++) {
      const a = vendedores[i]
      const b = vendedores[j]
      if (!sameVendedorPerson(a, b)) continue
      const countA = contagemPedidosPorVendedorId(board, a.id)
      const countB = contagemPedidosPorVendedorId(board, b.id)
      const canonical = countA >= countB ? a.id : b.id
      const alias = canonical === a.id ? b.id : a.id
      idRemap.set(alias, canonical)
    }
  }

  const resolveId = (id: string): string => {
    let cur = id
    const seen = new Set<string>()
    while (idRemap.has(cur) && !seen.has(cur)) {
      seen.add(cur)
      cur = idRemap.get(cur)!
    }
    return cur
  }

  if (idRemap.size === 0) return board

  const cards = board.cards.map((c) => {
    if (!c.vendedorId) return c
    const next = resolveId(c.vendedorId)
    return next === c.vendedorId ? c : { ...c, vendedorId: next }
  })

  const byId = new Map<string, Vendedor>()
  for (const v of vendedores) {
    const id = resolveId(v.id)
    const prev = byId.get(id)
    byId.set(id, prev ? { ...prev, ...v, id } : { ...v, id })
  }

  return { ...board, vendedores: Array.from(byId.values()), cards }
}

/**
 * Pedidos com vendedorId de linha removida do quadro — relink conservador para a linha atual do mesmo e-mail.
 */
export function relinkOrphanVendedorIdsConservative(board: BoardState): BoardState {
  const known = new Set(board.vendedores.map((v) => v.id))
  const orphanIds = [
    ...new Set(
      board.cards.map((c) => c.vendedorId).filter((id): id is string => Boolean(id && !known.has(id))),
    ),
  ]
  if (orphanIds.length === 0) return board

  const salesRows = board.vendedores.filter(
    (v) => v.userId !== 'admin-seed' && v.managedRole !== 'admin',
  )

  let cards = board.cards
  let changed = false

  for (const O of orphanIds) {
    if (salesRows.length === 1) {
      const target = salesRows[0].id
      cards = cards.map((c) => (c.vendedorId === O ? { ...c, vendedorId: target } : c))
      changed = true
      continue
    }

    for (const v of salesRows) {
      const em = v.email?.trim().toLowerCase()
      if (!em) continue
      const sameEmail = salesRows.filter((x) => x.email?.trim().toLowerCase() === em)
      if (sameEmail.length !== 1) continue
      const vOwn = board.cards.filter((c) => c.vendedorId === v.id).length
      const oCount = board.cards.filter((c) => c.vendedorId === O).length
      if (vOwn === 0 && oCount > 0) {
        cards = cards.map((c) => (c.vendedorId === O ? { ...c, vendedorId: v.id } : c))
        changed = true
        break
      }
    }
  }

  return changed ? { ...board, cards } : board
}

export function boardAposSyncVendedoresCompleto(board: BoardState, users: ManagedUser[]): BoardState {
  let next = unifyVendedorRowsAndRelinkCards(reconcileBoardVendedoresWithUsers(board, users))
  next = relinkOrphanVendedorIdsConservative(next)
  return next
}

export function findVendedorIdForSession(
  board: BoardState,
  session: SessionProfile | null,
): string | null {
  return findVendedorRowForSession(board, session)?.id ?? null
}

/** Vendedor logado só enxerga pedidos vinculados a ele; demais perfis veem o quadro inteiro. */
export function boardVisivelParaSession(
  board: BoardState,
  session: SessionProfile | null,
): BoardState {
  if (!session || session.role !== 'vendedor') return board
  if (!findVendedorRowForSession(board, session)) return { ...board, cards: [] }
  return {
    ...board,
    cards: board.cards.filter((c) => pedidoPertenceAoVendedorSession(board, c, session)),
  }
}

export function vendedorPodeAcessarPedido(
  board: BoardState,
  session: SessionProfile | null,
  card: Pick<OrderCard, 'vendedorId'>,
): boolean {
  return pedidoPertenceAoVendedorSession(board, card, session)
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
