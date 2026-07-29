import type { AuditEntry } from './auditLog'
import { USER_ROLE_LABELS, type UserRole } from './userRoles'

export type AuditActionTone = 'auth' | 'pedido' | 'quadro' | 'usuario' | 'outro'

const ACTION_META: Record<string, { label: string; tone: AuditActionTone }> = {
  'auth.login': { label: 'Login', tone: 'auth' },
  'auth.logout': { label: 'Logout', tone: 'auth' },
  'pedido.criado': { label: 'Pedido', tone: 'pedido' },
  'pedido.editado': { label: 'Pedido', tone: 'pedido' },
  'pedido.movido': { label: 'Pedido', tone: 'pedido' },
  'pedido.comentario': { label: 'Comentário', tone: 'pedido' },
  'pedido.arquivado': { label: 'Arquivo', tone: 'pedido' },
  'pedido.restaurado': { label: 'Pedido', tone: 'pedido' },
  'coluna.criada': { label: 'Coluna', tone: 'quadro' },
  'coluna.removida': { label: 'Coluna', tone: 'quadro' },
  'quadro.restaurado': { label: 'Quadro', tone: 'quadro' },
  'usuario.criado': { label: 'Usuário', tone: 'usuario' },
  'usuario.atualizado': { label: 'Usuário', tone: 'usuario' },
  'usuario.excluido': { label: 'Usuário', tone: 'usuario' },
}

export function describeAuditAction(action: string): { label: string; tone: AuditActionTone } {
  const known = ACTION_META[action]
  if (known) return known
  const prefix = action.split('.')[0]
  const tone: AuditActionTone =
    prefix === 'pedido'
      ? 'pedido'
      : prefix === 'auth'
        ? 'auth'
        : prefix === 'usuario'
          ? 'usuario'
          : prefix === 'quadro' || prefix === 'coluna'
            ? 'quadro'
            : 'outro'
  return { label: action, tone }
}

export function rotuloAutor(e: AuditEntry): string {
  const role = e.actorRole ? USER_ROLE_LABELS[e.actorRole as UserRole] : null
  if (role && e.actorName) return `${e.actorName} · ${role}`
  return e.actorName || e.actorEmail || '—'
}

export function actorKey(e: AuditEntry): string {
  const email = e.actorEmail?.trim().toLowerCase()
  if (email) return email
  const name = e.actorName?.trim()
  if (name) return `name:${name.toLowerCase()}`
  return 'desconhecido'
}

export type ActorColumn = {
  key: string
  title: string
  subtitle: string | null
  entries: AuditEntry[]
}

export function sortEntriesNewestFirst(entries: AuditEntry[]): AuditEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at))
}

export function groupAuditByActor(entries: AuditEntry[]): ActorColumn[] {
  const map = new Map<string, ActorColumn>()
  for (const e of entries) {
    const key = actorKey(e)
    const col = map.get(key)
    if (col) {
      col.entries.push(e)
    } else {
      map.set(key, {
        key,
        title: e.actorName?.trim() || e.actorEmail || 'Desconhecido',
        subtitle: e.actorEmail?.trim() || null,
        entries: [e],
      })
    }
  }

  const columns = [...map.values()].map((col) => ({
    ...col,
    entries: sortEntriesNewestFirst(col.entries),
  }))

  columns.sort((a, b) => {
    const tA = a.entries[0]?.at ?? ''
    const tB = b.entries[0]?.at ?? ''
    return tB.localeCompare(tA)
  })

  return columns
}
