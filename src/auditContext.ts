import type { SessionProfile } from './userRoles'

let actor: SessionProfile | null = null

export function setAuditActor(session: SessionProfile | null): void {
  actor = session
}

export function getAuditActor(): SessionProfile | null {
  return actor
}
